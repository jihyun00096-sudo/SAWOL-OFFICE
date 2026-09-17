import { MemoryManager } from "@/components/sawol/memory-manager";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: memories },
    { data: projects },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("memories")
      .select("*")
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,project_code,name,title,status")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="MEMORY OS"
        title="기억센터"
        description="대표 규칙·프로젝트 경험·검증 지식을 AI 모델과 분리해 보관하고, 실제 업무에 필요한 기억만 선별해서 전달합니다."
      />
      <MemoryManager
        memories={(memories ?? []) as any}
        projects={(projects ?? []) as any}
      />
    </OfficeShell>
  );
}
