import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 13+ App Router 国际化配置
  // 注意：在App Router中，国际化通过middleware实现
  experimental: {
    // 启用App Router国际化支持
    // 这里不再使用i18n配置，而是通过middleware实现
  },
  webpack: (config) => {
    // This rule prevents issues with pdf.js and canvas
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    
    // Ensure node native modules are ignored
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };
    
    return config;
  },
};

export default nextConfig;
