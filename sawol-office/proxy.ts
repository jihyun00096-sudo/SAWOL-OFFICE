import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Machine-to-machine endpoints must not be redirected to the browser login.
  // Each endpoint performs its own authentication:
  // - /api/discord/* : Discord signature or explicit admin/worker auth
  // - /api/worker/*  : SAWOL_WORKER_SECRET
  if (
    pathname.startsWith("/api/discord/") ||
    pathname.startsWith("/api/worker/")
  ) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
