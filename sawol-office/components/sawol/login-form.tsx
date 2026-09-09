"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setErrorMessage("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("이메일 또는 비밀번호를 다시 확인해주세요.");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("is_active", true)
        .maybeSingle();

      if (adminError || !admin) {
        await supabase.auth.signOut();
        setErrorMessage("SAWOL OFFICE 대표 권한이 없는 계정입니다.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage(
        "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-[13px] font-medium text-[#343842]"
        >
          이메일
        </label>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          disabled={isLoading}
          className="h-12 w-full rounded-[12px] border border-[#E1E4E9] bg-white px-4 text-[14px] text-[#17181C] outline-none transition placeholder:text-[#B1B5BD] focus:border-[#3157D5] focus:ring-4 focus:ring-[#3157D5]/[0.08] disabled:cursor-not-allowed disabled:bg-[#F7F8FA]"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-[13px] font-medium text-[#343842]"
        >
          비밀번호
        </label>

        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호 입력"
          disabled={isLoading}
          className="h-12 w-full rounded-[12px] border border-[#E1E4E9] bg-white px-4 text-[14px] text-[#17181C] outline-none transition placeholder:text-[#B1B5BD] focus:border-[#3157D5] focus:ring-4 focus:ring-[#3157D5]/[0.08] disabled:cursor-not-allowed disabled:bg-[#F7F8FA]"
        />
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-[12px] border border-[#F2D5D5] bg-[#FFF8F8] px-4 py-3 text-[13px] leading-5 text-[#B53D3D]"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="flex h-12 w-full items-center justify-center rounded-[12px] bg-[#17181C] px-4 text-[14px] font-semibold text-white transition hover:bg-[#282A30] focus:outline-none focus:ring-4 focus:ring-[#17181C]/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "확인 중..." : "SAWOL OFFICE 로그인"}
      </button>

      <div className="flex items-start gap-2 rounded-[12px] bg-[#F7F8FA] px-3.5 py-3">
        <span
          aria-hidden="true"
          className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#3157D5]"
        />

        <p className="text-[12px] leading-5 text-[#747A86]">
          이 페이지는 등록된 대표 계정만 사용할 수 있습니다.
        </p>
      </div>
    </form>
  );
}