import Link from "next/link";
import { notFound } from "next/navigation";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import {
  employeeStatusLabel,
  labelOf,
  priorityLabel,
  taskStatusLabel,
} from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

function JsonList({ value }: { value: unknown }) {
  const list = Array.isArray(value) ? value : [];
  if (!list.length) {
    return <p className="text-[11px] text-[#9A9FAA]">등록된 내용 없음</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {list.map((item, index) => (
        <span
          key={`${String(item)}-${index}`}
          className="rounded-full bg-[#F4F5F7] px-3 py-1.5 text-[10px] text-[#656B75]"
        >
          {String(item)}
        </span>
      ))}
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [
    { data: employee },
    { data: tasks },
    { data: assignments },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("*, departments:department_id(name, code)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id, task_code, title, status, priority, updated_at")
      .eq("assigned_employee_id", id)
      .neq("status", "COMPLETED")
      .neq("status", "CANCELLED")
      .neq("status", "CANCELED")
      .order("updated_at", { ascending: false }),
    supabase
      .from("task_assignments")
      .select(
        "id, task_id, assignment_source, assignment_reason, match_score, status, assigned_at, released_at, tasks:task_id(task_code, title)",
      )
      .eq("employee_id", id)
      .order("assigned_at", { ascending: false })
      .limit(12),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
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
      <PageHeader
        eyebrow={employee.employee_code}
        title={employee.name}
        description={`${employee.position} · ${employee.departments?.name ?? "소속 없음"}`}
        action={
          <Link
            href="/employees"
            className="flex h-10 items-center justify-center rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75]"
          >
            직원 목록
          </Link>
        }
      />

      <section className="mt-6 flex flex-col gap-5 rounded-[20px] border border-[#E7E9EE] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF2FF] text-[22px] font-bold text-[#3157D5]">
            {employee.name.slice(0, 1)}
          </div>
          <div>
            <p className="text-[17px] font-semibold">{employee.name}</p>
            <p className="mt-1 text-[11px] text-[#9297A1]">
              {employee.departments?.name} · {employee.position}
            </p>
          </div>
        </div>
        <StatusBadge
          value={employee.status}
          label={labelOf(employeeStatusLabel, employee.status)}
        />
      </section>

      <section className="mt-5 rounded-[18px] border border-[#E7E9EE] bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[12px] font-semibold">현재 담당 업무</h2>
            <p className="mt-1 text-[9px] text-[#999EA7]">
              STEP21이 Task 상태를 기준으로 직원 상태와 현재 업무를 자동 관리합니다.
            </p>
          </div>
          <span className="rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[9px] text-[#777D87]">
            {(tasks ?? []).length}건
          </span>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(tasks ?? []).map((task: any) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="rounded-[13px] border border-[#EAECF0] p-4 transition hover:border-[#D8DCE4]"
            >
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge
                  value={task.status}
                  label={labelOf(taskStatusLabel, task.status)}
                />
                <StatusBadge
                  value={task.priority}
                  label={labelOf(priorityLabel, task.priority)}
                />
              </div>
              <p className="mt-3 text-[11px] font-semibold">{task.title}</p>
              <p className="mt-1 text-[9px] text-[#969BA5]">{task.task_code}</p>
            </Link>
          ))}

          {!tasks?.length ? (
            <div className="rounded-[13px] bg-[#F7F8FA] p-5 text-center md:col-span-2">
              <p className="text-[10px] text-[#8C929D]">현재 담당 중인 업무가 없습니다.</p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {sections.map(([title, value]) => (
          <section
            key={title}
            className="rounded-[18px] border border-[#E7E9EE] bg-white p-5"
          >
            <h2 className="text-[12px] font-semibold">{title}</h2>
            <div className="mt-4">
              <JsonList value={value} />
            </div>
          </section>
        ))}

        <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-5">
          <h2 className="text-[12px] font-semibold">업무 스타일</h2>
          <div className="mt-4 space-y-4 text-[11px] leading-5">
            <div>
              <p className="text-[#999EA7]">작업 방식</p>
              <p className="mt-1">{employee.work_style ?? "-"}</p>
            </div>
            <div>
              <p className="text-[#999EA7]">말투</p>
              <p className="mt-1">{employee.speaking_style ?? "-"}</p>
            </div>
            <div>
              <p className="text-[#999EA7]">보고 방식</p>
              <p className="mt-1">{employee.report_style ?? "-"}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[18px] border border-[#E7E9EE] bg-white p-5">
        <h2 className="text-[12px] font-semibold">최근 배정 이력</h2>
        <p className="mt-1 text-[9px] text-[#999EA7]">
          대표 직접 지정과 STEP21 추천 배정 모두 기록됩니다.
        </p>

        <div className="mt-4 space-y-2">
          {(assignments ?? []).map((assignment: any) => (
            <div
              key={assignment.id}
              className="rounded-[12px] border border-[#EAECF0] p-3.5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold">
                    {assignment.tasks?.title ?? "삭제된 업무"}
                  </p>
                  <p className="mt-1 text-[9px] text-[#969BA5]">
                    {assignment.tasks?.task_code ?? "-"} ·{" "}
                    {assignment.assignment_source}
                    {typeof assignment.match_score === "number"
                      ? ` · 적합도 ${assignment.match_score}%`
                      : ""}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[9px] text-[#737984]">
                  {assignment.status === "ACTIVE" ? "현재 배정" : "배정 종료"}
                </span>
              </div>

              {assignment.assignment_reason ? (
                <p className="mt-2 text-[9px] leading-5 text-[#858B96]">
                  {assignment.assignment_reason}
                </p>
              ) : null}
            </div>
          ))}

          {!assignments?.length ? (
            <p className="rounded-[12px] bg-[#F7F8FA] p-4 text-center text-[10px] text-[#8C929D]">
              아직 배정 이력이 없습니다.
            </p>
          ) : null}
        </div>
      </section>
    </OfficeShell>
  );
}
