import type { NextConfig } from 'next';

// `basePath` CHỈ bật khi build cho GitHub Pages (workflow đặt GITHUB_PAGES=true).
// Preview / local KHÔNG có biến này → app chạy ở '/' như bình thường.
const repo = 'furniture-brand';
const onGithubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  output: 'export', // `next build` → web tĩnh trong thư mục out/ (đăng được lên GitHub Pages)
  images: { unoptimized: true }, // export không có server tối ưu ảnh
  trailingSlash: true, // mỗi route thành thư mục /index.html — hợp GitHub Pages
  ...(onGithubPages ? { basePath: `/${repo}` } : {}),
};

export default nextConfig;
