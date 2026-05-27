# ROADMAP — Furniture Brand Configurator

> Bản đồ cố định của dự án. Mọi session đọc file này + `HANDOFF.md` trước khi làm.
> Nguồn gốc: kế hoạch đã được duyệt (`~/.claude/plans/`).
>
> **⚠️ Tổng quan resources / deploy / dependencies**: xem [`PROJECT-LAYOUT.md`](./PROJECT-LAYOUT.md)
> — single source of truth (folders, Workers, KV, Apps Script, Sheet, secrets,
> data flows, common gotchas).

## Dự án là gì

Thương hiệu nội thất mà **mọi sản phẩm đều có configurator 3D** (khách kéo thanh trượt → 3D đổi → thấy giá → đặt hàng kèm cut-list cho xưởng). Sản phẩm đầu: tủ kệ. Mục tiêu: đơn giản hơn Tylko, scale bằng AI — không cần coder người.

## Quyết định cốt lõi: sản phẩm = 1 file CODE

Mỗi sản phẩm là 1 file `products/<slug>/dna.ts` export 1 object `ProductDNA`:
`parameters[]` (núm khách chỉnh) + `build(params)` (sinh hình học) + `priceConfig`.
KHÔNG dùng "engine đọc JSON" — AI viết hàm `build()` trực tiếp → không bao giờ gặp "tường engine".

## Kiến trúc — 4 lớp

```
SITE Next.js → CONFIGURATOR (React + Three.js, dùng chung) → PRODUCT DNA (products/<slug>/dna.ts)
                        ↓ dùng
              THƯ VIỆN CHUNG: renderer · materials · pricing · cutlist
ĐƠN HÀNG → Cloudflare Worker → Apps Script → Google Sheet → Xưởng
```

Configurator viết 1 lần, **BẤT BIẾN**. Thêm sản phẩm = thêm 1 file `dna.ts`, không đụng engine.

## Hợp đồng DNA

Định nghĩa tại `src/configurator/types.ts` — **ĐÃ KHÓA ở Session 1**. Các kiểu: `Parameter`, `Part`, `Hardware`, `ParamValues`, `BuildResult`, `PriceConfig`, `ProductDNA`. Một `Part` vừa là hộp 3D (`size` + `position`) vừa là 1 dòng cut-list (`length/width/thickness` + `grain` + `edgeBanding`). KHÔNG sửa `types.ts` trừ khi thật cần — sửa = phải sửa lại mọi sản phẩm cũ.

## Stack

Next.js 16 (App Router, SSG) · React 19 · TypeScript · Three.js + react-three-fiber · Tailwind · Cloudflare (deploy) · Google Sheets (đơn → xưởng).

## Lộ trình 10 SESSION (cập nhật 2026-05-23)

Mỗi session = 1 cuộc trò chuyện riêng (tiết kiệm token). Làm tuần tự.

- **Session 1 — Engine nền.** ✅ XONG. Project Next.js + `types.ts` (khóa) + `materials.ts` + `renderer.tsx` + `Configurator.tsx` + trang demo render `Part[]` cứng.
- **Session 2 — Sản phẩm đầu (tủ kệ).** `products/tu-ke/dna.ts` (parameters + build) + `configurator/pricing.ts` + `configurator/cutlist.ts` + nối thanh trượt / giá / cut-list vào Configurator. ✅ khi: kéo slider → 3D + giá + cut-list đổi đúng.
- **Session 3 — Validator + bảng ảnh duyệt.** `scripts/validate-dna.ts`: chạy `build()` ở min/giữa/max, bắt lỗi; chụp bảng ảnh cho founder duyệt.
- **Session 4 — Brand foundation + landing page.** ✅ XONG. Brand **"KÊ. by màumè"** (founder đổi tên, có dấu chấm). Copy 15 fonts WOFF2 từ `/Users/hsonvu/CLAUDE/maume/public/fonts/`. globals.css Tailwind 4 `@theme` (color tokens + --gradient + utility classes). Components: KeLogo, Header, Footer, Hero, ValueProps. Landing `/` (Header+Hero+ValueProps+Footer). Configurator move sang `/design`. DNA default 3×2 mở-có-hậu hết. BASELINE: 8.160.145₫ · 17 tấm · 8.92 m². Verify ✅: tsc+validate 32/32+6/6 pass.
- **Session 5 — Preset library + filter UI.** ✅ XONG. 5 preset `products/tu-ke/presets.ts` (Compact 5.2M / Studio 7.1M / Loft 26.4M / Tall 4.2M / Wide 6.8M). Script `pnpm generate-presets` xuất `public/presets-index.json`. Engine extension: `Configurator` thêm prop `initialValues?: Partial<ParamValues>` (additive, founder duyệt). Route `/collection` SSG list + FilterBar inline-chips (pattern maume). Route `/collection/[slug]` SSG detail + JSON-LD Product schema (5 static routes). `/design?preset=<slug>` load preset values vào Configurator. Verify ✅: tsc+validate 32/32+6/6 pass · 4 breakpoint OK · click PresetCard → detail → "Thiết kế tủ này" → /design load đúng values.
- ▶ **Session 6 — Configurator route + deploy ke.maume.asia** (NEXT). `products/tu-ke/presets.ts` (5+ base preset). `scripts/generate-presets.ts` (precompute price/cutlist). Route `/collection` SSG + filter (category/cột/tầng/vật liệu/giá). Route `/collection/[slug]/` với JSON-LD Product schema. Configurator extension: prop `initialValues?` (additive). Configurator load preset qua `?preset=<slug>`. Done: 5+ preset hiển thị, filter chạy, click load đúng cấu hình.
- **Session 6 — Configurator route + deploy ke.maume.asia.** Polish `/design` (next/dynamic ssr:false). Sitemap + robots. JSON-LD Organization. DNS Cloudflare CNAME → GitHub Pages (hoặc Workers). GA4 + Search Console. Lighthouse ≥85 mobile. Done: ke.maume.asia trả 200 cho mọi route, OG share đẹp.
- **Session 7 — Đơn hàng → xưởng** (cũ S5). Cloudflare Worker → Apps Script → Google Sheet (đơn + cut-list).
- **Session 8 — Sản phẩm thứ 2 + chốt mẫu chuẩn + viết `docs/PRODUCT-GUIDE.md`** (cũ S6).
- **Session 9 — Đầu vào sản xuất: catalog vật liệu & phụ kiện (config).** ✅ XONG
  (2026-05-23). Số liệu sản xuất (đơn giá ván/phụ kiện + SKU, mật độ, cân, khổ
  ván, kerf, nhân công, margin) tách khỏi hằng số `pricing.ts` → "catalog sản
  xuất" lưu KV (`catalog:production`), admin maume CRUD tại `/admin/ke-catalog`,
  web KÊ đọc qua `priceConfig` (engine mở rộng additive 4 file, founder duyệt).
  Verify: tsc + validate 32/32+6/6 + BASELINE giữ. CHƯA deploy (ngoài
  done-criteria phiên đó). Chi tiết ở `HANDOFF.md`.
- **Session 10 — Hồ sơ xưởng: nesting + khoan + xuất DXF cho CNC (output).** Mỗi
  đơn → bộ hồ sơ sản xuất hoàn chỉnh: sơ đồ xếp tấm lên ván khổ lớn (bin-packing
  2D, dùng catalog khổ ván + kerf từ S9); **xuất file DXF cho xưởng cắt CNC** —
  mỗi tấm 1 bản vẽ: đường bao + vị trí khoan/phay phụ kiện (bản lề / chốt kệ /
  ray / vít hậu / lỗ tay nắm / lỗ chân tủ). Tấm gia công **2 MẶT** (vd kệ giữa
  khoan chốt cả trên + dưới; vít hậu xuyên) phải **chú thích rõ mặt + thứ tự lật**
  để xưởng hiểu. Cũng: tổng hợp dán cạnh (`Part.edgeBanding`), hướng dẫn lắp ráp,
  nhãn tấm. ⚠️ Vị trí khoan hiện là CÂU CHỮ trong `Part.notes` (máy CNC không
  đọc được) → DXF cần dữ liệu CÓ CẤU TRÚC → nhiều khả năng mở rộng engine bất
  biến (vd `Part.machining?`: loại khoan/phay · mặt `front`/`back` · toạ độ · Ø ·
  độ sâu) → founder duyệt riêng. Xuất PDF / trang admin. Phụ thuộc S9. Done: 1
  đơn test → hồ sơ xưởng đầy đủ + DXF mở được trên phần mềm CNC.

> **Bối cảnh S9–S10** (founder 2026-05-22): founder xác định **"hệ thống đầu vào
> chi tiết cho sản xuất"** đang thiếu — gồm CẢ đầu vào (admin nhập số liệu SX)
> lẫn đầu ra (hồ sơ xưởng chi tiết). Tách 2 session: S9 (config) phải trước vì
> S10 cần khổ ván + catalog phụ kiện từ S9. **Founder ưu tiên làm S9 NGAY session
> kế** (trước phần SEO còn lại của S6 và Session 8) — xem `HANDOFF.md`.

### 📦 Tính năng đã PARK (resume sau MVP)

- **Sub-cells (1D split bên trong open-back/open-nobk)** — branch `feature/sub-cells`
  trên origin. Phase 1 đã hoàn thiện 100% (engine extension, DNA, UI, validator 10/10
  pipeline pass). Park 2026-05-21 vì founder ưu tiên website trước. Resume: xem mục
  "📦 Sub-cells PARKED" trong HANDOFF.md.

## Handoff giữa các session

- File này (`ROADMAP.md`) cố định — bản đồ.
- `HANDOFF.md` — mỗi session cập nhật **trước khi kết thúc**: vừa xong gì, session sau làm gì, quyết định/lưu ý, cách verify.
- `src/configurator/` là engine **BẤT BIẾN** — session làm sản phẩm KHÔNG được sửa; cần mở rộng thì dừng, hỏi.

### SESSION-START prompt (dán đầu mỗi session build S2–S6)

```
Working dir: /Users/hsonvu/CLAUDE/furniture-brand
Đọc ROADMAP.md + HANDOFF.md. Tôi đang làm Session <N>.
Làm đúng phần Session <N> trong ROADMAP, không làm quá phạm vi.
Xong thì verify theo done-criteria rồi cập nhật HANDOFF.md.
```

### SESSION-START prompt — chỉnh ad-hoc / refinement (không thuộc session nào)

```
Working dir: /Users/hsonvu/CLAUDE/furniture-brand
Đọc ROADMAP.md + HANDOFF.md trước để bắt nhịp.
Tôi muốn chỉnh: <mô tả ngắn>.
Nguyên tắc: KHÔNG sửa src/configurator/ trừ khi tôi duyệt — mô tả
kế hoạch chi tiết TRƯỚC khi code.
Xong: verify (tsc + pnpm validate) + cập nhật HANDOFF.md + hỏi tôi
có push lên demo không.
```

### SESSION-START prompt — thêm sản phẩm mới (sau khi xong nền)

```
Working dir: /Users/hsonvu/CLAUDE/furniture-brand
Tôi muốn thêm sản phẩm mới. Mô tả: <loại sản phẩm; kích thước min–max rộng/cao/sâu;
khách được chỉnh gì; vật liệu + độ dày ván; có chân không; khoảng giá>

Em PHẢI:
1. Đọc docs/PRODUCT-GUIDE.md, src/configurator/types.ts, products/tu-ke/dna.ts (mẫu chuẩn).
2. KHÔNG sửa src/configurator/ — engine bất biến. Cần mở rộng thì DỪNG, hỏi trước.
3. Copy products/tu-ke/dna.ts → products/<slug>/dna.ts rồi sửa.
4. 4 bước: I-1 chốt parameters → I-2 viết build() → I-3 chạy validate-dna → I-4 chụp ảnh cho tôi duyệt.
```

## Tận dụng lại (file gốc trong /Users/hsonvu/CLAUDE)

- `furniture-designer/src/lib/material-colors.ts` → `configurator/materials.ts` (đã copy, S1).
- `tylko-demo/index.html` dòng 435–533 → `renderer.tsx` (đã dùng, S1).
- `tylko-demo/index.html` dòng 535+ (`generateFurniture`) → tham khảo cho `build()` đầu tiên (S2).
- `furniture-designer/src/blocks/built-in.ts` + `src/lib/price-calculator.ts` → tham khảo cho `pricing.ts` (S2).
