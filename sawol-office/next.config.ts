import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SAWOL OFFICE v0.1 is an authenticated private operations app.
  // Keep rendering predictable while auth/data flows are stabilized.
  cacheComponents: false,
};

export default nextConfig;
