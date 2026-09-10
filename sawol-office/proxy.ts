import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // External machine-to-machine endpoints authenticate themselves.
  // Do not send Discord interactions or durable worker calls through
  // the browser-login redirect middleware.
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
    /*
     * Match all request paths except:
     * - _next/static
     * - _next/image
     * - favicon.ico
     * - image assets
     *
     * API bypasses are handled explicitly above so the rest of the
     * application's authentication behavior remains unchanged.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
