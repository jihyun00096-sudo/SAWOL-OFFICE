import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  const reason = safeText(body?.reason);

  if (!reason) {
    return NextResponse.json(
      {
        ok: false,
        message: "반려 사유를 입력해주세요.",
      },
      { status: 400 },
    );
  }

  if (reason.length > 2000) {
    return NextResponse.json(
      {
        ok: false,
        message: "반려 사유는 2,000자 이내로 입력해주세요.",
      },
      { status: 400 },
    );
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id,parent_task_id,task_code,title,status,execution_mode,workflow_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (taskError || !task) {
    return NextResponse.json(
      {
        ok: false,
        message: "반려할 업무를 찾을 수 없습니다.",
      },
      { status: 404 },
    );
  }

  if (task.parent_task_id) {
    return NextResponse.json(
      {
        ok: false,
        message: "메인 업무만 대표 반려할 수 있습니다.",
      },
      { status: 409 },
    );
  }

  if (task.status !== "PENDING_APPROVAL") {
    return NextResponse.json(
      {
        ok: false,
        message: "현재 대표 승인 대기 상태인 업무만 반려할 수 있습니다.",
      },
      { status: 409 },
    );
  }

  const { data: rejectResult, error: rejectError } = await supabase.rpc(
    "sawol_reject_autonomous_task",
    {
      p_root_task_id: id,
      p_reason: reason,
    },
  );

  if (rejectError) {
    const missing = rejectError.message.includes(
      "sawol_reject_autonomous_task",
    );

    return NextResponse.json(
      {
        ok: false,
        message: missing
          ? "반려용 DB 함수가 없습니다. STEP22 반려 SQL 적용 상태를 확인해주세요."
          : `반려 처리에 실패했습니다. ${rejectError.message}`,
      },
      { status: 500 },
    );
  }

  if (task.execution_mode !== "AUTO") {
    return NextResponse.json({
      ok: true,
      mode: "MANUAL",
      state: "WAITING",
      message:
        "반려 사유가 저장되었습니다. 수동 업무는 대기 상태로 돌아가며 대표가 직접 수정·재실행할 수 있습니다.",
      rejection: rejectResult,
    });
  }

  const now = new Date().toISOString();

  const { data: existingJob, error: jobLoadError } = await supabase
    .from("task_autopilot_jobs")
    .select("id,metadata,attempt_count,started_at")
    .eq("task_id", id)
    .maybeSingle();

  if (jobLoadError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "반려는 저장됐지만 재작업 큐 상태를 읽지 못했습니다. " +
          jobLoadError.message,
      },
      { status: 500 },
    );
  }

  const rejectionMetadata = {
    ...(existingJob?.metadata ?? {}),
    rejection: {
      reason,
      rejected_at: now,
      source: "WEB_APPROVALS",
      task_code: task.task_code ?? null,
      title: task.title ?? null,
      reopen_from:
        (rejectResult as any)?.reopen_from ?? null,
      fresh_research:
        Boolean((rejectResult as any)?.fresh_research),
      full_restart:
        Boolean((rejectResult as any)?.full_restart),
    },
    discord_notify_signature: null,
    discord_rejection_notify_at: null,
  };

  if (!existingJob) {
    const { error: insertError } = await supabase
      .from("task_autopilot_jobs")
      .insert({
        task_id: id,
        status: "QUEUED",
        progress: 0,
        current_step_title: "대표 반려 재작업 준비",
        last_message:
          "대표 반려가 접수되어 상시 AI 작업 큐에 재등록되었습니다.",
        last_error: null,
        attempt_count: 0,
        started_at: null,
        heartbeat_at: now,
        finished_at: null,
        metadata: rejectionMetadata,
      });

    if (insertError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "반려는 저장됐지만 AUTO 재작업 큐 등록에 실패했습니다. " +
            insertError.message,
        },
        { status: 500 },
      );
    }
  } else {
    const { error: resetError } = await supabase
      .from("task_autopilot_jobs")
      .update({
        status: "QUEUED",
        progress: 0,
        current_step_title: "대표 반려 재작업 준비",
        last_message:
          "대표 반려가 접수되어 상시 AI 작업 큐에 재등록되었습니다.",
        last_error: null,
        finished_at: null,
        heartbeat_at: now,
        metadata: rejectionMetadata,
      })
      .eq("task_id", id);

    if (resetError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "반려는 저장됐지만 AUTO 재작업 큐 초기화에 실패했습니다. " +
            resetError.message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "AUTO",
    state: "QUEUED",
    message:
      "반려 사유가 저장되었고 AUTO 재작업 큐에 등록되었습니다. 상시 Worker가 다음 실행 주기부터 자동 재작업합니다.",
    rejection: rejectResult,
  });
}
