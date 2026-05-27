# PROJECT LAYOUT — KÊ. by màumè

> **Single source of truth** cho dự án KÊ. Audit hoàn chỉnh 2026-05-22.
> Mọi session đọc file này + `ROADMAP.md` + `HANDOFF.md` để bắt nhịp toàn bộ
> hệ thống — code, deploy, secret, sync flow, dependencies.

## 0. TL;DR

KÊ là **thương hiệu nội thất parametric** (con của Màu Mè). Frontend public ở
`ke.maume.asia`, admin ở `admin.maume.asia/ke`. Pipeline: khách thiết kế tủ
trên web → submit đơn → Apps Script ghi Google Sheet + email xưởng.

Stack: Next.js 16 · Three.js · Cloudflare Workers + KV · Apps Script · Google
Sheet · 2 git repo trên GitHub.

## 1. Source code locations

### 🟢 Active (đang dùng)

| Folder | Size | Vai trò | GitHub repo |
|--------|------|---------|-------------|
| `/Users/hsonvu/CLAUDE/furniture-brand/` | 1.0GB | **KÊ public site** (Next.js → `ke-maume` Worker → `ke.maume.asia`) | `hsonvu1912/furniture-brand` (public) |
| `/Users/hsonvu/CLAUDE/maume/` | 2.4GB | **Maume website + KÊ admin** trong `/admin/ke` (Next.js → `maume-admin` Worker → `admin.maume.asia`) | `hsonvu1912/maume` (private) |
| `/Users/hsonvu/CLAUDE/ke-orders-script/` | 16K | **Apps Script clasp mirror** cho KE Orders Webhook | (không trên GitHub — clasp managed) |

### 🟡 Kept (giữ làm reference / archive — founder duyệt 2026-05-22)

| Folder | Size | Note |
|--------|------|------|
| `/Users/hsonvu/CLAUDE/maume-website/` | 2.4GB | Phiên bản cũ của maume website (Mar 2026). Memory `reference_maume_website_path.md` đã warn KHÔNG dùng làm source. Giữ để reference history. |
| `/Users/hsonvu/CLAUDE/tylko-demo/` | 10M | Reverse-engineered Tylko reference docs (markdown + HTML mockup). Inspire KÊ pattern (DNA, parametric flow, configurator). |
| GitHub `hsonvu1912/maume-website` (private) | — | Repo cũ của maume-website folder, last update Mar 2026. Giữ song song folder local. |

### 🔴 Deleted (cleanup 2026-05-22)

| Folder | Size | Lý do |
|--------|------|-------|
| ~~`/Users/hsonvu/CLAUDE/furniture-designer/`~~ | 3.9GB | Legacy v1 standalone Mac app furniture designer (Tauri + React + Rust). Code concept đã port qua furniture-brand (web-based). Git log backup: [`docs/legacy/furniture-designer-git-log.txt`](./docs/legacy/furniture-designer-git-log.txt) (14 commits, từ Phase 0 scaffold Tauri đến Phase 9 v1.0.0 DMG installer). Recovery folder: Time Machine. |

## 2. Cloudflare deployment

### Account
- Email: `maume.decor@gmail.com`
- Account ID: `4cbe22fad7218d1cd8750aeb6c784383`

### Workers

| Worker | Custom domain | Source folder | wrangler.jsonc | Auto-deploy |
|--------|---------------|---------------|----------------|-------------|
| `ke-maume` | `ke.maume.asia` | furniture-brand | `furniture-brand/wrangler.jsonc` | Manual `wrangler deploy` (after `opennextjs-cloudflare build`) |
| `maume-admin` | `admin.maume.asia` | maume | `maume/wrangler.jsonc` | GitHub Actions `.github/workflows/deploy-admin.yml` trigger trên push admin paths |

### KV namespace (shared giữa 2 worker)
- **Name**: `ke-presets`
- **ID**: `9122f2b7b431485389a95a9887cb5516`
- **Binding** ở cả 2 worker: `KE_PRESETS`
- **Key schema**:
  - `preset:<slug>` → JSON Preset (~700-1000B, metadata only — thumbnail là URL)
  - `thumb:<slug>-<timestamp>.png` → binary PNG bytes (~30-60KB mỗi cái)
- Quota free: 100K reads/day · 1GB storage. Current usage rất thấp (<5% storage).

### Secrets
- **`KE_ORDER_WEBHOOK`** trong `ke-maume` worker
  - Value: Apps Script deployment ID `AKfycbzetYeGnOjjE8Befjhs8QIv5MTZZ1UTMxW6whuvRA0iL9JnNxnc78NY6IoxZYlwICbq`
  - API `/api/order` prepend `https://script.google.com/macros/s/` + `/exec` rồi fetch.
  - Update lệnh: `echo "<new-deployment-id>" | wrangler secret put KE_ORDER_WEBHOOK` (chạy từ furniture-brand)
- Maume admin worker có nhiều secrets riêng cho GitHub Actions (GH_APP_*, TOKEN_SECRET, ADMIN_GH_REPO) — không liên quan KÊ.

## 3. Apps Script + Google Sheet

### Apps Script project
- **Title**: `KE Orders Webhook`
- **Script ID**: `1WkRU188OPBlDnrOJdGn3C9qZnI3_O1Wj8lFJoBRB78AikIC1H415-Nzp`
- **Editor URL**: https://script.google.com/d/1WkRU188OPBlDnrOJdGn3C9qZnI3_O1Wj8lFJoBRB78AikIC1H415-Nzp/edit
- **Owner**: maume.decor@gmail.com
- **Local mirror**: `/Users/hsonvu/CLAUDE/ke-orders-script/` (clasp managed)
- **Code file**: `Code.js` — `doPost(e)` handler + Sheet append + Gmail notify
- **Config**: `appsscript.json` — webapp executeAs USER_DEPLOYING + access ANYONE_ANONYMOUS

### Deployments (4 versions tồn tại)

| ID | Version | Description | Status |
|----|---------|-------------|--------|
| `AKfycbzetYeGn...lwICbq` | **@5** | v5 fix rename old sheet | ✅ **ACTIVE** (stored in CF secret) |
| `AKfycbz9wgtk...XWtI` | @2 | v2 anyone access | Kept (founder duyệt giữ) |
| `AKfycbwUDHeW...R-cR` | @1 | KE Orders v1 | Kept |
| `AKfycbx55iAA...iwUEA` | @HEAD | (no description) | Kept |

Webhook URL pattern: `https://script.google.com/macros/s/<deployment-id>/exec`
URL @5 (active): `https://script.google.com/macros/s/AKfycbzetYeGnOjjE8Befjhs8QIv5MTZZ1UTMxW6whuvRA0iL9JnNxnc78NY6IoxZYlwICbq/exec`

Deploy mới: `clasp push -f && clasp deploy -i AKfycbze...lwICbq -d "vN ..."`. Keep deploymentId = URL không đổi.

### Google Sheet
- **Filename**: `KÊ Orders` (auto-created lần đầu Apps Script chạy)
- **Owner**: maume.decor@gmail.com
- **Tab `Orders` (active)**: 16 columns schema v5 — timestamp · contact (5) · slug · name · values · giá total · panels · weight · **Giá JSON** · **Cutlist JSON** · **BOM JSON** · status
- **Tab `Orders-old-<timestamp>` (archive)**: schema cũ 14 cols, 5 test rows. Giữ (founder duyệt).

## 4. Data flow diagrams

### KÊ public — khách thiết kế tủ + đặt hàng
```
[user browser]
    │ GET /collection → KÊ. by màumè catalog
    │ GET /collection/<slug> → preset detail + JSON-LD
    │ GET /design?preset=<slug> → Configurator full-screen
    ▼
[ke-maume worker @ ke.maume.asia]
    │ SSR Next.js (force-dynamic /collection)
    │ R3F renders 3D client-side (dynamic ssr:false)
    │ Mobile drawer pattern (bottom-sheet 72px peek → 80vh expanded)
    │
    │ User click "Đặt hàng" → modal form → POST /api/order
    ▼
[ke-maume /api/order]
    │ Validate name + phone
    │ fetch KE_ORDER_WEBHOOK secret → Apps Script /exec
    ▼
[Apps Script doPost]
    │ Parse JSON: contact, preset, values, price, cutlist, bom
    │ Append row vào Sheet "KÊ Orders" (16 cols, 3 JSON cells)
    │ MailApp.sendEmail → maume.decor@gmail.com
    │ Return {success, orderId}
    ▼
[user] Modal "Đã gửi đơn!" + "Maumè liên hệ qua SĐT trong 24h"
```

### Admin lưu preset → KÊ public reflect
```
[founder browser]
    │ Login admin.maume.asia → /admin/ke
    │ Sửa preset → Configurator mode='admin'
    │ Click "💾 Lưu thành preset"
    ▼
[client]
    │ Toggle mode='screenshot' (150ms) → captureCanvasThumbnail
    │ Pixel scan bbox crop → 600×600 square PNG base64
    │ Toggle về mode='admin'
    │ POST /api/admin/ke-presets (Bearer token)
    ▼
[maume-admin worker]
    │ middleware verify token
    │ ke-presets-store.putPreset():
    │   - decode base64 PNG → KV.put("thumb:<slug>-<ts>.png", bytes)
    │   - replace thumbnail → URL "https://ke.maume.asia/thumb/<key>"
    │   - KV.put("preset:<slug>", JSON metadata + thumbnail URL)
    ▼
[ke.maume.asia/collection] force-dynamic SSR
    │ listPresets() → KV.list({prefix:'preset:'}) + KV.get
    │ Render PresetCard với <img src=URL>
    ▼
[ke.maume.asia/thumb/<key>] worker route
    │ KV.get(`thumb:<key>`, 'stream') → return PNG
    │ Cache-Control: public, max-age=31536000, immutable
```

## 5. Code share strategy: Configurator duplication

**Engine `src/configurator/` + DNA `products/tu-ke/` duplicated giữa 2 project:**

| File | furniture-brand (source) | maume (copy) |
|------|--------------------------|--------------|
| Configurator engine | `src/configurator/*.{ts,tsx}` | `src/lib/ke/configurator/*.{ts,tsx}` |
| Product DNA | `products/tu-ke/dna.ts` + `presets.ts` | `src/lib/ke/products/tu-ke/*` |
| Imports path | `@/configurator/...` | `@/lib/ke/configurator/...` |

**Sync flow (Option A — manual cp):**
```bash
# furniture-brand sửa → sync sang maume:
cp /Users/hsonvu/CLAUDE/furniture-brand/src/configurator/Configurator.tsx \
   /Users/hsonvu/CLAUDE/maume/src/lib/ke/configurator/Configurator.tsx
# Renderer/types/etc tương tự.
# DNA dna.ts cần adapt imports (đã làm 1 lần, không sync vô tội vạ).
```

**Lý do duplicate (chấp nhận):**
- Đơn giản cho MVP — không cần pnpm workspace shared package
- Maume Tailwind 3 vs KÊ Tailwind 4 → cần verify visual mỗi lần sync
- Engine BẤT BIẾN → ít sync thực tế

**Khi nào KHÔNG cần sync:**
- Sửa `src/lib/ke-presets-store.ts` (maume-only)
- Sửa `src/app/admin/ke/page.tsx` (maume-only)
- Sửa `src/app/design/page.tsx` (furniture-brand-only)

## 6. Deploy workflows

### Furniture-brand (ke-maume worker)
```bash
cd /Users/hsonvu/CLAUDE/furniture-brand
nvm use 22  # wrangler 4.x cần Node 22+
rm -rf .open-next .next  # ⚠️ Build cache hay block changes → force rebuild
npx opennextjs-cloudflare build
npx wrangler deploy
```

### Maume (maume-admin worker)
**Option A — Manual** (giống furniture-brand):
```bash
cd /Users/hsonvu/CLAUDE/maume
nvm use 22
rm -rf .open-next .next
npx @opennextjs/cloudflare build
npx wrangler deploy
```

**Option B — GitHub Actions** (tự động):
- Push commit chạm files trong `.github/workflows/deploy-admin.yml` paths list (admin/api/middleware/etc.)
- Workflow tự build + deploy
- Secrets ở GitHub Secrets repo settings (CLOUDFLARE_API_TOKEN, GH_APP_*, TOKEN_SECRET, etc.)

### Apps Script (KE Orders Webhook)
```bash
cd /Users/hsonvu/CLAUDE/ke-orders-script
clasp push -f  # force push Code.js + appsscript.json
clasp deploy -i AKfycbzetYeGnOjjE8Befjhs8QIv5MTZZ1UTMxW6whuvRA0iL9JnNxnc78NY6IoxZYlwICbq -d "vN <description>"
# Cùng deploymentId → URL không đổi (CF Worker secret không cần update).
```

## 7. Verify production
- `https://ke.maume.asia/` → landing
- `https://ke.maume.asia/collection` → 5 preset grid (force-dynamic SSR)
- `https://ke.maume.asia/design?preset=compact` → Configurator
- `https://ke.maume.asia/thumb/compact-<ts>.png` → PNG (cache 1y)
- `https://ke.maume.asia/api/order` (POST) → forward Apps Script
- `https://admin.maume.asia/admin/ke` → admin login → list + edit preset
- Apps Script webhook GET `/exec` → `{"ok":true,"service":"KE Orders Webhook"}`

## 8. Common gotchas
1. **Build cache stale** sau khi đổi Configurator.tsx → `rm -rf .open-next .next` trước build.
2. **`@cloudflare/workers-types` global types** xung đột với DOM (Response.json) → KHÔNG add vào tsconfig `types` array, khai manual minimal trong `cloudflare-env.d.ts`.
3. **Tailwind 3 (maume) vs Tailwind 4 (furniture-brand)**: arbitrary classes (`w-[380px]`) hoạt động cả 2. NHƯNG maume cần `tailwind.config.ts` include `./src/lib/**` vì Configurator copy ở đó (đã setup).
4. **Wrangler ≥ 4 yêu cầu Node ≥ 22**. `nvm use 22` trước mọi lệnh wrangler.
5. **Apps Script POST redirect** trả 405 với curl `--post301` follow. CF Worker fetch handle OK. Đừng debug curl POST trực tiếp.
6. **Configurator sync drift**: sửa 1 cái quên cái kia → mobile drawer pattern session trước có 154 dòng diff cần phát hiện qua audit. Best practice: sửa furniture-brand → cp ngay sang maume → deploy cả 2 cùng lúc.

## 9. Cross-references
- `ROADMAP.md` — kế hoạch session-by-session (S1-S8)
- `HANDOFF.md` — chi tiết từng session đã làm + quyết định
- `docs/` — chưa có (S8 sẽ tạo `docs/PRODUCT-GUIDE.md` cho founder thêm sản phẩm)

## 10. Memory references (Claude Code)
- `feedback_admin_local.md` — admin online tại admin.maume.asia (NOT local)
- `reference_maume_website_path.md` — source thực ở `/maume/`, KHÔNG `/maume-website/`
- `reference_clasp_tool.md` — clasp đã cài + login, dùng cho Apps Script
- `furniture_brand_project.md` — main project index
- `project_tylko_demo.md` — tylko-demo reference docs
- `project_parametric_framework.md` — ⚠️ ĐÃ NGỪNG (đổi tên thành furniture-brand)
