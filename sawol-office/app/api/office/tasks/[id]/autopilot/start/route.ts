import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAutopilotStep } from "@/lib/sawol/autopilot-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

const CLOSED_TASKS = new Set([
  "COMPLETED",
  "PENDING_APPROVAL",
  "CANCELLED",
  "CANCELED",
]);

const STALE_MS = 4 * 60 * 1000;

function safeMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 700)
    : "자동 실행 중 오류가 발생했습니다.";
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

function isStale(job: any) {
  if (!job || job.status !== "RUNNING") return false;

  const value =
    job.heartbeat_at ||
    job.updated_at ||
    job.started_at;

  if (!value) return true;

  return Date.now() - new Date(value).getTime() > STALE_MS;
}

async function updateJob(
  supabase: any,
  taskId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("task_autopilot_jobs")
    .update({
      ...values,
      heartbeat_at: new Date().toISOString(),
    })
    .eq("task_id", taskId);

  if (error) throw new Error(error.message);
}

export async function POST(
  _request: Request,
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

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, parent_task_id, status, execution_mode")
    .eq("id", id)
    .maybeSingle();

  if (taskError || !task) {
    return NextResponse.json(
      {
        ok: false,
        message: "업무를 찾을 수 없습니다.",
      },
      { status: 404 },
    );
  }

  if (task.parent_task_id) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "AI 자율 실행은 메인 업무에서만 시작할 수 있습니다.",
      },
      { status: 409 },
    );
  }

  if (task.execution_mode !== "AUTO") {
    return NextResponse.json(
      {
        ok: false,
        message: "현재 수동 실행 모드입니다.",
      },
      { status: 409 },
    );
  }

  if (CLOSED_TASKS.has(task.status)) {
    return NextResponse.json({
      ok: true,
      state: task.status,
      alreadyFinished: true,
    });
  }

  const { data: existing } = await supabase
    .from("task_autopilot_jobs")
    .select("*")
    .eq("task_id", id)
    .maybeSingle();

  if (
    existing &&
    ["AWAITING_APPROVAL", "COMPLETED"].includes(existing.status)
  ) {
    return NextResponse.json({
      ok: true,
      state: existing.status,
      alreadyFinished: true,
    });
  }

  if (
    existing?.status === "RUNNING" &&
    !isStale(existing)
  ) {
    return NextResponse.json({
      ok: true,
      state: "RUNNING",
      alreadyRunning: true,
    });
  }

  const now = new Date().toISOString();

  if (!existing) {
    const { error: insertError } = await supabase
      .from("task_autopilot_jobs")
      .insert({
        task_id: id,
        status: "QUEUED",
        progress: 0,
        last_message: "자동 실행 대기열에 등록되었습니다.",
        heartbeat_at: now,
      });

    if (insertError && insertError.code !== "23505") {
      return NextResponse.json(
        {
          ok: false,
          message: insertError.message,
        },
        { status: 500 },
      );
    }
  } else {
    const { error: resetError } = await supabase
      .from("task_autopilot_jobs")
      .update({
        status: "QUEUED",
        last_error: null,
        last_message: isStale(existing)
          ? "중단된 자동 실행을 안전하게 이어서 시작합니다."
          : "자동 실행을 다시 시작합니다.",
        finished_at: null,
        heartbeat_at: now,
      })
      .eq("task_id", id);

    if (resetError) {
      return NextResponse.json(
        {
          ok: false,
          message: resetError.message,
        },
        { status: 500 },
      );
    }
  }

  const { data: claimed, error: claimError } = await supabase
    .from("task_autopilot_jobs")
    .update({
      status: "RUNNING",
      started_at: existing?.started_at || now,
      heartbeat_at: now,
      attempt_count: (existing?.attempt_count ?? 0) + 1,
      last_message:
        "비서실장이 AI 직원 조직을 자동 실행 중입니다.",
    })
    .eq("task_id", id)
    .eq("status", "QUEUED")
    .select("id")
    .maybeSingle();

  if (claimError) {
    return NextResponse.json(
      {
        ok: false,
        message: claimError.message,
      },
      { status: 500 },
    );
  }

  if (!claimed) {
    return NextResponse.json({
      ok: true,
      state: "RUNNING",
      alreadyRunning: true,
    });
  }

  after(async () => {
    try {
      for (let index = 0; index < 24; index += 1) {
        const payload = await runAutopilotStep(
          supabase,
          id,
        );

        const progress =
          typeof payload.progress === "number"
            ? payload.progress
            : 0;

        if (payload.state === "NEEDS_DECISION") {
          await updateJob(supabase, id, {
            status: "PAUSED",
            progress,
            current_step_title:
              payload.stepTitle ?? null,
            last_error: null,
            last_message:
              payload.decisionMessage ||
              "자동 재조사를 모두 시도했지만 대표 판단이 필요한 조건이 남았습니다.",
            finished_at: new Date().toISOString(),
            metadata: {
              pause_reason: "RESEARCH_INSUFFICIENT",
              automatic_research_retries_completed: true,
            },
          });
          return;
        }

        const message = payload.stepTitle
          ? `${payload.stepTitle} 완료 · 다음 단계로 인계 중입니다.`
          : payload.state === "WAITING"
            ? "선행 업무 완료를 확인하며 다음 단계를 대기 중입니다."
            : "AI 직원들이 자동으로 업무를 진행하고 있습니다.";

        await updateJob(supabase, id, {
          status: "RUNNING",
          progress,
          current_step_title:
            payload.stepTitle ?? null,
          last_message: message,
          last_error: null,
        });

        if (payload.state === "AWAITING_APPROVAL") {
          await updateJob(supabase, id, {
            status: "AWAITING_APPROVAL",
            progress: 100,
            current_step_title: null,
            last_message:
              "AI 협업과 내부 검수가 완료되어 대표 승인함으로 이동했습니다.",
            finished_at: new Date().toISOString(),
          });
          return;
        }

        if (payload.state === "COMPLETED") {
          await updateJob(supabase, id, {
            status: "COMPLETED",
            progress: 100,
            current_step_title: null,
            last_message: "자동 업무가 완료되었습니다.",
            finished_at: new Date().toISOString(),
          });
          return;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 650),
        );
      }

      throw new Error(
        "자동 실행 안전 한도에 도달했습니다. 현재 진행 상태에서 재개할 수 있습니다.",
      );
    } catch (error) {
      await updateJob(supabase, id, {
        status: "FAILED",
        last_error: safeMessage(error),
        last_message:
          "기술 오류로 자동 실행이 중단되었습니다. 기존 작업 내용은 보존되었습니다.",
        finished_at: new Date().toISOString(),
      });
    }
  });

  return NextResponse.json(
    {
      ok: true,
      state: "RUNNING",
      background: true,
      message:
        "AUTO 업무가 서버 내부 실행을 시작했습니다.",
    },
    { status: 202 },
  );
}
