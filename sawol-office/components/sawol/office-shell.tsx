import Link from "next/link";
import { MobileNav } from "@/components/sawol/mobile-nav";
import { LogoutButton } from "@/components/sawol/logout-button";
import { SidebarLink } from "@/components/sawol/sidebar-link";

const items = [
  { href: "/dashboard", label: "대표실", iconName: "home" as const },
  { href: "/command", label: "업무지시", iconName: "command" as const },
  { href: "/projects", label: "프로젝트", iconName: "folder" as const },
  { href: "/tasks", label: "전체 업무", iconName: "task" as const },
  { href: "/employees", label: "직원", iconName: "users" as const },
  { href: "/approvals", label: "승인함", iconName: "check" as const },
  { href: "/results", label: "결과함", iconName: "result" as const },
  { href: "/memory", label: "기억센터", iconName: "memory" as const },
];

export function OfficeShell({
  children,
  pendingApprovals = 0,
}: {
  children: React.ReactNode;
  pendingApprovals?: number;
}) {
  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[230px] border-r border-[#E6E8ED] bg-white lg:flex lg:flex-col">
        <Link
          href="/dashboard"
          className="flex h-[72px] items-center gap-3 border-b border-[#ECEEF2] px-5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#17181C] text-[11px] font-bold text-white">
            SO
          </div>
          <div>
            <p className="text-[13px] font-semibold tracking-[-0.02em]">
              SAWOL OFFICE
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#31A36B]" />
              <p className="text-[10px] text-[#989DA6]">정상 운영 중</p>
            </div>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={item.label}
              iconName={item.iconName}
              badge={
                item.href === "/approvals" && pendingApprovals > 0
                  ? pendingApprovals
                  : undefined
              }
            />
          ))}
        </nav>

        <div className="border-t border-[#ECEEF2] p-4">
          <div className="mb-3 rounded-[12px] bg-[#F6F7F9] px-3 py-2.5">
            <p className="text-[10px] text-[#999EA7]">SAWOL OFFICE</p>
            <p className="mt-1 text-[11px] font-medium text-[#656B75]">
              v0.1 Operations
            </p>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[230px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E7E9EE]/90 bg-white/95 px-4 sm:h-16 sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav />

            <div className="min-w-0 lg:hidden">
              <p className="truncate text-[13px] font-semibold">SAWOL OFFICE</p>
              <p className="mt-0.5 truncate text-[10px] text-[#969BA5]">
                Private Workspace
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#31A36B]" />
            <span className="text-[11px] text-[#8D929C]">
              대표 계정 연결됨
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] overflow-x-hidden px-4 py-5 sm:px-6 sm:py-8 lg:px-9 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
