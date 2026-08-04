import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  ...(isProduction ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const verificationHeaders = [
  ...securityHeaders,
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, noimageindex" },
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { cpus: 2 },
  allowedDevOrigins: ["*.app.github.dev", "*.trycloudflare.com"],
  outputFileTracingIncludes: {
    "/api/certificates": ["./public/brand/evidara-logo-light.png"],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/verify/certificate/:path*", headers: verificationHeaders },
    ];
  },
};

export default nextConfig;
