import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireSawolAdmin() {
  const supabase = await createClient();

  // Supabase currently recommends getClaims() for protecting pages/data
  // because it verifies the JWT rather than trusting an unverified session.
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub as string | undefined;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const { data: admin, error: adminError } = await supabase
    .from("app_admins")
    .select("user_id, display_name, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !admin) {
    redirect("/login?error=unauthorized");
  }

  return {
    supabase,
    userId,
    admin,
  };
}
