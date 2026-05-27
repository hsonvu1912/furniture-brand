// Types cho Cloudflare env bindings (đồng bộ với wrangler.jsonc).
// Maume mainly dùng process.env cho secrets; binding KE_PRESETS truy cập qua
// getCloudflareContext().env.KE_PRESETS (KVNamespace là object, không phải string).
interface CloudflareEnv {
  ASSETS: Fetcher;
  KE_PRESETS: KVNamespace;
}
