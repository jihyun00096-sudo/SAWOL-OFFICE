"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/sawol/status-badge";
import { employeeStatusLabel, labelOf } from "@/lib/sawol/labels";

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  position: string;
  status: string;
  specialty: unknown;
  current_task_id?: string | null;
  departments: { id: string; name: string } | null;
};

export function EmployeeBrowser({
  employees,
  departments,
}: {
  employees: Employee[];
  departments: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesQuery =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.employee_code.toLowerCase().includes(query) ||
        employee.position.toLowerCase().includes(query);

      const matchesDepartment =
        !department || employee.departments?.id === department;

      const matchesStatus = !status || employee.status === status;

      return matchesQuery && matchesDepartment && matchesStatus;
    });
  }, [employees, q, department, status]);

  return (
    <>
      <div className="mt-6 grid gap-3 rounded-[16px] border border-[#E7E9EE] bg-white p-4 sm:grid-cols-[1fr_220px_160px]">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 · 직원코드 · 직책 검색"
          className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[12px] outline-none focus:border-[#3157D5]"
        />
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]">
          <option value="">모든 부서</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]">
          <option value="">모든 상태</option>
          {Object.entries(employeeStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-[#9297A1]">검색 결과 {filtered.length}명</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((employee) => {
          const specialties = Array.isArray(employee.specialty) ? employee.specialty.slice(0, 3) : [];
          return (
            <Link key={employee.id} href={`/employees/${employee.id}`} className="rounded-[17px] border border-[#E7E9EE] bg-white p-5 transition hover:border-[#D7DBE3] hover:shadow-[0_8px_24px_rgba(25,33,48,0.035)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[12px] font-bold text-[#3157D5]">{employee.name.slice(0,1)}</div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{employee.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[#969BA5]">{employee.employee_code} · {employee.position}</p>
                  </div>
                </div>
                <StatusBadge value={employee.status} label={labelOf(employeeStatusLabel, employee.status)} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium text-[#5F6570]">
                  {employee.departments?.name ?? "소속 없음"}
                </p>
                {employee.current_task_id ? (
                  <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-medium text-[#3157D5]">
                    담당 업무 있음
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {specialties.map((item) => (
                  <span key={String(item)} className="rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[9px] text-[#747A84]">{String(item)}</span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
