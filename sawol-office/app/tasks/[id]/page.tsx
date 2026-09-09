import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailSection } from "@/components/sawol/detail-section";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import { TaskDeleteButton } from "@/components/sawol/task-delete-button";
import { TaskEditForm } from "@/components/sawol/task-edit-form";
import {
  labelOf,
  priorityLabel,
  taskStatusLabel,
} from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [
    { data: task },
    { data: projects },
    { data: departments },
    { data: employees },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: false }),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("employees")
      .select("id, name, employee_code")
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  if (!task) notFound();

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={task.task_code}
        title={task.title}
        description={task.description ?? "업무 설명이 없습니다."}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/tasks"
              className="flex h-10 items-center justify-center rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75]"
            >
              목록으로
            </Link>

            <TaskDeleteButton taskId={task.id} taskTitle={task.title} />
          </div>
        }
      />

      <section className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-3">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">상태</p>
          <div className="mt-2">
            <StatusBadge
              value={task.status}
              label={labelOf(taskStatusLabel, task.status)}
            />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">우선순위</p>
          <div className="mt-2">
            <StatusBadge
              value={task.priority}
              label={labelOf(priorityLabel, task.priority)}
            />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">업무 유형</p>
          <p className="mt-2 break-words text-[12px] font-medium">
            {task.task_type}
          </p>
        </div>
      </section>

      <div className="mt-5">
        <DetailSection
          title="업무 관리"
          description="업무 상태, 소속 프로젝트, 담당 부서와 직원을 직접 관리합니다."
        >
          <TaskEditForm
            task={task as any}
            projects={(projects ?? []) as any}
            departments={(departments ?? []) as any}
            employees={(employees ?? []) as any}
          />
        </DetailSection>
      </div>
    </OfficeShell>
  );
}
