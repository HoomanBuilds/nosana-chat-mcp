import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  async redirects() {
    return [
      {
        source: "/",
        destination: "/ask",
        permanent: true,
      },
    ];
  },

  // --- FIX for @coral-xyz/anchor + @nosana/sdk build issue ---
  webpack: (config) => {
    // Prevent Next.js from trying to bundle @coral-xyz/anchor (server-only)
    config.externals = config.externals || [];
    config.externals.push("@coral-xyz/anchor");

    // Optional: disable fully-specified import rule for CommonJS packages
    config.module.rules.push({
      test: /node_modules[\\/]@nosana[\\/]sdk[\\/]/,
      resolve: { fullySpecified: false },
    });

    return config;
  },
};

export default nextConfig;
