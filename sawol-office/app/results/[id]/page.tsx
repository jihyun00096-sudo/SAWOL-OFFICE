import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailSection } from "@/components/sawol/detail-section";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import {
  labelOf,
  resultStatusLabel,
  resultTypeLabel,
} from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

function metadataObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [{ data: result }, { count: pendingApprovals }] = await Promise.all([
    supabase.from("results").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  if (!result) notFound();

  const [{ data: employee }, { data: project }, { data: task }] = await Promise.all([
    result.employee_id
      ? supabase
          .from("employees")
          .select("id, name, employee_code")
          .eq("id", result.employee_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    result.project_id
      ? supabase
          .from("projects")
          .select("id, name, project_code")
          .eq("id", result.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    result.task_id
      ? supabase
          .from("tasks")
          .select("id, title, task_code")
          .eq("id", result.task_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const metadata = metadataObject(result.metadata);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={result.result_code}
        title={result.title}
        description={result.summary ?? "결과 요약이 없습니다."}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/results"
              className="flex h-10 items-center justify-center rounded-[10px] border border-[#DCE4FF] bg-[#F8FAFF] px-4 text-[11px] font-semibold text-[#3157D5]"
            >
              결과 목록
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

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">결과 유형</p>
          <p className="mt-2 text-[12px] font-medium">
            {labelOf(resultTypeLabel, result.result_type)}
          </p>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">상태</p>
          <div className="mt-2">
            <StatusBadge
              value={result.status}
              label={labelOf(resultStatusLabel, result.status)}
            />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">버전</p>
          <p className="mt-2 text-[12px] font-medium">v{result.version}</p>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">최종본</p>
          <p className="mt-2 text-[12px] font-medium">
            {result.is_final ? "예" : "아니오"}
          </p>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <DetailSection title="연결 정보">
          <dl className="grid gap-4 text-[11px]">
            <div>
              <dt className="text-[#999EA7]">담당 직원</dt>
              <dd className="mt-1.5">
                {employee
                  ? `${employee.name} · ${employee.employee_code}`
                  : "AI 실행 / 미배정"}
              </dd>
            </div>
            <div>
              <dt className="text-[#999EA7]">업무</dt>
              <dd className="mt-1.5">
                {task ? `${task.title} · ${task.task_code}` : "연결 없음"}
              </dd>
            </div>
            <div>
              <dt className="text-[#999EA7]">프로젝트</dt>
              <dd className="mt-1.5">
                {project
                  ? `${project.name} · ${project.project_code}`
                  : "연결 없음"}
              </dd>
            </div>
          </dl>
        </DetailSection>

        <DetailSection title="실행 정보">
          <dl className="grid gap-4 text-[11px]">
            <div>
              <dt className="text-[#999EA7]">생성 방식</dt>
              <dd className="mt-1.5">
                {metadata.provider || metadata.source === "task_run"
                  ? `${metadata.provider ?? "AI"} · ${metadata.model ?? "모델 정보 없음"}`
                  : "직접 등록"}
              </dd>
            </div>
            <div>
              <dt className="text-[#999EA7]">실행 코드</dt>
              <dd className="mt-1.5">{metadata.run_code ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-[#999EA7]">결과 생성일</dt>
              <dd className="mt-1.5">
                {new Date(result.created_at).toLocaleString("ko-KR")}
              </dd>
            </div>
          </dl>
        </DetailSection>
      </div>

      <div className="mt-4">
        <DetailSection title="결과 내용">
          <div className="whitespace-pre-wrap break-words text-[11px] leading-7 text-[#555B65]">
            {result.content ?? "저장된 결과 내용이 없습니다."}
          </div>
        </DetailSection>
      </div>
    </OfficeShell>
  );
}
