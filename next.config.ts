import type { NextConfig } from "next";
const nextConfig:NextConfig={
  trailingSlash:true,
  images:{unoptimized:true},
  typescript:{ignoreBuildErrors:true},
  experimental:{cpus:2}
};
export default nextConfig;
