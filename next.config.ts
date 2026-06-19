import type { NextConfig } from 'next';

// Cloudflare Workers (open-next adapter) — không cần `output: 'export'`.
// Routes /collection và /design SSR runtime để fetch KV.
//
// `images.unoptimized: true` giữ vì chưa wire CF Images binding.
// `assetUrl()` helper vẫn hoạt động: ENV NEXT_PUBLIC_BASE_PATH rỗng → path nguyên.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // P82: dọn hẳn về ngan.maume.asia. Mọi request tới ke.maume.asia → 308 permanent
  // redirect sang ngan (giữ path + query) → ke không còn là web riêng, link/SEO cũ
  // chuyển hết về ngan. ke.maume.asia vẫn bound trong wrangler để worker NHẬN và
  // redirect (không phải để serve). Không loop: host ngan không khớp 'ke.maume.asia'.
  async redirects() {
    const has = [{ type: 'host' as const, value: 'ke.maume.asia' }];
    return [
      // Root riêng — tránh quirk: catch-all `:path*` rỗng + destination tuyệt đối
      // không thay được param (ra literal ":path*" → 404).
      { source: '/', has, destination: 'https://ngan.maume.asia/', permanent: true },
      // Mọi path ≥1 segment (giữ query tự động).
      { source: '/:path+', has, destination: 'https://ngan.maume.asia/:path+', permanent: true },
    ];
  },
};

export default nextConfig;
