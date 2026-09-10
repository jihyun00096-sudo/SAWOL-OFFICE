import { NextResponse } from "next/server";
import { registerDiscordTaskCommand } from "@/lib/discord/register-command";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.SAWOL_WORKER_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const command = await registerDiscordTaskCommand();

    return NextResponse.json({
      ok: true,
      command: {
        id: command.id,
        name: command.name,
        description: command.description,
      },
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
