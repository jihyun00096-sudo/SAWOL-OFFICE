import Link from "next/link";
import { notFound } from "next/navigation";
import { AiExecuteButton } from "@/components/sawol/ai-execute-button";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { TaskRunResultForm } from "@/components/sawol/task-run-result-form";
import { runStatusLabel, runStatusTone } from "@/lib/sawol/run-labels";
import {
  getAiProviderDisplayName,
  getAiProviderName,
  isAiProviderConfigured,
} from "@/lib/ai/provider";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

function metadataObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, any>;
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [{ data: run }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("task_runs")
      .select(
        `
        *,
        tasks:task_id(id, title, task_code, description, status, task_type),
        employees:employee_id(name, employee_code)
        `,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  if (!run) notFound();

  const task = run.tasks as any;
  const metadata = metadataObject(run.metadata);
  const step20 = metadataObject(metadata.step20);
  const sources = Array.isArray(step20.sources) ? step20.sources : [];

  const provider = getAiProviderName();
  const providerLabel = getAiProviderDisplayName(provider);
  const configured = isAiProviderConfigured(provider);

  const configuredModel =
    provider === "mock"
      ? "sawol-mock-v1"
      : provider === "gemini"
        ? process.env.GEMINI_MODEL || "gemini-3.8-flash"
        : process.env.OPENAI_MODEL || "gpt-5.6-luna";

  const openAiWebSearchEnabled = !["0", "false", "off", "no"].includes(
    (process.env.OPENAI_ENABLE_WEB_SEARCH || "true").toLowerCase(),
  );

  const researchMode =
    task?.task_type === "RESEARCH" &&
    provider === "openai" &&
    openAiWebSearchEnabled;

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={run.run_code}
        title={task?.title ?? "실행 세션"}
        description="업무 실행 과정과 제출된 결과를 확인합니다."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/runs"
              className="flex h-10 items-center justify-center rounded-[10px] border border-[#DCE4FF] bg-[#F8FAFF] px-4 text-[11px] font-semibold text-[#3157D5]"
            >
              실행 기록 목록
            </Link>

            {task?.id ? (
              <Link
                href={`/tasks/${task.id}`}
                className="flex h-10 items-center justify-center rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75]"
              >
                업무로 이동
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9499A3]">실행 상태</p>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[9px] font-medium ${
              runStatusTone[run.status] ?? "bg-[#F4F5F7] text-[#777D87]"
            }`}
          >
            {runStatusLabel[run.status] ?? run.status}
          </span>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9499A3]">담당 직원</p>
          <p className="mt-2 text-[11px] font-semibold">
            {(run.employees as any)?.name ?? "미배정"}
          </p>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9499A3]">AI Provider</p>
          <p className="mt-2 break-words text-[11px] font-semibold">
            {run.provider
              ? `${run.provider} · ${run.model ?? "-"}`
              : `${providerLabel} · ${configuredModel}`}
          </p>
        </div>
      </section>

      {!run.result_body ? (
        <div className="mt-5">
          <AiExecuteButton
            runId={run.id}
            runStatus={run.status}
            configured={configured}
            provider={provider}
            providerLabel={providerLabel}
            model={configuredModel}
            researchMode={researchMode}
          />
        </div>
      ) : null}

      {provider === "gemini" && task?.task_type === "RESEARCH" && !run.result_body ? (
        <section className="mt-3 rounded-[14px] border border-[#F0E1B9] bg-[#FFFBF1] p-4">
          <p className="text-[10px] font-semibold text-[#84651F]">
            무료 Gemini 테스트 · 최신 외부 검색 미사용
          </p>
          <p className="mt-1 text-[9px] leading-5 text-[#8C7950]">
            현재 무료 테스트 구성에서는 Google Search grounding을 사용하지 않습니다.
            최신 가격·정책·뉴스·공식 현황처럼 시점에 따라 달라지는 사실은 별도로 검증해주세요.
          </p>
        </section>
      ) : null}

      {run.status === "FAILED" && run.error_message ? (
        <section className="mt-5 rounded-[16px] border border-[#F0D2D2] bg-[#FFF8F8] p-4">
          <p className="text-[10px] font-semibold text-[#A64242]">
            이전 AI 실행 오류
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-5 text-[#8F6060]">
            {run.error_message}
          </p>
        </section>
      ) : null}

      {run.result_body ? (
        <section className="mt-5 rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold text-[#3157D5]">
                제출 결과
              </p>
              <h2 className="mt-2 text-[16px] font-semibold">
                {run.result_title}
              </h2>
            </div>

            {typeof step20.confidence === "number" ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[9px] text-[#666C76]">
                  신뢰도 {step20.confidence}%
                </span>
                {step20.needs_human_review ? (
                  <span className="rounded-full bg-[#FFF5DD] px-2.5 py-1 text-[9px] text-[#8A6824]">
                    사람 확인 권장
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {run.result_summary ? (
            <p className="mt-4 rounded-[12px] bg-[#F7F8FA] px-4 py-3 text-[11px] leading-5 text-[#666C76]">
              {run.result_summary}
            </p>
          ) : null}

          <div className="mt-5 whitespace-pre-wrap text-[12px] leading-7 text-[#444A54]">
            {run.result_body}
          </div>

          {sources.length ? (
            <div className="mt-6 border-t border-[#ECEEF2] pt-5">
              <p className="text-[10px] font-semibold">참고 출처</p>
              <div className="mt-3 space-y-2">
                {sources.map((source: any, index: number) => (
                  <div
                    key={`${source.url ?? ""}-${index}`}
                    className="rounded-[11px] bg-[#F7F8FA] p-3"
                  >
                    <p className="break-words text-[10px] font-semibold">
                      {source.title || "출처"}
                    </p>
                    {source.note ? (
                      <p className="mt-1 text-[9px] leading-5 text-[#858B96]">
                        {source.note}
                      </p>
                    ) : null}
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-[9px] text-[#3157D5] underline underline-offset-2"
                      >
                        {source.url}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {run.provider ? (
            <div className="mt-6 border-t border-[#ECEEF2] pt-4 text-[9px] text-[#A0A5AE]">
              AI 실행 · {run.provider} · {run.model ?? "-"}
              {run.provider === "mock" ? " · 테스트 비용 0원" : ""}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mt-5 rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-[13px] font-semibold">수동 결과 제출</p>
            <p className="mt-1 text-[10px] text-[#8B919C]">
              AI 실행을 사용하지 않거나 직접 결과를 입력해야 할 때 사용할 수 있습니다.
            </p>
          </div>

          <TaskRunResultForm runId={run.id} taskId={task.id} />
        </section>
      )}
    </OfficeShell>
  );
}
