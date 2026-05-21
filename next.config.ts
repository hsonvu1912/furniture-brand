import type { NextConfig } from 'next';

// `basePath` CHỈ bật khi build cho GitHub Pages (workflow đặt GITHUB_PAGES=true).
// Preview / local KHÔNG có biến này → app chạy ở '/' như bình thường.
const repo = 'furniture-brand';
const onGithubPages = process.env.GITHUB_PAGES === 'true';
const basePath = onGithubPages ? `/${repo}` : '';

const nextConfig: NextConfig = {
  output: 'export', // `next build` → web tĩnh trong thư mục out/ (đăng được lên GitHub Pages)
  images: { unoptimized: true }, // export không có server tối ưu ảnh
  trailingSlash: true, // mỗi route thành thư mục /index.html — hợp GitHub Pages
  ...(basePath ? { basePath } : {}),
  // Expose basePath cho client code (helper assetUrl) — raw <img src="/path">
  // KHÔNG tự prefix basePath như Next Link/Image. Public env phải có NEXT_PUBLIC_*.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
