import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeAiTask } from "@/lib/ai/provider";
import type { SawolAiContext } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 180;

function safeMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 700);
  }

  return "알 수 없는 AI 실행 오류가 발생했습니다.";
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub as string | undefined;

  if (claimsError || !userId) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { data: admin, error: adminError } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !admin) {
    return NextResponse.json(
      { ok: false, message: "SAWOL OFFICE 대표 권한이 없습니다." },
      { status: 403 },
    );
  }

  const { data: run, error: runError } = await supabase
    .from("task_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (runError || !run) {
    return NextResponse.json(
      { ok: false, message: "실행 세션을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (["SUBMITTED", "COMPLETED"].includes(run.status)) {
    return NextResponse.json(
      { ok: false, message: "이미 결과가 제출된 실행 세션입니다." },
      { status: 409 },
    );
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", run.task_id)
    .maybeSingle();

  if (taskError || !task) {
    return NextResponse.json(
      { ok: false, message: "연결된 업무를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const [
    projectResult,
    departmentResult,
    employeeResult,
    memoryResult,
  ] = await Promise.all([
    task.project_id
      ? supabase.from("projects").select("*").eq("id", task.project_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    task.assigned_department_id
      ? supabase.from("departments").select("*").eq("id", task.assigned_department_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    (run.employee_id || task.assigned_employee_id)
      ? supabase.from("employees").select("*").eq("id", run.employee_id || task.assigned_employee_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("memories").select("*").eq("status", "ACTIVE").limit(12),
  ]);

  const context: SawolAiContext = {
    task: task as Record<string, unknown>,
    project: (projectResult.data as Record<string, unknown> | null) ?? null,
    department: (departmentResult.data as Record<string, unknown> | null) ?? null,
    employee: (employeeResult.data as Record<string, unknown> | null) ?? null,
    memories: (memoryResult.data as Record<string, unknown>[] | null) ?? [],
  };

  const now = new Date().toISOString();

  const { error: claimError } = await supabase
    .from("task_runs")
    .update({
      status: "RUNNING",
      ai_started_at: now,
      ai_finished_at: null,
      error_message: null,
      updated_at: now,
    })
    .eq("id", id);

  if (claimError) {
    return NextResponse.json(
      { ok: false, message: "실행 세션을 AI 실행 상태로 변경하지 못했습니다." },
      { status: 500 },
    );
  }

  try {
    const ai = await executeAiTask({
      context,
      useWebSearch: task.task_type === "RESEARCH",
    });

    const finishedAt = new Date().toISOString();

    const previousMetadata =
      run.metadata &&
      typeof run.metadata === "object" &&
      !Array.isArray(run.metadata)
        ? run.metadata
        : {};

    const { error: saveRunError } = await supabase
      .from("task_runs")
      .update({
        status: "SUBMITTED",
        provider: ai.provider,
        model: ai.model,
        provider_response_id: ai.responseId,
        usage_json: ai.usage,
        ai_finished_at: finishedAt,
        submitted_at: finishedAt,
        result_title: ai.result.title,
        result_summary: ai.result.summary,
        result_body: ai.result.body,
        error_message: null,
        metadata: {
          ...previousMetadata,
          step20: {
            used_web_search: ai.usedWebSearch,
            confidence: ai.result.confidence,
            needs_human_review: ai.result.needs_human_review,
            sources: ai.result.sources,
          },
        },
        updated_at: finishedAt,
      })
      .eq("id", id);

    if (saveRunError) {
      throw new Error(
        `AI 결과는 생성됐지만 DB 저장에 실패했습니다: ${saveRunError.message}`,
      );
    }

    const { error: updateTaskError } = await supabase
      .from("tasks")
      .update({
        status: "REVIEW",
        updated_at: finishedAt,
      })
      .eq("id", task.id);

    if (updateTaskError) {
      return NextResponse.json({
        ok: true,
        warning:
          "AI 결과는 저장됐지만 업무 상태를 검수 대기로 변경하지 못했습니다.",
        runId: id,
      });
    }

    return NextResponse.json({
      ok: true,
      runId: id,
      provider: ai.provider,
      resultTitle: ai.result.title,
      confidence: ai.result.confidence,
      needsHumanReview: ai.result.needs_human_review,
      usedWebSearch: ai.usedWebSearch,
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = safeMessage(error);

    await supabase
      .from("task_runs")
      .update({
        status: "FAILED",
        error_message: message,
        ai_finished_at: failedAt,
        updated_at: failedAt,
      })
      .eq("id", id);

    return NextResponse.json(
      { ok: false, message },
      { status: 500 },
    );
  }
}
