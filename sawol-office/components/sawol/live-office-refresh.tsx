"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveOfficeRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, Math.max(5, seconds) * 1000);

    return () => window.clearInterval(timer);
  }, [router, seconds]);

  return (
    <div className="flex items-center gap-2 rounded-full border border-[#E2E6ED] bg-white px-3 py-1.5 shadow-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#31A36B] opacity-40" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#31A36B]" />
      </span>
      <span className="text-[9px] font-semibold text-[#69717D]">LIVE</span>
      <span className="text-[8px] text-[#A0A6AF]">
        {lastRefresh.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })}
      </span>
    </div>
  );
}
