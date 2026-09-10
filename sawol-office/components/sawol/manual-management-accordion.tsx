"use client";

import { useState, type ReactNode } from "react";

export function ManualManagementAccordion({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-[18px] border border-[#E7E9EE] bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold text-[#343840]">
            수동 운영 도구
          </span>
          <span className="mt-1 block break-keep text-[10px] leading-5 text-[#8C929D]">
            직원 배정, 실행 세션, 상태 변경, 업무 수정을 대표가 직접 제어합니다.
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4E7EC] bg-[#F8F9FB] text-[15px] text-[#737A85] transition-transform ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>
      {open ? (
        <div className="space-y-5 border-t border-[#ECEEF2] p-5">{children}</div>
      ) : null}
    </section>
  );
}
