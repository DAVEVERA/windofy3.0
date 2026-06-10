import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "*": [
      ".venv/**/*",
      "models/**/*",
      "data/uploads/**/*",
    ],
  },
};

export default nextConfig;
