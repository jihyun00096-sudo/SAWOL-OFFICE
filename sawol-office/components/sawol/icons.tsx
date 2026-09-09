import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

function IconBase({
  children,
  ...props
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: Props) => (
  <IconBase {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></IconBase>
);
export const CommandIcon = (p: Props) => (
  <IconBase {...p}><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></IconBase>
);
export const FolderIcon = (p: Props) => (
  <IconBase {...p}><path d="M3.5 6.5h6l2 2H20.5v10h-17v-12Z"/></IconBase>
);
export const TaskIcon = (p: Props) => (
  <IconBase {...p}><path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></IconBase>
);
export const UsersIcon = (p: Props) => (
  <IconBase {...p}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.5-6 5.5-6s5 2 5.5 6"/><path d="M15 6.5a3 3 0 0 1 0 5.5M16 14c2.5.5 4 2.2 4.5 5"/></IconBase>
);
export const CheckIcon = (p: Props) => (
  <IconBase {...p}><path d="M5 12.5 9.2 17 19 7"/></IconBase>
);
export const ResultIcon = (p: Props) => (
  <IconBase {...p}><path d="M6 3.5h9l3 3V20H6z"/><path d="M14.5 3.5V7H18M9 11h6M9 15h6"/></IconBase>
);
export const MemoryIcon = (p: Props) => (
  <IconBase {...p}><path d="M8 4.5a3 3 0 0 0-3 3v1A3.5 3.5 0 0 0 4 15a3 3 0 0 0 4 3.5"/><path d="M16 4.5a3 3 0 0 1 3 3v1a3.5 3.5 0 0 1 1 6.5 3 3 0 0 1-4 3.5"/><path d="M8 4.5v14M16 4.5v14M8 9h3M13 14h3"/></IconBase>
);
export const MenuIcon = (p: Props) => (
  <IconBase {...p}><path d="M4 7h16M4 12h16M4 17h16"/></IconBase>
);
export const CloseIcon = (p: Props) => (
  <IconBase {...p}><path d="m6 6 12 12M18 6 6 18"/></IconBase>
);
export const ChevronIcon = (p: Props) => (
  <IconBase {...p}><path d="m9 6 6 6-6 6"/></IconBase>
);
