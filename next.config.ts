import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: false,
});

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default withPWA(nextConfig);
