import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the local network address used to open the development server.
  allowedDevOrigins: ["192.168.56.1"],
};

export default nextConfig;
