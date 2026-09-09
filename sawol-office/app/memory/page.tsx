import { MemoryManager } from "@/components/sawol/memory-manager";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const { supabase } = await requireSawolAdmin();

  const [{ data: memories }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("memories")
      .select("*")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="MEMORY"
        title="기억센터"
        description="대표의 취향, 중요한 결정, 프로젝트 경험과 승인된 재사용 결과를 회사의 기억으로 축적합니다."
      />
      <MemoryManager memories={(memories ?? []) as any} />
    </OfficeShell>
  );
}
