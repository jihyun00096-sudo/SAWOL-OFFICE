"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    if (isLoading) return;

    setIsLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="inline-flex h-9 items-center justify-center rounded-[10px] border border-[#E3E5EA] bg-white px-3.5 text-[12px] font-medium text-[#5D626D] transition hover:bg-[#F7F8FA] hover:text-[#17181C] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? "로그아웃 중" : "로그아웃"}
    </button>
  );
}
