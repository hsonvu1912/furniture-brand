// OpenNext adapter config cho Cloudflare Workers.
// KÊ chỉ dùng SSR đơn giản (không ISR/revalidate) → bỏ incrementalCache.
// Khi nào thêm route `revalidate` thì wire lại r2IncrementalCache hoặc kvIncrementalCache.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
