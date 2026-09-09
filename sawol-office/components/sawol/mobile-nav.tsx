"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CheckIcon,
  CloseIcon,
  CommandIcon,
  FolderIcon,
  HomeIcon,
  MemoryIcon,
  MenuIcon,
  ResultIcon,
  TaskIcon,
  UsersIcon,
} from "@/components/sawol/icons";

const items = [
  { href: "/dashboard", label: "대표실", icon: HomeIcon },
  { href: "/command", label: "업무지시", icon: CommandIcon },
  { href: "/projects", label: "프로젝트", icon: FolderIcon },
  { href: "/tasks", label: "전체 업무", icon: TaskIcon },
  { href: "/employees", label: "직원", icon: UsersIcon },
  { href: "/approvals", label: "승인함", icon: CheckIcon },
  { href: "/results", label: "결과함", icon: ResultIcon },
  { href: "/memory", label: "기억센터", icon: MemoryIcon },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#E3E6EB] bg-white text-[#40444D] lg:hidden"
        aria-label="메뉴 열기"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
          />

          <aside className="absolute inset-y-0 left-0 flex w-[min(310px,calc(100vw-20px))] flex-col overflow-hidden rounded-r-[22px] bg-white shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#ECEEF2] px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#17181C] text-[11px] font-bold text-white">
                  SO
                </div>
                <div>
                  <p className="text-[13px] font-semibold">SAWOL OFFICE</p>
                  <p className="mt-0.5 text-[10px] text-[#969BA5]">
                    Private Workspace
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] hover:bg-[#F5F6F8]"
                aria-label="닫기"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(`${item.href}/`));

                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-[11px] px-3 py-2.5 text-[13px] font-medium ${
                      active
                        ? "bg-[#EEF2FF] text-[#3157D5]"
                        : "text-[#5F6570] hover:bg-[#F6F7F9]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 border-t border-[#ECEEF2] px-4 py-3">
              <p className="text-[10px] text-[#9A9FAA]">
                SAWOL OFFICE · v0.1
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
