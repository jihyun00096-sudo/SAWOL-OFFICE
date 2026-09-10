import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDurableWorkerOnce } from "@/lib/sawol/durable-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.SAWOL_WORKER_SECRET;

  if (!secret) return false;

  const auth = request.headers.get("authorization");
  const workerHeader = request.headers.get("x-sawol-worker-secret");

  return (
    auth === `Bearer ${secret}` ||
    workerHeader === secret
  );
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized worker request",
      },
      { status: 401 },
    );
  }

  try {
    const supabase = createAdminClient();
    const result = await runDurableWorkerOnce(supabase);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message.slice(0, 700)
            : "Durable worker failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
