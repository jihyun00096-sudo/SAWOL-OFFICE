import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAutopilotStep } from "@/lib/sawol/autopilot-runner";

export const runtime = "nodejs";
export const maxDuration = 180;

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 700)
    : "AI 자동 실행 오류";
}

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  if (!(await requireAdmin(supabase))) {
    return NextResponse.json(
      { ok: false, message: "권한이 없습니다." },
      { status: 403 },
    );
  }

  try {
    const result = await runAutopilotStep(supabase, id);
    return NextResponse.json(result);
  } catch (error) {
    const message = messageOf(error);

    const { data: root } = await supabase
      .from("tasks")
      .select("workflow_id")
      .eq("id", id)
      .maybeSingle();

    if (root?.workflow_id) {
      await supabase
        .from("task_workflows")
        .update({
          status: "FAILED",
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", root.workflow_id);
    }

    return NextResponse.json(
      { ok: false, message },
      { status: 500 },
    );
  }
}
