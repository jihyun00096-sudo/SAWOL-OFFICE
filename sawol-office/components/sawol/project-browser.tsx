"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/sawol/status-badge";
import {
  labelOf,
  priorityLabel,
  projectStatusLabel,
} from "@/lib/sawol/labels";

type Project = {
  id: string;
  project_code: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
  current_stage: string | null;
  created_at: string;
};

export function ProjectBrowser({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return projects.filter((project) => {
      const searchMatch =
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.project_code.toLowerCase().includes(q) ||
        (project.current_stage ?? "").toLowerCase().includes(q);

      return (
        searchMatch &&
        (!status || project.status === status) &&
        (!priority || project.priority === priority)
      );
    });
  }, [projects, query, status, priority]);

  const control =
    "h-10 rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[11px] outline-none focus:border-[#3157D5]";

  return (
    <>
      <div className="mt-6 grid gap-3 rounded-[16px] border border-[#E7E9EE] bg-white p-4 sm:grid-cols-[1fr_170px_150px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="프로젝트명 · 코드 · 현재 단계 검색"
          className={control}
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={control}
        >
          <option value="">모든 상태</option>
          {Object.entries(projectStatusLabel).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className={control}
        >
          <option value="">모든 우선순위</option>
          {Object.entries(priorityLabel).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-[10px] text-[#969BA5]">
        {filtered.length}개 프로젝트
      </p>

      <div className="mt-3 grid gap-3">
        {filtered.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="rounded-[18px] border border-[#E7E9EE] bg-white p-5 transition hover:border-[#D6DAE2] hover:shadow-[0_8px_24px_rgba(25,33,48,0.035)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    value={project.status}
                    label={labelOf(projectStatusLabel, project.status)}
                  />
                  <StatusBadge
                    value={project.priority}
                    label={labelOf(priorityLabel, project.priority)}
                  />
                </div>

                <h2 className="mt-3 truncate text-[14px] font-semibold sm:text-[15px]">
                  {project.name}
                </h2>

                <p className="mt-1 text-[10px] text-[#9A9FAA]">
                  {project.project_code} · {project.current_stage ?? "단계 미설정"}
                </p>
              </div>

              <div className="w-full sm:w-[220px]">
                <div className="flex items-center justify-between text-[10px] text-[#8C929D]">
                  <span>진행률</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#ECEEF2]">
                  <div
                    className="h-full rounded-full bg-[#3157D5]"
                    style={{
                      width: `${Math.max(0, Math.min(100, project.progress))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}

        {!filtered.length ? (
          <div className="rounded-[18px] border border-dashed border-[#DDE1E7] bg-white p-10 text-center">
            <p className="text-[12px] font-medium text-[#666C76]">
              조건에 맞는 프로젝트가 없습니다.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
