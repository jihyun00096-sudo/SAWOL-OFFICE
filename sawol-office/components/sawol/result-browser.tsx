"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/sawol/status-badge";
import { labelOf, resultTypeLabel } from "@/lib/sawol/labels";

type Result = {
  id: string;
  result_code: string;
  title: string;
  summary: string | null;
  result_type: string;
  status: string;
  version: number;
  is_final: boolean;
  created_at: string;
  employees: { name: string; employee_code: string } | null;
};

export function ResultBrowser({ results }: { results: Result[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [finalOnly, setFinalOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return results.filter((result) => {
      const searchMatch =
        !q ||
        result.title.toLowerCase().includes(q) ||
        result.result_code.toLowerCase().includes(q) ||
        (result.summary ?? "").toLowerCase().includes(q);

      return (
        searchMatch &&
        (!type || result.result_type === type) &&
        (!status || result.status === status) &&
        (!finalOnly || result.is_final)
      );
    });
  }, [results, query, type, status, finalOnly]);

  const control =
    "h-10 rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[11px] outline-none focus:border-[#3157D5]";

  const statuses = Array.from(new Set(results.map((result) => result.status)));

  return (
    <>
      <div className="mt-6 grid gap-3 rounded-[16px] border border-[#E7E9EE] bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1fr_160px_150px_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="결과 제목 · 코드 · 요약 검색"
          className={control}
        />

        <select value={type} onChange={(e) => setType(e.target.value)} className={control}>
          <option value="">모든 유형</option>
          {Object.entries(resultTypeLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={control}
        >
          <option value="">모든 상태</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-[#F6F7F9] px-3 text-[10px] text-[#656B75]">
          <input
            type="checkbox"
            checked={finalOnly}
            onChange={(event) => setFinalOnly(event.target.checked)}
            className="accent-[#3157D5]"
          />
          최종본만
        </label>
      </div>

      <p className="mt-3 text-[10px] text-[#969BA5]">{filtered.length}개 결과</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {filtered.map((result) => (
          <Link
            href={`/results/${result.id}`}
            key={result.id}
            className="rounded-[17px] border border-[#E7E9EE] bg-white p-5 transition hover:border-[#D7DBE3]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[10px] text-[#707680]">
                {labelOf(resultTypeLabel, result.result_type)}
              </span>
              <StatusBadge value={result.status} label={result.status} />
            </div>

            <h2 className="mt-4 text-[14px] font-semibold">{result.title}</h2>

            <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-[#7D838E]">
              {result.summary ?? "요약 없음"}
            </p>

            <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-[#999EA7]">
              <span>{result.result_code}</span>
              <span>v{result.version}</span>
              <span>{result.employees?.name ?? "담당자 없음"}</span>
              {result.is_final ? (
                <span className="font-medium text-[#3157D5]">최종본</span>
              ) : null}
            </div>
          </Link>
        ))}

        {!filtered.length ? (
          <div className="rounded-[18px] border border-dashed border-[#DDE1E7] bg-white p-10 text-center sm:col-span-2">
            <p className="text-[12px] text-[#777D87]">
              조건에 맞는 결과물이 없습니다.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
