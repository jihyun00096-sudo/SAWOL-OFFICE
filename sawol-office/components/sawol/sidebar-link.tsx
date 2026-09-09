"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CheckIcon,
  CommandIcon,
  FolderIcon,
  HomeIcon,
  MemoryIcon,
  ResultIcon,
  TaskIcon,
  UsersIcon,
} from "@/components/sawol/icons";

const iconMap = {
  home: HomeIcon,
  command: CommandIcon,
  folder: FolderIcon,
  task: TaskIcon,
  users: UsersIcon,
  check: CheckIcon,
  result: ResultIcon,
  memory: MemoryIcon,
};

type IconName = keyof typeof iconMap;

export function SidebarLink({
  href,
  label,
  iconName,
  badge,
}: {
  href: string;
  label: string;
  iconName: IconName;
  badge?: number;
}) {
  const pathname = usePathname();

  const active =
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  const Icon = iconMap[iconName];

  return (
    <Link
      href={href}
      className={`flex h-11 items-center gap-3 rounded-[11px] px-3 text-[12px] font-medium transition ${
        active
          ? "bg-[#EEF2FF] text-[#3157D5]"
          : "text-[#656B75] hover:bg-[#F6F7F9] hover:text-[#2D3036]"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />

      <span className="flex-1">{label}</span>

      {badge ? (
        <span className="rounded-full bg-[#3157D5] px-2 py-0.5 text-[9px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}