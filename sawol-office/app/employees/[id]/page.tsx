import { notFound } from "next/navigation";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import { employeeStatusLabel, labelOf } from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

function JsonList({ value }: { value: unknown }) {
  const list = Array.isArray(value) ? value : [];
  if (!list.length) return <p className="text-[11px] text-[#9A9FAA]">등록된 내용 없음</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {list.map((item, index) => (
        <span key={`${String(item)}-${index}`} className="rounded-full bg-[#F4F5F7] px-3 py-1.5 text-[10px] text-[#656B75]">
          {String(item)}
        </span>
      ))}
    </div>
  );
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [{ data: employee }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("employees")
      .select("*, departments:department_id(name, code)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  if (!employee) notFound();

  const sections = [
    ["전문분야", employee.specialty],
    ["담당업무", employee.responsibilities],
    ["허용 행동", employee.allowed_actions],
    ["금지 행동", employee.prohibited_actions],
    ["사용 도구", employee.tools],
  ] as const;

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader eyebrow={employee.employee_code} title={employee.name} description={`${employee.position} · ${employee.departments?.name ?? "소속 없음"}`} />

      <section className="mt-6 flex flex-col gap-5 rounded-[20px] border border-[#E7E9EE] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF2FF] text-[22px] font-bold text-[#3157D5]">{employee.name.slice(0,1)}</div>
          <div>
            <p className="text-[17px] font-semibold">{employee.name}</p>
            <p className="mt-1 text-[11px] text-[#9297A1]">{employee.departments?.name} · {employee.position}</p>
          </div>
        </div>
        <StatusBadge value={employee.status} label={labelOf(employeeStatusLabel, employee.status)} />
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {sections.map(([title, value]) => (
          <section key={title} className="rounded-[18px] border border-[#E7E9EE] bg-white p-5">
            <h2 className="text-[12px] font-semibold">{title}</h2>
            <div className="mt-4"><JsonList value={value} /></div>
          </section>
        ))}

        <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-5">
          <h2 className="text-[12px] font-semibold">업무 스타일</h2>
          <div className="mt-4 space-y-4 text-[11px] leading-5">
            <div><p className="text-[#999EA7]">작업 방식</p><p className="mt-1">{employee.work_style ?? "-"}</p></div>
            <div><p className="text-[#999EA7]">말투</p><p className="mt-1">{employee.speaking_style ?? "-"}</p></div>
            <div><p className="text-[#999EA7]">보고 방식</p><p className="mt-1">{employee.report_style ?? "-"}</p></div>
          </div>
        </section>
      </div>
    </OfficeShell>
  );
}
