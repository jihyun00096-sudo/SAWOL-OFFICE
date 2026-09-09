import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/sawol/login-form";
export const instant = false;


export const metadata = {
  title: "로그인",
};

export default async function LoginPage() {

  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub as string | undefined;

  if (userId) {
    const { data: admin } = await supabase
      .from("app_admins")
      .select("user_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (admin) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#3157D5]/[0.06] blur-3xl"
      />

      <section className="relative w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[15px] bg-[#17181C] text-sm font-bold tracking-[-0.02em] text-white shadow-sm">
            SO
          </div>

          <h1 className="text-[28px] font-bold tracking-[-0.035em] text-[#17181C] sm:text-[30px]">
            SAWOL OFFICE
          </h1>

          <p className="mt-2 text-[14px] leading-6 text-[#747A86]">
            대표 전용 개인 AI 오피스
          </p>
        </div>

        <div className="rounded-[24px] border border-[#E7E9EE] bg-white p-6 shadow-[0_12px_40px_rgba(20,28,45,0.05)] sm:p-8">
          <div className="mb-7">
            <h2 className="text-[20px] font-semibold tracking-[-0.025em]">
              로그인
            </h2>

            <p className="mt-1.5 text-[13px] leading-5 text-[#7A808B]">
              등록된 대표 계정으로 접속해주세요.
            </p>
          </div>

          <LoginForm />
        </div>

        <p className="mt-5 text-center text-[12px] leading-5 text-[#9A9FAA]">
          SAWOL OFFICE · Private Workspace
        </p>
      </section>
    </main>
  );
}