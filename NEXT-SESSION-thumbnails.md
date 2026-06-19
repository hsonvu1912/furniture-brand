# Prompt cho session sau — Render lại thumbnail các preset

> Copy nguyên đoạn dưới (phần trong khung) làm prompt mở session mới.

---

**Việc**: Render lại thumbnail cho các preset Tủ Kệ Module (ke.maume.asia) cho khớp giao diện 3D hiện tại. Sau loạt refactor P9–P23 (2026-05-29), hình tủ render đã đổi (vị trí tay nắm, DOOR_MAX_HEIGHT=600 → ô cao >600 thành mở-có-hậu, chiều cao tầng snap nấc {150/300/450}, default 4 tầng) nên **thumbnail cũ trong KV bị lỗi thời**. Đọc `~/CLAUDE/furniture-brand/HANDOFF.md` mục trên cùng ("Configurator UX polish 2026-05-29") + mục "Thumbnail auto-render khi admin Save preset" trước khi làm.

**Bối cảnh hạ tầng:**
- 2 codebase sync tay: `~/CLAUDE/furniture-brand` (engine gốc, deploy `ke.maume.asia`) và `~/CLAUDE/maume` (admin, deploy `admin.maume.asia`, copy engine ở `src/lib/ke/`). Sync path: `@/configurator/` ↔ `@/lib/ke/configurator/`.
- Cloudflare Workers + OpenNext. CLI init bắt buộc trước mọi lệnh node/wrangler:
  `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22 && export PATH="$PATH:/usr/local/bin"`
- Browser automation: **Playwright MCP** (không dùng Chrome). Preview local: `.claude/launch.json` config "furniture-brand" port 3462.
- Giao tiếp tiếng Việt. **Mô tả & xin duyệt TRƯỚC khi code** (founder non-code). Deploy chỉ khi founder OK.

**Pipeline thumbnail HIỆN CÓ (đừng làm lại từ đầu):**
- 5 preset người dùng: `compact, studio, loft, tall, wide` (slug). Test presets `test-*` KHÔNG cần thumbnail.
- Preset lưu ở **KV** (`KE_PRESETS`), field `thumbnail?: string` (base64 PNG). Fallback built-in `products/tu-ke/presets.ts` + `src/lib/presets-store.ts`.
- Render: `Configurator` prop `mode='screenshot'` + `screenshotAngle` + `computeScreenshotCamera(W,H,D,angle)` (distance fixed theo `BASELINE_HEIGHT=2400`, FOV 25°, FILL 0.85) + `Ground variant='studio'` (sàn trắng tinh, bóng mềm).
- Capture: `maume/src/lib/ke/capture-thumbnail.ts` → `pickAngle(slug)` (hash slug → 1/3 góc deterministic) + `captureCanvasThumbnail(rootEl, 480)` (center-crop vuông → downscale → toDataURL PNG).
- Flow hiện tại = **THỦ CÔNG**: vào `admin.maume.asia/admin/ke` → "Sửa" từng preset → "Lưu" (KeEditor toggle captureMode='screenshot' 150ms → capture → POST). Wiring ở `maume/src/app/admin/ke/page.tsx`.
- Consumer: `PresetCard.tsx` + `collection/page.tsx` (ưu tiên `preset.thumbnail`, fallback `/presets/<slug>.png`), `object-contain` trong tile 4:5.

**Mục tiêu phiên (xin founder chọn hướng trước khi code):**
1. Re-render 5 thumbnail cho khớp look mới (bắt buộc).
2. Cân nhắc giảm thủ công: (a) giữ flow Save-từng-cái qua admin (đơn giản, ít code), hay (b) làm nút "Render lại tất cả" trong admin / script batch chạy Playwright loop 5 preset. Nêu trade-off, để founder chọn.
3. Kiểm tra composition còn đẹp sau khi default đổi 4 tầng + height snap (góc/khoảng cách/sàn trắng). `BASELINE_HEIGHT=2400` vẫn đúng (cabinet total max 2400).

**Gotchas quan trọng:**
- ⚠️ **3D chỉ render khi pane/tab preview ĐANG VISIBLE** (RAF treo khi ẩn) → capture lúc ẩn ra canvas đen. Đảm bảo tab/pane mở khi capture.
- Góc deterministic theo slug hash — đổi slug = đổi góc.
- KV value ~50-200KB/thumbnail, limit 25MB → thoải mái.
- Preset values có thể render "lạ" sau snap height (vd tall 2400/6 tầng → snap 450). Nếu thumbnail nhìn sai tỉ lệ → có thể cần **re-curate preset values** (việc riêng, hỏi founder).

**Verify:** `pnpm validate` (33+6+8+62) + tsc cả 2 repo → deploy 2 worker (Node 22 wrangler) → Playwright chụp `ke.maume.asia/collection` (5 tile thumbnail mới) + `admin.maume.asia/admin/ke` (list có `<img>` base64).

**Production baseline (cập nhật 2026-05-29 sau P24–P26 render upgrade):** `ke.maume.asia` = `ec06f066...`, `admin.maume.asia` = `6f746c17...`

**⚡ QUAN TRỌNG — hệ render ĐÃ NÂNG CẤP (P24–P26, đọc HANDOFF mục trên cùng):** screenshot mode giờ có **GTAO** (ambient occlusion → chiều sâu), **camera tele 1650mm + bounding-sphere auto-framing** (mọi kích thước tự canh giữa, không cắt), **bóng mềm**. Render lại thumbnail giờ sẽ ra ảnh ĐẸP HƠN HẲN ảnh cũ trong KV. Không cần chỉnh thêm render — chỉ cần capture lại.

**Treo từ phiên trước (nhắc founder):** P14.2 "split cánh ra 2 ngăn kéo" — chưa repro được, cần URL preset + thao tác + screenshot trước/sau.

---
