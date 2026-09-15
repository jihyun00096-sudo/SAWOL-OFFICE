import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerDiscordCommands } from "@/lib/discord/register-command";

export const runtime = "nodejs";

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

function isWorkerAuthorized(request: Request) {
  const secret = process.env.SAWOL_WORKER_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function runRegistration() {
  try {
    const commands = await registerDiscordCommands();

    return NextResponse.json({
      ok: true,
      message: "Discord /업무 /승인 /반려 명령 등록 완료",
      commands: commands.map((command: any) => ({
        id: command.id,
        name: command.name,
        description: command.description,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message.slice(0, 700)
            : "Command registration failed",
      },
      { status: 500 },
    );
  }
}

// 대표가 SAWOL OFFICE에 로그인한 상태에서 브라우저로 열면 등록됩니다.
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

  return runRegistration();
}

export async function POST(request: Request) {
  if (!isWorkerAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  return runRegistration();
}
