import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App autenticada y 100% dinámica: se usa el modelo clásico de render (sin Cache Components).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
