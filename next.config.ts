import type { NextConfig } from 'next';

// Cloudflare Workers (open-next adapter) — không cần `output: 'export'`.
// Routes /collection và /design SSR runtime để fetch KV.
//
// `images.unoptimized: true` giữ vì chưa wire CF Images binding.
// `assetUrl()` helper vẫn hoạt động: ENV NEXT_PUBLIC_BASE_PATH rỗng → path nguyên.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;
