import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setupDiscordWorkspace } from "@/lib/discord/workspace-setup";

export const runtime = "nodejs";
export const maxDuration = 60;

async function isLoggedInAdmin() {
  const supabase = await createClient();

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

export async function GET() {
  if (!(await isLoggedInAdmin())) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "SAWOL OFFICE에 대표 관리자 계정으로 로그인한 뒤 다시 열어주세요.",
      },
      { status: 403 },
    );
  }

  try {
    const result = await setupDiscordWorkspace();

    return NextResponse.json({
      ...result,
      message:
        "Discord 서버 구조 생성 및 윤서진 비서실장 닉네임 설정이 완료되었습니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Discord workspace setup failed",
      },
      { status: 500 },
    );
  }
}
