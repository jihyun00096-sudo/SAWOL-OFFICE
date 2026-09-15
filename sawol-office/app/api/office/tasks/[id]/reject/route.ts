import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectTaskFromControl } from "@/lib/sawol/approval-control";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin(supabase: any) {
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub as string | undefined;

  if (claimsError || !userId) return false;

  const { data: admin, error: adminError } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return !adminError && Boolean(admin);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  if (!(await requireAdmin(supabase))) {
    return NextResponse.json(
      {
        ok: false,
        message: "SAWOL OFFICE 대표 권한이 없습니다.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const reason =
    typeof body?.reason === "string" ? body.reason.trim() : "";

  try {
    const result = await rejectTaskFromControl(
      supabase,
      id,
      reason,
      "WEB_APPROVALS",
    );

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      state: result.state,
      message:
        result.mode === "AUTO"
          ? "반려 사유가 저장되었고 AUTO 재작업 큐에 등록되었습니다."
          : "반려 사유가 저장되어 수동 업무가 대기 상태로 돌아갔습니다.",
      rejection: result.rejection,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message.slice(0, 700)
            : "반려 처리에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
