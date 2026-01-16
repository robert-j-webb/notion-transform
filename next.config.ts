import type { NextConfig } from "next";

import path from "path";

// Otherwise we get a warning
const root = path.resolve(__filename, "../");

const nextConfig: NextConfig = {
  turbopack: {
    root,
  },
  async headers() {
    return [
      {
        source: "/api/notion",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
