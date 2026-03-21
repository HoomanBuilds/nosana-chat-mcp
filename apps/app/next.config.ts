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

  transpilePackages: ["@nosana-chat/ai", "@nosana-chat/indexdb"],

  serverExternalPackages: ["@coral-xyz/anchor"],

  // --- FIX for @coral-xyz/anchor + @nosana/sdk build issue ---
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push("@coral-xyz/anchor");

    config.module.rules.push({
      test: /node_modules[\\/]@nosana[\\/]sdk[\\/]/,
      resolve: { fullySpecified: false },
    });

    return config;
  },

  turbopack: {
    resolveAlias: {
      "@nosana/sdk": { browser: "@nosana/sdk" },
    },
  },
};

export default nextConfig;
