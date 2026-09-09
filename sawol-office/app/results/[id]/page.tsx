import { notFound } from "next/navigation";
import { DetailSection } from "@/components/sawol/detail-section";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import { labelOf, resultTypeLabel } from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

function displayValue(value: unknown) {
  if (value == null || value === "") return "-";

  if (typeof value === "boolean") {
    return value ? "예" : "아니오";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [
    { data: result },
    { data: employee },
    { data: project },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from("results").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("results")
      .select("employee_id")
      .eq("id", id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data?.employee_id) return { data: null };
        return supabase
          .from("employees")
          .select("id, name, employee_code")
          .eq("id", data.employee_id)
          .maybeSingle();
      }),
    supabase
      .from("results")
      .select("project_id")
      .eq("id", id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data?.project_id) return { data: null };
        return supabase
          .from("projects")
          .select("id, name, project_code")
          .eq("id", data.project_id)
          .maybeSingle();
      }),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  if (!result) notFound();

  const knownKeys = new Set([
    "id",
    "result_code",
    "title",
    "summary",
    "result_type",
    "status",
    "version",
    "is_final",
    "created_at",
    "updated_at",
    "employee_id",
    "project_id",
  ]);

  const extraEntries = Object.entries(result).filter(
    ([key, value]) =>
      !knownKeys.has(key) &&
      value != null &&
      value !== "" &&
      key !== "content",
  );

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={result.result_code}
        title={result.title}
        description={result.summary ?? "결과 요약이 없습니다."}
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
            <StatusBadge value={result.status} label={result.status} />
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
        <DetailSection title="담당 정보">
          <dl className="grid gap-4 text-[11px]">
            <div>
              <dt className="text-[#999EA7]">담당 직원</dt>
              <dd className="mt-1.5">
                {employee
                  ? `${employee.name} · ${employee.employee_code}`
                  : "미배정"}
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
            <div>
              <dt className="text-[#999EA7]">생성일</dt>
              <dd className="mt-1.5">
                {new Date(result.created_at).toLocaleString("ko-KR")}
              </dd>
            </div>
          </dl>
        </DetailSection>

        <DetailSection title="요약">
          <p className="whitespace-pre-wrap text-[11px] leading-6 text-[#626873]">
            {result.summary ?? "요약 없음"}
          </p>
        </DetailSection>
      </div>

      {"content" in result && result.content ? (
        <div className="mt-4">
          <DetailSection title="결과 내용">
            <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-6 text-[#555B65]">
              {displayValue(result.content)}
            </pre>
          </DetailSection>
        </div>
      ) : null}

      {extraEntries.length ? (
        <div className="mt-4">
          <DetailSection
            title="기타 메타데이터"
            description="현재 Result 레코드에 저장된 추가 정보입니다."
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              {extraEntries.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-[10px] text-[#999EA7]">{key}</dt>
                  <dd className="mt-1.5 whitespace-pre-wrap break-words text-[11px] text-[#626873]">
                    {displayValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </DetailSection>
        </div>
      ) : null}
    </OfficeShell>
  );
}
