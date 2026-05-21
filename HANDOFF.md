# HANDOFF — trạng thái dự án

> Mỗi session cập nhật file này TRƯỚC KHI kết thúc. Session sau đọc để bắt nhịp.

## ✅ Session 1 — Engine nền (XONG)

Project **Next.js 16.2.6** (App Router, `src/`, Tailwind 4, TS) + **Three.js 0.184** /
**react-three-fiber 9.6.1** / **drei 10.7.7**. Đã dựng `src/configurator/`:
`types.ts` (HỢP ĐỒNG DNA — ĐÃ KHÓA), `materials.ts`, `renderer.tsx`, `Configurator.tsx`.

## ✅ Session 2 — Sản phẩm đầu: tủ kệ (XONG)

Đã build & verify đầy đủ:

- **`src/configurator/materials.ts`** — catalog vật liệu tủ kệ: `mdf_son` (ván MDF sơn
  màu — 9 màu đo từ ảnh swatch thật) + `plywood_veneer` (ván plywood veneer — 3 vân: sồi,
  óc chó, tần bì). Cả hai nằm trong nhánh fallback gỗ của `resolveMaterial()`.
- **`src/configurator/pricing.ts`** (mới) — `computePrice(build, priceConfig)` → `PriceBreakdown`.
  Gộp diện tích ván theo catalog, gộp phụ kiện theo id. `total = (vật liệu + phụ kiện) ×
  margin + laborPerOrder`. Bảng đơn giá (`MATERIAL_RATE_PER_M2`, `HARDWARE_UNIT_PRICE`)
  nằm ngay trong file — chỉnh giá ở đây. `formatPrice()` xuất VND.
- **`src/configurator/cutlist.ts`** (mới) — `buildCutlist(build)` → `Cutlist`. Gộp các tấm
  trùng (label + kích thước + vật liệu + vân) thành 1 dòng có số lượng. KHÔNG có cột dán cạnh.
- **`src/configurator/Configurator.tsx`** — nâng cấp: nhận `ProductDNA`, render bảng điều
  khiển (slider cho `number`, hàng nút cho `option`) + 3D + giá + bảng cắt. Chuỗi `useMemo`:
  `values → build() → price/cutlist`. **Từ đây engine xem như BẤT BIẾN.**
- **`products/tu-ke/dna.ts`** (mới) — `ProductDNA` thật, **MẪU CHUẨN** cho sản phẩm sau.
- **`src/configurator/cellgrid.ts`** (mới, sau S2) — mã hoá/giải mã/chuẩn hoá lưới loại ô.
- **`src/app/page.tsx`** — trang dùng `products/tu-ke/dna.ts`.

`types.ts`, `Configurator.tsx`, `renderer.tsx` đã được mở rộng nhiều lần sau S2 (founder
duyệt từng lần) — xem mục Quyết định. `layout.tsx` chưa đụng (để S4 lo SEO/metadata).

**Đã verify (done-criteria ✅):** `tsc --noEmit` pass; không lỗi console; kéo cả 5 slider
+ 3 nút option → 3D + giá + bảng cắt cập nhật đúng (đã test default, cánh toàn bộ, 2 hàng
ngăn kéo, đổi màu, cột 1↔4, rộng/cao/sâu min↔max — số liệu khớp tính tay).

## ✅ Session 3 — Validator (XONG)

Viết `scripts/validate-dna.ts` — script Node độc lập (chạy bằng `tsx`) gọi `build()` của
`products/tu-ke/dna.ts` qua 32 cấu hình, bắt lỗi hình học. KHÔNG đụng `src/configurator/`
(chỉ import). Chạy: **`pnpm validate`**.

- **`tsx` 4.22.3** → `devDependencies`; script `"validate": "tsx scripts/validate-dna.ts"`
  trong `package.json`. (`tsx` đọc alias `@/*` từ `tsconfig.json` — chạy `dna.ts` ngoài Next OK.)
- **5 nhóm kiểm** trên mỗi kết quả `build()`:
  1. `size` ↔ `length/width/thickness` khớp (3 cạnh `size` sắp giảm dần = l/w/t).
  2. Không cạnh ≤ 0 (mọi cạnh `size` > 0; `qty` > 0).
  3. `thickness_mm` ∈ {9, 18} — khổ ván xưởng. Founder chọn kiểm theo TẬP (không theo vai
     trò tấm) → tái dùng được cho sản phẩm sau.
  4. Tổng giá > 0.  5. Bảng cắt không rỗng.
- **Tự kiểm (`selfTest`)** — nuôi 6 `build()` GIẢ có lỗi đã biết, xác nhận mỗi check thật
  sự bắt được; tránh "check rỗng luôn PASS". In `Tự kiểm: 6/6`.
- **32 cấu hình:** ca gốc · min/giữa/max từng chiều (rộng/cao/sâu/cột/tầng — đọc ĐỘNG từ
  `tuKe.parameters` nên tự bám nếu đổi khoảng) · toàn min/giữa/max · 4 tổ hợp chế độ
  chia-đều/từng · 1 ca biên tủ-min + cột/tầng-max chạy THÔ (bỏ `normalizeValues`) · phủ đủ
  4 loại ô + cánh đôi · ngăn kéo ô không hợp lệ (test nhánh dự phòng) · phủ 2 bảng đơn giá.
- Lỗi → in dòng `FAIL` kèm `id` tấm + chi tiết; `process.exitCode = 1` (dùng được trong CI).

**Đã verify (done-criteria ✅):** `pnpm validate` → tự kiểm 6/6, **32/32 cấu hình ĐẠT**,
exit 0; ca "Mặc định" = 6.413.453₫ · 33 tấm · 6.42 m² (khớp mốc HANDOFF). `tsc --noEmit` pass.

**Lưu ý cho sau:** validator hardcode sản phẩm `tu-ke` (import trực tiếp + bộ case riêng).
S6 thêm sản phẩm 2 → tổng quát hoá: `checkBuild()` đã dùng chung được; cần tách mỗi sản
phẩm 1 bộ case (hoặc nhận slug qua `argv`).

## ✅ Nâng cấp UX configurator — wizard 3 bước (sau S3, founder duyệt)

Founder yêu cầu 3 mục, đã duyệt cho mở rộng engine theo kiểu **chỉ-thêm-không-phá**. Sửa 3
file: `types.ts` + `Configurator.tsx` (lõi) + `dna.ts` (sản phẩm). `build()` KHÔNG đụng →
hình học & validator nguyên vẹn.

- **Wizard 3 bước.** Khách thao tác lần lượt: B1 "Kích thước" (cột/tầng/chế độ/rộng/cao/sâu)
  → B2 "Thuộc tính ô" (lưới `cells`) → B3 "Màu & vật liệu" (lưới `cellColors` + `color`).
  Thanh chỉ bước bấm được để nhảy thẳng; mỗi bước có "Làm lại bước này" (đưa núm của bước về
  mặc định) + "← Bước trước" / "Bước sau →" (ẩn ở bước đầu / cuối). Giá + bảng cắt hiện ở
  mọi bước; 3D + giá luôn tính từ TOÀN BỘ núm, không phụ thuộc bước đang xem.
- **Nhập tay mọi thanh trượt.** Mỗi núm số có thêm ô gõ số + ghi chú "Nhỏ nhất … – lớn nhất
  …". Gõ xong rời ô / Enter mới chốt: làm tròn theo `step`, kẹp trong `[min, max]`.
- **Cảnh báo vượt cỡ.** Chế độ "từng cột/tầng" có thể đẩy tổng tủ vượt giới hạn (rộng 2400 /
  cao 2200mm) → hộp cảnh báo hổ phách ở đầu sidebar. CHỈ cảnh báo, KHÔNG chặn — 3D + giá vẫn chạy.

**Hợp đồng `types.ts` — thêm 3 field TÙY CHỌN** (sản phẩm cũ không cần sửa gì):
`Parameter.stepId?` (id bước wizard) · `ProductDNA.steps?` (danh sách bước) ·
`ProductDNA.getWarnings?(values)` (trả câu cảnh báo). DNA KHÔNG khai báo `steps` →
Configurator vẫn vẽ phẳng như cũ → engine vẫn tổng quát cho sản phẩm sau.

**Bẫy đã gặp:** `Parameter` ĐÃ CÓ field `step` (= bước nhảy thanh trượt, kiểu số). Field
wizard phải đặt tên KHÁC → dùng `stepId`. `tsc` bắt ngay vụ trùng tên.

**Đã verify:** `tsc --noEmit` pass · `pnpm validate` 32/32 (geometry không đổi) · kiểm trình
duyệt: 3 bước đúng núm + đúng nút điều hướng, nhảy bước, "Làm lại bước này" reset đúng, gõ
tay `9999` → kẹp `600`, cảnh báo hiện khi tủ 5 cột × 700mm (3608 > 2400) và tự mất khi sửa lại.

## ✅ 5 cải tiến sản phẩm (sau wizard, founder duyệt)

Founder duyệt mở rộng engine (chỉ-thêm-không-phá). Sửa 7 tệp; `build()` chỉ đổi phần lỗ
tay nắm + thêm chân tủ — khung hình học KHÔNG đổi (validator vẫn 32/32).

1. **Ô "mở không hậu" khoá ô màu.** `cells` có ô open-nobk → ô tương ứng lưới `cellColors`
   hiện TRẮNG, không bấm được. `Parameter.lockedCells?`; `resolveControls` tính; `CellGridControl` vẽ.
2. **Chân tủ tự động.** 2 chân (trước + sau) mỗi vách đứng → `2×(cột+1)` chân. Kênh mới
   `BuildResult.fittings?` + kiểu `Fitting` (vật thể 3D KHÔNG phải tấm cắt); `renderer.tsx`
   `FittingMesh` vẽ trụ tròn; `build()` nhấc cả tủ lên `FOOT_H=5mm` để chân nằm giữa sàn
   và đáy. Phụ kiện `foot` (đơn giá 5k/`pricing.ts`) + ghi chú vị trí ở bảng cắt
   (`Hardware.notes?`); tấm đáy cũng có ghi chú khoan chân.
3. **Cánh đơn — tay nắm ghép cặp.** `singleDoorHandleSign()`: ghép cặp cột từ phải; cột
   trái của cặp → tay nắm phải, cột phải → trái (quay vào nhau); số cột lẻ → cột ngoài
   cùng trái thừa, tay nắm hướng vào trong.
4. **Ô cao → tay nắm sát đáy.** Cánh có đáy ô ≥ `LOW_HANDLE_FROM_GROUND=1200mm` (tính từ
   SÀN, đã cộng `FOOT_H`) → lỗ tay nắm sát cạnh DƯỚI. Áp cả cánh đơn lẫn đôi.
5. **Vân veneer per-ván.** `renderer.tsx makePartGrain()`: mỗi ván veneer 1 texture clone
   riêng — `RepeatWrapping` + `repeat` theo kích thước thật (không co giãn) + xoay cho vân
   chạy dọc cạnh DÀI + `offset` băm từ `id` (random nhẹ, ổn định, không nhấp nháy).

**`types.ts` thêm (đều TÙY CHỌN):** `Parameter.lockedCells?` · `Hardware.notes?` · `Fitting`
+ `BuildResult.fittings?`. **`cutlist.ts`/`pricing.ts`:** `HardwareRow.notes?`, đơn giá `foot`.

**Giá mặc định: 6.413.453 → 6.477.453₫** (thêm 8 chân × 5k × margin 1.6 = +64k). `BASELINE`
trong `validate-dna.ts` đã cập nhật theo.

**Đã verify:** `tsc` pass · `pnpm validate` 32/32 · gọi `build()` kiểm tay nắm — 5 cột cánh
đơn dx = +,+,−,+,− (Mục 3 ✓); tủ 4 tầng cao 2200 → 3 tầng dưới tay nắm trên, tầng trên cùng
tay nắm dưới (Mục 4 ✓) · DOM — ô "mở không hậu" → ô màu khoá trắng (Mục 1 ✓), bảng cắt
"Chân tủ ×8" + ghi chú (Mục 2 ✓). Vân veneer (5) + dáng chân 3D render đúng; chi tiết thẩm
mỹ (hướng vân, dáng chân) nên xem trực tiếp trên preview.

## ✅ Mặc định mới + Deploy GitHub Pages (founder duyệt — ngoài roadmap)

Founder muốn (a) lấy cấu hình tủ đang xem làm mặc định, (b) đăng bản demo lên GitHub Pages
để chia sẻ. Làm trước khi vào Session 4.

**Mặc định mới** (`products/tu-ke/dna.ts`): tủ **1900 × 2200 × 350mm · 4 cột × 6 tầng ·
khung MDF Đen** — 2 tầng dưới ngăn kéo (xanh lá), 2 tầng giữa mở-không-hậu, 2 tầng trên
cánh (vàng). Đổi `default` các núm + thêm 2 mục SEED `cells`/`cellColors` vào `parameters`
(`DEFAULT_CELLS` / `DEFAULT_CELL_COLORS`). Mốc `BASELINE` trong `validate-dna.ts` cập nhật:
**18.646.803₫ · 101 tấm · 16.54 m²**.

**Static export + GitHub Pages:**
- `next.config.ts`: `output: 'export'` (→ thư mục `out/`) · `images.unoptimized` ·
  `trailingSlash`. `basePath: '/furniture-brand'` **chỉ bật khi `process.env.GITHUB_PAGES`
  === 'true'** → preview / local vẫn chạy ở '/'.
- `.github/workflows/deploy.yml`: push lên `main` → GitHub Actions tự build (`pnpm build`
  với `GITHUB_PAGES=true`) + deploy lên Pages.
- `package.json`: thêm `packageManager: pnpm@10.33.4` (cho `pnpm/action-setup` ở CI).
- `layout.tsx`: `metadata` tiêu đề "Tủ kệ Module — Thiết kế tủ 3D" + `lang="vi"` (thay mặc
  định "Create Next App"). SEO đầy đủ vẫn để Session 4.
- Repo **public**: `github.com/hsonvu1912/furniture-brand`. Demo:
  **https://hsonvu1912.github.io/furniture-brand/**
- `out/` đã trong `.gitignore` → CI build mới, không commit. Sửa mã → push `main` là web tự
  cập nhật.

## ✅ Bảng cắt thêm cân nặng (founder duyệt — bổ sung sau deploy)

Bảng cắt giờ hiện CÂN NẶNG mỗi dòng tấm + mỗi phụ kiện + tổng toàn tủ.

- `pricing.ts`: thêm `MATERIAL_DENSITY_KG_PER_M3` (mdf_son 720 · plywood_veneer 600 —
  *tạm, founder sẽ chỉnh*) + `HARDWARE_WEIGHT_KG` (hinge 0.06 · drawer-slide 0.55 · foot
  0.005 · handle 0.04) + helpers `materialDensityKgPerM3()` / `hardwareWeightKg()`.
- `cutlist.ts`: `CutlistRow` / `HardwareRow` thêm `weight_kg`; `Cutlist` thêm
  `totalWeightKg`; `buildCutlist` tính ngay trong vòng gộp (cân nặng dòng = thể tích ×
  mật độ × qty cho ván; cân nặng dòng = đơn cân × qty cho phụ kiện).
- `Configurator.tsx` (`CutlistPanel`): bảng thêm cột "Cân"; dòng tóm tắt thêm `· X.X kg`;
  mỗi phụ kiện hiện thêm kg.

**Mặc định: 198.1 kg** (192.7 kg ván + 5.41 kg phụ kiện — 16 bản lề · 8 ray · 10 chân).
Validator vẫn 32/32 — hình học/giá không đổi; chỉ thêm field tùy chọn vào `Cutlist`.

## ✅ Mở rộng giới hạn ô + bản lề thông minh + note vách (founder duyệt — 2026-05-20)

Founder duyệt mở rộng kích thước cho phép của 4 loại ô, kèm fallback chuỗi và ghi
chú vị trí phụ kiện trên vách. Sửa CHỈ `products/tu-ke/dna.ts` (sản phẩm) +
`scripts/validate-dna.ts` (test). Engine `src/configurator/` KHÔNG đụng.

- **Hằng số mới** trong `dna.ts`: `COL_MAX 700→1200` · `TIER_MAX 900→2400` ·
  `WIDE_CELL 500→600` · MỚI: `DOOR_MAX_WIDTH=1200` (cánh đôi tối đa) ·
  `DOOR_MAX_HEIGHT=2400` (cao cánh tối đa) · `DRAWER_MAX_WIDTH=900` (rộng ngăn kéo
  tối đa). Param `height.max 2200→2400`.
- **4 loại ô — giới hạn độc lập:**
  - Cánh đơn: rộng 250–600mm · cao tới 2400mm
  - Cánh đôi: rộng 600–1200mm · cao tới 2400mm (tự tách 2 lá khi cột > `WIDE_CELL`)
  - Ngăn kéo: rộng 250–900mm · cao tới 400mm · đỉnh ≤ 1200mm
  - Mở-có-hậu / mở-không-hậu: rộng 150–1200mm · cao 150–2400mm
- **Fallback chuỗi** trong `build()` (UI lưới đã ẩn sẵn, đây là phòng hờ): `drawer`
  vượt ngưỡng (đỉnh/cao/rộng) → `door`; `door` vượt ngưỡng (rộng > 1200 hoặc cao
  > 2400) → `open-back`; cột < 250mm → cả cánh + ngăn kéo về `open-back`.
- **Bản lề theo chiều cao cánh** (mỗi lá, helper `hingeCount(faceH)`):
  <1200mm: 2 · 1200–<1800mm: 3 · 1800–<2200mm: 4 · 2200–2400mm: 5.
  Vị trí (`hingeYOnDoor`): tâm 1+N cách đầu/đuôi 100mm, các bản lề giữa chia ĐỀU.
- **Note vách đứng** (`Part.notes` cho `divider-c{k}-r{r}`): helper `dividerNote(k,r)`
  trong `build()` quét ô bên TRÁI (mép phải vách) + bên PHẢI (mép trái vách) →
  ghép chuỗi bản lề/ray với toạ độ Y (mm từ ĐÁY vách, đã bù FRONT_GAP/2):
  - Cánh đơn sign=±1 (theo `singleDoorHandleSign`) chỉ note ở vách mép bản lề;
    cánh đôi note ở CẢ 2 vách (mép ngoài 2 lá); ngăn kéo note ray ở CẢ 2 vách.
  - VD: `"Bản lề ô (T5,C2) cánh đơn — 2 cái: Y = 102, 244mm | Ray hộc ô (T0,C1) — 1 cặp tâm Y = 173mm"`.
  - `cutlist.ts` gộp tấm theo `notes` (đã sẵn) → vách có notes khác nhau tự thành
    dòng riêng — không cần đụng engine.
- **Note cánh** cũng kèm phần "X bản lề mép trái/phải" để xưởng đỡ phải tra ngược.

**Đã verify:** `tsc --noEmit` pass · `pnpm validate` 32/32 · BASELINE giữ nguyên
**18.646.803₫ · 101 tấm · 16.54 m²** (default 4 cột × 6 tầng → ô ~452×342mm,
faceH=342 < 600 → vẫn cánh đơn 2 bản lề · tổng 16 bản lề như cũ). UI: slider rộng
max 2400, cao max 2400 (xác nhận trực tiếp trên preview); cutlist hiện đúng 10
note bản lề + 16 note ray cho cấu hình mặc định.

**Bẫy đã gặp:** validator case "Phủ 4 loại ô + cánh đôi" cũ dùng 1800mm/3 cột →
~576mm. WIDE_CELL nâng từ 500 → 600 khiến 576 < 600 → KHÔNG còn là cánh đôi. Đã
nâng width case này lên 2000mm (ô ~642mm, vẫn vượt 600).

## ✅ Chốt kệ + vít hậu — note vị trí khoan trên tấm ngang (founder duyệt — 2026-05-20)

Founder yêu cầu mỗi tấm ngang (đáy, nóc, kệ) phải có chỉ định vị trí khoan để xưởng
biết bắt chốt âm cho vách đứng + vít cố định tấm hậu. Sửa CHỈ `products/tu-ke/dna.ts`.

- **Hằng số mới:** `PIN_DIA=5` · `PIN_DEPTH=11` · `PIN_INSET_FB=50` (chốt cách
  cạnh trước/sau) · `BACK_SCREW_MARGIN=30` (vít hậu cách mép trái/phải tấm hậu).
- **Quy ước khoan:**
  - **Đáy** (r=0): chốt + vít hậu khoan mặt TRÊN. Vít hậu Ø3 sâu 9mm.
  - **Nóc** (r=rows−1): chốt + vít hậu khoan mặt DƯỚI. Vít hậu Ø3 sâu 9mm.
  - **Kệ giữa tầng g & g+1**: chốt CẢ 2 MẶT (trên + dưới). Vít hậu XUYÊN qua kệ
    (Ø3 xuyên 18mm) tại hợp các ô có hậu của 2 tầng kề.
- **Toạ độ trong note:** chốt tại `X = vachX[k]` cho mỗi vách, `Z = ±(D/2 − PIN_INSET_FB)`
  (default D=350 → Z=±125mm). Vít hậu tại tâm tấm hậu `Z = −(D − T_BACK)/2`
  (default = −170mm), mỗi ô có hậu 2 lỗ `X = xC ± (cw/2 − 30)`.
- **Helper:** `cellsWithBackOnRow(r)` (ô không phải `open-nobk`) · `formatBackX(cols)`
  (cặp X "trái/phải" cho mỗi ô) · `buildHoleNote(mode, backCols)` (sinh chuỗi note theo
  mode `bottom|top|shelf`).
- **Tác động cutlist:** kệ giữa giờ có thể có notes KHÁC NHAU theo cấu hình hậu của
  2 tầng kề → cùng kích thước/vật liệu nhưng tách dòng. Default 6 tầng → 5 kệ giữa,
  4 kệ có hậu cùng note (qty=4) + 1 kệ không hậu (giữa 2 tầng "mở-không-hậu") thành
  dòng riêng. Tổng diện tích / giá / cân **KHÔNG đổi** — BASELINE 18.646.803₫.
- **KHÔNG render 3D**: lỗ chốt Ø5 và vít hậu Ø3 quá nhỏ, không vẽ ra `Part.holes`.
  Notes chỉ phục vụ bảng cắt (xưởng).

**Đã verify:** `tsc` pass · `pnpm validate` 32/32 · DOM preview: 4 dòng "Chốt kệ"
(đáy mặt TRÊN, nóc mặt DƯỚI, kệ-có-hậu CẢ 2 MẶT, kệ-không-hậu CẢ 2 MẶT) + 3 dòng
"Vít hậu" (đáy sâu 9, nóc sâu 9, kệ XUYÊN) cho cấu hình mặc định.

**Bẫy đã gặp:** đặt `const backZ = ...` trong helper trùng tên biến `backZ` đã có ở
phần vẽ tấm hậu phía sau build() (TS2451). Đổi thành `backScrewZ` để khác phạm vi.

## ✅ Hot-fix: cell fallback chuỗi phải chạy trong normalizeValues (2026-05-20)

**Bug founder báo:** ngăn kéo cột rộng > 900mm không fallback về cánh trong UI — vẫn
hiển thị "mở-có-hậu". Build() có fallback chuỗi nhưng KHÔNG hiệu lực vì
`Configurator.tsx` chạy `reconcileCellGrid(...)` TRƯỚC khi gọi `build()`. Reconcile
dùng `options[0]?.value = 'open-back'` làm fallback cứng → "nuốt" `drawer` thành
`open-back` trước khi build() có cơ hội fallback sang `door`.

**Fix:** đẩy logic fallback chuỗi (giống hệt `cellType` trong build()) vào
`normalizeValues` của DNA. Configurator gọi `normalizeValues` ở `setParam` và
`initialValues` — chạy TRƯỚC reconcile → cells đã thành 'door' khi reconcile xét →
'door' không bị cấm bởi `disabledByCol` ở mức `w > 900` → giữ nguyên. KHÔNG đụng
engine `src/configurator/`.

Logic fallback ở build() (cellType) GIỮ NGUYÊN — vẫn là chốt cuối phòng hờ khi
build() được gọi bypass normalize (validator raw mode + test offline).

**Đã verify:** `tsc` pass · `pnpm validate` 32/32 · test offline bằng tsx eval:
- (w=1000, h=350) drawer → door ✓
- (w=800, h=350) drawer → drawer (giữ) ✓
- (w=1000, h=664) drawer → door (vì cao vi phạm trước) ✓

## ✅ Validator: thêm pipeline test (2026-05-20)

Sau hot-fix vừa rồi, bổ sung 1 nhóm test mới trong `scripts/validate-dna.ts` mô phỏng
FULL chuỗi Configurator (`normalize → reconcileCellGrid → build`) — để chặn bug
"build() đúng nhưng UI sai" trong tương lai.

- Hàm `runPipeline(overrides)` chạy đúng pipeline UI. Hàm `runPipelineCase` đếm part
  theo label và so với `expect` (số chính xác hoặc range `{min, max}`).
- 6 case (hiện ĐẠT 6/6):
  1. Drawer cw=1000 → cánh đôi (drawer→door qua DRAWER_MAX_WIDTH=900, 1000>600 thành 2 lá)
  2. Drawer cw=700 → GIỮ drawer (700 < 900; WIDE_CELL=600 KHÔNG áp cho ngăn kéo)
  3. Drawer h=600 → cánh đơn (h>400 vi phạm)
  4. Boundary cw=1200 → cánh đôi hợp lệ (giáp DOOR_MAX_WIDTH, kiểm off-by-one)
  5. Drawer ở tầng cao đỉnh>1200 → cánh đơn (top>DRAWER_MAX_TOP)
  6. Sanity default → 8 drawer + 8 door

- Output: `32/32 build · 6/6 pipeline · tự kiểm ĐẠT`.
- **Insight bộc lộ qua test**: `sizeSlider` khoá max ở COL_MAX=1200 → ở UI thực tế
  fallback `door → open-back` qua chiều rộng KHÔNG BAO GIỜ kích hoạt. Logic đó chỉ
  là defensive net cho call `build()` raw bypass normalize.

## ✅ Size ray ngăn kéo theo chiều sâu tủ (2026-05-20)

Founder yêu cầu ghi rõ size ray ngăn kéo (chuẩn xưởng VN: {250, 300, 350, 400, 450,
500}mm) trong cutlist, kèm kích thước thùng hộc tương ứng.

- **Helper mới** `slideSizeForDepth(D)` trong dna.ts. Quy tắc HYBRID:
  - D bội 50 → `floor((D-50)/50)*50` (an toàn, ray ≤ thùng)
  - D lẻ     → `round((D-50)/50)*50` (gần nhất, xưởng khớp khe hở)
  - Kẹp trong [250, 500].
- Mapping: D=300→250 · 350→300 · 400→350 · 450→400 · 500→450 · 550→500 · 600→500.
- **3 chỗ note thêm size ray:**
  - Mặt ngăn kéo: `Thùng hộc 427×322×284mm (rộng×cao×sâu) · Ray 300mm`
  - Vách đứng: `Ray hộc ô (T1,C1) 300mm — 1 cặp tâm Y = 173mm`
  - Hardware label: `Ray ngăn kéo 300mm (bộ)` (đổi từ `Ray ngăn kéo (bộ)`)
- **KHÔNG đụng geometry**: `bd` thực tế và size ray có thể chênh vài mm; xưởng tự
  điều chỉnh khe hở `SLIDE_GAP=13mm`. Pricing không đổi vì gộp theo `id='drawer-slide'`.
- Pipeline test 6/6 + BASELINE 18.646.803₫ giữ nguyên.

## ✅ Stateful intent: ô lưới hồi phục khi kích thước trở lại hợp lệ (2026-05-20)

**Founder báo:** khi đặt ô = ngăn kéo/cánh, kéo cột rộng vượt giới hạn, ô bị fallback
về "mở-có-hậu" → kéo cột ngược lại trị hợp lệ, ô KHÔNG hồi phục về ngăn kéo/cánh.
Mất "ý định" của khách.

**Nguyên nhân:** `normalizeValues` ghi đè `values.cells` thành kết quả fallback → mất
dữ liệu gốc. `reconcileCellGrid` dùng `options[0]='open-back'` làm fallback cứng.

**Fix — tách INTENT vs EFFECTIVE (additive, founder duyệt mở rộng engine):**

1. **`types.ts`** (+1 field): `Parameter.cellFallbackMap?: Record<string, string>` —
   map giá trị → fallback riêng khi bị banned.
2. **`cellgrid.ts`** (+1 param): `reconcileCellGrid(...cellFallback={})`. Khi banned
   → dùng `cellFallback[cell] ?? fallback`.
3. **`Configurator.tsx`** (+1 useMemo):
   - `intentValues`: cellgrid CHỈ pad size (KHÔNG áp disabled rules) — giữ ý định.
   - `resolvedValues`: cellgrid áp đầy đủ disabled + cellFallbackMap (cho build).
   - `<ParamControl value=...>` đổi từ `resolvedValues` → `intentValues` (UI lưới
     hiển thị intent). Build và warnings vẫn dùng resolvedValues.
4. **`dna.ts`**: cells param thêm `cellFallbackMap: { drawer: 'door' }`. Bỏ phần
   fallback cells trong `normalizeValues` (giờ reconcile lo). cellType trong build()
   GIỮ NGUYÊN làm defensive net.
5. **`validate-dna.ts`** `runPipeline`: truyền `c.cellFallbackMap` vào reconcile để
   mirror UI behavior.

**User flow sau fix (offline simulation đã verify):**
| Bước | values.cells | UI lưới | build vẽ |
|------|---------------|---------|-----------|
| Đặt drawer cw=500 | drawer | 🟦 ngăn kéo | ngăn kéo |
| Kéo cw=1000 | drawer (giữ) | 🟦 ngăn kéo | cánh đôi |
| Kéo về cw=500 | drawer (giữ) | 🟦 ngăn kéo | ngăn kéo ✓ |

**Đã verify:** `tsc` pass · `pnpm validate` 32/32 + 6/6 pipeline · BASELINE
18.646.803₫ giữ. Engine mở rộng additive, sản phẩm cũ không cần thay đổi (field +
param mới đều optional, default về behavior cũ).

## ✅ Màu hậu cánh/ngăn kéo + Ký hiệu cánh đơn/đôi + hướng (2026-05-20)

**2 yêu cầu founder:**
(1) Hậu của ô cánh/ngăn kéo phải lấy MÀU KHUNG, không theo cellColors (tránh đặt
ván phụ khách không nhìn thấy). Ô mở-có-hậu vẫn dùng cellMaterial (hậu là điểm tô).
(2) Ký hiệu UI lưới phải phản ánh cánh đơn (hướng bản lề) và cánh đôi (2 lá).

**Phần A — Màu hậu** (dna.ts only, không đụng engine):
```ts
const backMaterial = type === 'door' || type === 'drawer' ? frameMaterial : cm;
```
→ Mở-có-hậu: hậu = màu ô. Cánh/ngăn kéo: hậu = màu khung. Mở-không-hậu: không tấm.

**Phần B — Icon variant** (engine mở rộng additive, founder duyệt):
- **`types.ts`** (+1 field): `Parameter.cellSymbolByPosition?: string[][]` — ma trận
  symbol per-cell, override mặc định = value. Sản phẩm cũ không cần thay đổi.
- **`Configurator.tsx CellSymbol`**: thêm 3 case
  - `door-L`: tam giác đỉnh TRÁI (bản lề trái, tay nắm phải, sign=+1)
  - `door-R`: tam giác đỉnh PHẢI (bản lề phải, tay nắm trái, sign=-1)
  - `door-double`: 2 tam giác đỉnh quay vào TRỤC GIỮA (cánh đôi, bản lề 2 mép ngoài)
  - `door` (giá trị value gốc, không có hint) vẫn vẽ như `door-L` để tương thích.
  - `drawer` X giữ nguyên (founder chốt giữ).
- **`Configurator.tsx` render**: `const symbol = param.cellSymbolByPosition?.[r]?.[c] ?? v`
  → CellSymbol nhận `symbol` thay vì `v`.
- **`dna.ts resolveControls`**: cells param thêm `cellSymbolByPosition` ma trận:
  ```ts
  if (t !== 'door') return t;
  if (colWidths[c] > WIDE_CELL) return 'door-double';
  return singleDoorHandleSign(c, columns) > 0 ? 'door-L' : 'door-R';
  ```

**Đã verify trên preview:** default 4×6 → tầng cánh có 8 polyline xen kẽ `100,0 0,50
100,100` (L) và `0,0 100,50 0,100` (R), tầng ngăn kéo có 8 path X. tsc + validate
32/32 + 6/6 pipeline pass · BASELINE 18.646.803₫ giữ.

**Lưu ý dọn dẹp:** `typeGrid` parse được di chuyển TRƯỚC `list.push(cells)` để tận
dụng cho cả `cellSymbolByPosition` (cells) và `lockedCells` (cellColors).

## 📦 Sub-cells PARKED → branch `feature/sub-cells` (2026-05-21)

Sub-cells (1D split bên trong ô open-back/open-nobk) đã được implement đầy đủ và
verify ở 2 commit `96d2718` + `0ddce71`. Sau đó founder quyết định **PARK feature
này** để tập trung MVP website (Session 4) trước, sẽ resume sau khi MVP hoàn thành.

**Đã làm trên main:**
- `git revert HEAD HEAD~1` → 2 commits revert `d48cd4b` + `e5d1793` đưa main về
  trạng thái pre-sub-cells (tương đương commit `d51a0e7`).
- Snapshot đầy đủ ở branch `feature/sub-cells` (push lên origin). Main không có
  `subgrid.ts`/`subgrid-constants.ts`/`subCells`/`subCellColors`/`SPLIT`/etc.

**Khi resume Phase 1 sub-cells:**
```bash
git checkout main
git merge feature/sub-cells   # hoặc rebase tuỳ ý
# Hoặc revert lại 2 commit revert:
git revert d48cd4b e5d1793
```

**Trạng thái sau revert đã verify:** `32/32 build + 6/6 pipeline + tự kiểm ĐẠT` ·
BASELINE `18.646.803₫ · 101 tấm · 16.54 m²` · tsc pass. Engine pre-sub-cells:
- `Configurator.tsx`: chỉ có `intentValues` + `resolvedValues` (no setParamBatch)
- `types.ts`: KHÔNG có `subGridAllowed`/`subContainerValue`/`subGridSourceId`/
  `cellVariant='subgrid'`
- `cellgrid.ts`: 6 tham số (KHÔNG có `cellFallback` map)... đợi — `cellFallback`
  vẫn còn (đã merge trước sub-cells). Chỉ những gì sub-cells thêm bị revert.
- DNA `dna.ts`: trở lại loop cell trực tiếp (KHÔNG có `buildOneCell` extract).

**Lý do park (founder, 2026-05-21):** MPV cần website + SEO trước để có demo public
hoàn thiện cho khách. Sub-cells là feature mở rộng — có thể đẩy lên sau khi
website ổn.

## ✅ Session 4 — Brand foundation + landing page (XONG 2026-05-21)

Brand **"KÊ. by màumè"** (founder đổi tên từ "KÊ by Màumè" → có dấu chấm sau KÊ,
"màumè" viết thường) — fonts, design tokens, header/footer/landing dựng xong, configurator
đã move sang `/design`. Engine `src/configurator/` KHÔNG đụng. Sản phẩm `tu-ke` chỉ đổi
DEFAULT (3×2 mở-có-hậu). Validator BASELINE cập nhật theo.

### Brand assets (`public/fonts/`)
COPY thủ công 15 file WOFF2 từ `/Users/hsonvu/CLAUDE/maume/public/fonts/`:
- **SVN-CabinetGrotesk** 5 weights (Regular/Medium/Bold/Extrabold/Black) — load qua
  `next/font/local` trong `layout.tsx` → biến `--font-cabinet` (heading + body).
- **BeVietnamPro** 5 weights × 2 subset (latin + viet) — load qua `@font-face` thủ
  công trong `globals.css` (cần unicode-range để chia tải payload). Utility class
  `.font-viet` apply cho đoạn văn tiếng Việt.

### globals.css (Tailwind 4 syntax, KHÔNG copy tailwind.config.ts)
- `@theme inline { --color-brand-coral/yellow/teal/blue/purple/pink, --color-bg-body,
  --font-sans (=cabinet), --font-viet }` → sinh utility `bg-brand-coral`, `text-brand-blue` v.v.
- `:root { --gradient: linear-gradient(45deg, 5 màu màumè) }`.
- `body { background: #FDFBF7; color: #1a1a1a; font-family: var(--font-cabinet) }`.
- Utility `@layer utilities`: `.gradient-text`, `.gradient-bg`, `.font-viet`,
  `.page-color-coral/amber/teal/blue/purple/pink`.
- `.logo-hover` + keyframe `logo-color-shift` — gradient chạy 360° khi hover (port từ maume).

### Components mới (`src/components/`)
- **`KeLogo.tsx`** (server) — wordmark "KÊ." (lớn) + "by màumè" (nhỏ), cả 2 dòng đều
  `gradient-text` (founder chốt: full gradient màumè). Prop `size: 'sm'|'md'|'lg'` cho
  header/footer/hero reuse.
- **`Header.tsx`** (`"use client"` — mobile menu state) — sticky top, KeLogo size=md trái,
  3 nav links phải (Bộ sưu tập / Thiết kế tự do / Liên hệ), hamburger mobile + overlay
  full-screen + ESC close. KHÔNG có cart/wishlist như maume (KÊ chưa có shopping).
- **`Footer.tsx`** (server) — KeLogo size=sm + tagline "Tủ kệ tham số · xưởng Việt Nam",
  social IG/FB của thương hiệu mẹ màumè + email `maume.decor@gmail.com` (chung), nav 3
  links, copyright + "Thiết kế Việt Nam". Bỏ wishlist/threads icon so với maume.
- **`Hero.tsx`** (server) — heading "KÊ." gradient siêu lớn (text-6xl → 9xl responsive) +
  mô tả "Tủ kệ tham số. Bạn chỉnh — 3D đổi ngay — giá hiện ngay — xưởng làm sẵn." +
  2 CTA "Thiết kế tự do →" (đen pill) + "Xem bộ sưu tập" (outline pill). Founder
  chốt KHÔNG cần tagline phụ thêm.
- **`ValueProps.tsx`** (server) — section "Vì sao KÊ." + 3 cột: Tham số hoá / 3D realtime
  / Cut-list xưởng (mỗi cột accent màu coral/teal/blue từ palette gradient).

### Routes
- **`/` (rewrite)** — landing: Header + Hero + ValueProps + Footer. Server component, không
  load Three.js → render nhanh.
- **`/design` (mới)** — Configurator full-screen, `next/dynamic(..., ssr:false)` import động
  (Three.js cần API trình duyệt). KHÔNG có Header/Footer ở đây để Configurator full-bleed
  tận dụng tối đa space cho 3D.

### `layout.tsx`
Đổi từ Geist (Next default) sang Cabinet Grotesk (next/font/local). Metadata title
`KÊ. by màumè — Tủ kệ thiết kế 3D` + template `%s · KÊ. by màumè` + OpenGraph + Twitter
card + `robots: index,follow`. SEO foundation đầy đủ vẫn chờ S6 (sitemap/robots.ts/OG image).

### DNA `tu-ke` — default 3×2 (founder chốt)
- `columns.default: 4 → 3` · `rows.default: 6 → 2`.
- `DEFAULT_CELLS`: 2×3 mảng, tất cả `open-back` (6 ô mở-có-hậu, kệ trống lớn).
- `DEFAULT_CELL_COLORS`: tất cả `FRAME_COLOR` (ăn theo khung — clean minimalist).
- Founder chốt "kệ trống lớn" → vibe starter cho landing visitor lần đầu, chưa kéo gì.

### BASELINE mới (`scripts/validate-dna.ts`)
- Cũ (4×6 mix drawer/open-nobk/door): **18.646.803₫ · 101 tấm · 16.54 m²**.
- Mới (3×2 mở-có-hậu hết): **8.160.145₫ · 17 tấm · 8.92 m²**.
- Sanity pipeline case "default" cập nhật từ `8 drawer + 8 door` → `6 mở-có-hậu`
  (`'Mặt ngăn kéo': 0, 'Cánh tủ': 0, 'Tấm lưng': 6`).

### Verify (done-criteria ✅)
- `pnpm tsc --noEmit` pass.
- `pnpm validate` → **32/32 build · 6/6 pipeline · tự kiểm ĐẠT** · BASELINE khớp.
- Preview browser:
  - `/` — Header logo gradient + Hero "KÊ." gradient + 2 CTA + ValueProps 3 cột accent +
    Footer đúng. Không console error.
  - `/design` — Configurator load OK, default Số cột=3, Số tầng=2, 6 ô mở-có-hậu, canvas
    Three.js render 3D đúng, sidebar wizard 3 bước hoạt động.

### Decisions đã chốt ở đầu S4
- **Brand name**: "KÊ. by màumè" (founder đổi tên, dấu chấm + lowercase màumè).
- **Accent**: full gradient màumè cho cả "KÊ." và "by màumè" (option gradient).
- **Tagline**: KHÔNG cần tagline phụ (Hero chỉ có heading + 1 dòng mô tả).
- **Default 3×2**: 6 ô đều mở-có-hậu (kệ trống lớn).

### ⚠️ Bẫy đã gặp (Turbopack cache)
Lần đầu chạy `preview_start` sau khi sửa `globals.css`, body bg vẫn `#0A0A0A` + font
Arial của globals.css CŨ. `window.location.reload()` không fix. Phải `rm -rf .next` rồi
restart preview → Tailwind 4 + PostCSS re-compile từ source mới. Bài học: khi đụng
`globals.css` hoặc `@theme` tokens, restart preview với cache wipe.

### ✅ Polish responsive (sau S4, founder yêu cầu audit lại với maume — commit d49552b)

Founder phản hồi: "kiểm tra kỹ thiết kế maume để làm tổng thể giống và đồng bộ
sm/md/lg". Audit lại maume landing page (`src/app/page.tsx` + HeroGallery +
HomeFeatured + LayoutShell). 12 fixes đồng bộ pattern maume:

- **PageWrapper.tsx** mới: outer `max-w-[1920px]` + shadow 2 bên (đặc trưng "card
  floating" của maume). Body bg đổi `#FDFBF7` → `bg-neutral-100` (lộ shadow trên
  ultrawide). globals.css body bỏ `background` để class win.
- **Header height mobile**: `h-16` → `h-14` (đúng maume). Outer thêm `max-w-[1920px]`.
- **Hero typography**: `text-6xl md:text-8xl lg:text-9xl` → `text-5xl md:text-7xl`
  (bỏ lg breakpoint thừa). Subheading `md:text-2xl` → `md:text-xl`.
- **Buttons**: `rounded-full font-medium` → flat `font-semibold tracking-wide` +
  UPPERCASE "THIẾT KẾ TỰ DO" / "XEM BỘ SƯU TẬP" (đúng pattern maume).
- **Section padding**: `py-16 md:py-24` mix → `py-20` flat. mb section heading
  `mb-10 md:mb-14` → `mb-10` flat. Footer `mt-16 md:mt-24` → `mt-20` flat.
- **ValueProps**: thêm caption `<p className="text-sm text-neutral-400 mt-1">3 giá
  trị cốt lõi</p>` (pattern maume Available/Archive section heading).
- **Hero 2-col layout**: `grid-cols-12` desktop (text col-7 + gradient panel col-5
  `aspect-[4/5]` mô phỏng vị trí hero image maume). Mobile `hidden md:block` —
  text-only single col, panel ẩn.
- **Mobile menu links**: thêm `hover:page-color-coral/teal/blue` accent per link
  (pattern maume mobile menu).
- **KeLogo**: subtext "by màumè" mobile bị stretch → thêm `w-fit` + `self-end`
  cho gọn lại theo width text dài nhất.

**Verify (4 breakpoint):**
- **375 sm**: header h-14 compact, logo gọn không stretch, hero 1 col text-only
  + buttons stack vertical, gradient panel ẩn.
- **768 md**: hero 2 col text/panel cân, ValueProps 3 col accent.
- **1280 lg**: wrapper hết viewport (max-w-[1920px] match), không thấy shadow.
- **1920 xl ultrawide**: wrapper full + neutral-100 lộ 2 bên + shadow effect.
- **Mobile menu**: hamburger→X transition, 3 link accent hover.
- **/design** vẫn full-bleed (không có PageWrapper) — Configurator nguyên vẹn.

## ✅ Session 5 — Preset library + filter UI (XONG)

5 preset tủ kệ pre-configured + trang catalog `/collection` + detail page per
preset với JSON-LD Product schema + `/design?preset=<slug>` load preset values
vào Configurator qua **engine extension `initialValues?` prop** (additive, founder
duyệt). KHÔNG đụng `src/configurator/` lõi — chỉ thêm prop optional vào hàm
`Configurator`.

### 5 preset (`products/tu-ke/presets.ts`)

| Slug | Tên | KT (W×H×D mm) | Grid | Giá | Tấm | m² | kg |
|---|---|---|---|---|---|---|---|
| `compact` | KÊ. Compact | 800×1200×350 | 2×3 | 5.204.049₫ | 31 | 4.48 | 53 |
| `studio` | KÊ. Studio | 1500×1800×350 | 3×4 | 7.101.715₫ | 36 | 8.05 | 78 |
| `loft` | KÊ. Loft | 2000×2400×400 | 4×6 | 26.396.148₫ | 129 | 24.23 | 283 |
| `tall` | KÊ. Tall | 600×2200×350 | 1×6 | 4.157.620₫ | 30 | 4.76 | 45 |
| `wide` | KÊ. Wide | 2400×900×350 | 5×2 | 6.835.732₫ | 27 | 6.62 | 74 |

**Lưu ý design specs:** Drawer cần ô cao ≤400mm + đỉnh ≤1200mm. Studio/Wide với
h=450 → KHÔNG có drawer, dùng mix door+open-back+open-nobk thay. Loft 4×6=400/tầng
chính xác ngưỡng drawer → 3 hàng dưới drawer (12 ngăn kéo).

### Script `scripts/generate-presets.ts` (`pnpm generate-presets`)
Chạy `build()` + `computePrice()` + `buildCutlist()` cho mỗi preset → in bảng giá
+ xuất `public/presets-index.json` (5 preset · 2.4KB). JSON precompute để runtime
filter sau nếu cần (S5 hiện chưa dùng vì server compute build-time).

### Engine extension `Configurator` — ADDITIVE
Thêm prop `initialValues?: Partial<ParamValues>` cho Configurator. State init merge
default (từ `dna.parameters[*].default`) với override (preset values), bỏ qua key
undefined. Sản phẩm cũ KHÔNG truyền → vẫn dùng default như trước (backward compat
100%). Engine bất biến với cách dùng cũ.

### Components mới (`src/components/`)
- **`PresetCard.tsx`** — gradient placeholder thumbnail (aspect-[4/5]) với
  outline tủ schematic tỉ lệ thật theo `aspect-ratio: ${width}/${height}` ·
  category badge · name + usecase + price + meta (cột×tầng · tấm). Hover: name
  gradient-text.
- **`FilterBar.tsx`** (client) — inline toggle chips theo pattern maume
  ShopClient: "Loại" + 5 category chip · "Sắp xếp" + 3 sort option. URL state
  sync qua `useSearchParams` + `router.replace`. Click cùng chip → toggle off.
  "← Reset" button khi có filter active.
- **`CollectionClient.tsx`** (client) — đọc URL params, filter + sort presets,
  render grid 2/3/4 col responsive.

### Routes mới
- **`/collection`** (`src/app/collection/page.tsx`) — SSG list page. Server
  component compute price/cutlist tại build time, pass static data sang
  `CollectionClient` để filter client-side.
- **`/collection/[slug]`** (`src/app/collection/[slug]/page.tsx`) — SSG detail.
  `generateStaticParams` pre-render 5 page (`compact`/`studio`/`loft`/`tall`/`wide`).
  JSON-LD `Product` schema (Schema.org) inject qua JSX text children pattern
  `<script>{JSON.stringify(...)}</script>` (Next 16 App Router native, an toàn
  cho static schema data). CTA "THIẾT KẾ TỦ NÀY →" link `/design?preset=<slug>`.
- **`/design` (modify)** — đọc `useSearchParams().get('preset')`, lookup
  `findPreset(slug)`, pass `initialValues={preset.values}` vào Configurator.
  Wrap `<Suspense>` vì useSearchParams cần boundary.

### Verify ✅ (Session 5 done-criteria)
- `pnpm tsc --noEmit` pass.
- `pnpm validate` → **32/32 build · 6/6 pipeline · tự kiểm ĐẠT** · BASELINE giữ.
- `pnpm generate-presets` → 5 preset build thành công, xuất JSON 2.4KB.
- Preview browser:
  - `/collection` — list 5 preset grid + FilterBar đúng.
  - Filter URL sync: click "Studio" chip → URL `?cat=studio` · click "Giá ↑" → `?sort=price-asc`.
  - `/collection/loft/` — detail render đầy đủ + JSON-LD `<script>` present.
  - `/collection/loft/` click "THIẾT KẾ TỦ NÀY →" → `/design?preset=loft` →
    Configurator load Cols=4, Rows=6, W=2000, price 26.396.148₫ (khớp preset).
- 4 breakpoint: 375 mobile 2-col grid · 768 md 3-col · 1280 lg 4-col · 1920 xl
  4-col + Wide ở row 2.

### Quyết định/lưu ý
- **5 preset là Phase 1** — Plan ban đầu nói "5+ preset, thêm dần đến 10+" trong các session phụ. Hiện 5 đại diện 5 use case (phòng nhỏ/khách/ngủ/ngách/TV stand). Thêm preset = thêm object vào `PRESETS` array, không cần đụng UI.
- **Thumbnail là gradient placeholder + outline schematic** — defer ảnh 3D thật tới S6 (sẽ chụp manual qua `preview_screenshot` cho mỗi preset hoặc viết script render server-side).
- **FilterBar pattern**: founder yêu cầu học từ maume — chọn inline-chip thay vì sidebar/drawer. Phù hợp 5 preset; nếu sau lên 10+ có thể switch sang sidebar.

### 📝 Lưu ý cho Session 6 (Configurator route + deploy ke.maume.asia)
- Polish `/design` route: nạp trễ `next/dynamic(..., {ssr:false})` đã có; check
  SSG export với `?preset=<slug>` (URL params SSG vs client-side hydration).
- `src/app/sitemap.ts` + `robots.ts`: auto generate từ static routes + 5 preset slug.
- JSON-LD Organization + WebSite schema trong `layout.tsx` (hiện chỉ có Product
  per preset, thiếu site-level).
- OG image cho mỗi preset (tự generate từ gradient placeholder hoặc render 3D).
- DNS Cloudflare CNAME `ke.maume.asia` → `hsonvu1912.github.io` (hoặc Workers).
- Lighthouse audit ≥85 mobile. Font subset Be Vietnam Pro nếu cần (chỉ keep
  weight 400/500 cho production).
- GA4 sub-property + Search Console.

### 📝 Lưu ý cho Session 5 (cũ — đã xong, giữ để tham khảo)
- Configurator hiện hardcode tên "Tủ kệ Module" trong `Configurator.tsx` (header sidebar).
  Khi S5 cần multi-product, sẽ phải tham số hoá tên này — nhưng đây là engine BẤT BIẾN
  → cần founder duyệt mở rộng. Hoặc S5 inject qua `ProductDNA.title` field tùy chọn.
- `Configurator` cần thêm prop `initialValues?: Partial<ParamValues>` để load preset từ
  query param `?preset=<slug>` (đã ghi trong plan S5).
- `cellSymbolByPosition` matrix logic ở `dna.ts:resolveControls` cần cập nhật cho default
  3×2 (hiện vẫn ổn nhưng nếu thêm `cells` mới sẽ phải tính lại).
- Multiple lockfile warning từ Turbopack: `pnpm-workspace.yaml` ở furniture-brand vs
  `package-lock.json` ở `/Users/hsonvu/CLAUDE/`. Set `turbopack.root` trong `next.config.ts`
  để silence (low priority).

## 🗂️ History (cũ trước restructure)

(Mục "Tiếp theo" cũ — đã đổi sang structure trên)

**"Bảng ảnh duyệt" của S3 — founder QUYẾT ĐỊNH BỎ (2026-05-20).** Không làm static
photo board. Lý do founder: không có tác dụng thực cho dự án — configurator chạy trực
tiếp (`preview_start "furniture-brand"`, port 3462) đã cho xem/chỉnh/duyệt tương tác
đầy đủ; loạt ảnh tĩnh không thêm giá trị. ⇒ **Session 3 XONG trọn vẹn** (phần thực chất
— validator — đã đạt). Đừng dựng lại việc này ở session sau.

> Ghi chú kỹ thuật (nếu sau này muốn xuất ảnh 3D ra file tự động): `<canvas>` WebGL của
> react-three-fiber mặc định `preserveDrawingBuffer: false` → `canvas.toDataURL()` trả
> ảnh ĐEN. Muốn chụp ra file phải bật cờ đó trong `<Canvas>` (`src/configurator/`,
> engine bất biến → cần founder duyệt). `preview_screenshot` chụp được 3D nhưng ảnh chỉ
> nằm trong phiên làm việc, không ghi ra file.

**Session 4 — Site + SEO:** trang chủ + trang sản phẩm SSG (schema `Product` JSON-LD),
configurator nạp trễ (`next/dynamic`, `ssr:false`).

Lưu ý chung: sản phẩm ở `products/tu-ke/dna.ts`; `src/configurator/` BẤT BIẾN — cần mở
rộng thì DỪNG, hỏi.

## ⚠️ Quyết định & lưu ý

**Sản phẩm tủ kệ — trạng thái hiện tại (chốt với founder):**
- **Tham số:** số cột (1–5), số tầng (1–6), rộng/cao/sâu (đều **bước 1mm**), `widthMode`,
  `heightMode`, `color` (= "Vật liệu khung"), và 2 lưới `cellgrid`: loại ô (`cells`) + vật liệu ô (`cellColors`).
- **Kích thước 2 chế độ:** `widthMode` (Chia đều / Từng cột) và `heightMode` (Chia đều /
  Từng tầng). "Chia đều" → 1 núm tổng; "Từng cột/tầng" → mỗi cột/tầng 1 thanh trượt (bước 1mm).
  Mỗi ô thông thuỷ ≥ 150mm (`CELL_MIN`), ≤ 2400mm cao (`TIER_MAX`) / ≤ 1200mm rộng (`COL_MAX`).
  Sidebar gom: số cột + chế độ + núm rộng vào khung "Chiều rộng" (số tầng tương tự "Chiều cao").
- **Ô vượt cỡ:** chế độ "chia đều" → kéo cao/rộng tổng làm ô vượt 2400/1200 thì `normalizeValues`
  TỰ THÊM tầng/cột; chế độ "từng cột/tầng" → slider khoá ở 2400/1200 (không cho vượt).
- **Lưới LOẠI từng ô** (núm `cells`, `cellVariant:'type'`): mỗi ô 1 trong 4 loại — mở-có-hậu /
  mở-không-hậu / cánh / ngăn kéo. Vẽ như MẶT ĐỨNG tủ: ô đúng tỉ lệ thật, nét chia = màu ván
  đậm; nền ô = màu khung, riêng "mở-không-hậu" = TRẮNG. Ký hiệu kỹ thuật bám góc ô: cánh =
  tam giác (đỉnh về bản lề), ngăn kéo = 2 đường chéo (chữ X); 2 loại "mở" không ký hiệu.
  Bấm 1 ô → menu nhỏ bật tại ô (KHÔNG còn dropdown gốc, KHÔNG bảng chú thích).
- **Lưới VẬT LIỆU từng ô** (núm `cellColors`, `cellVariant:'color'`): mỗi ô 1 vật liệu phủ
  tấm hậu + cánh/ngăn kéo của ô; mặc định "Theo khung" (`FRAME_COLOR`) = ăn theo vật liệu khung.
- **Vật liệu 2 lớp:** núm `color` (= "Vật liệu khung") chỉ áp cho khung (nóc/đáy/kệ/vách);
  hậu/cánh/ngăn kéo lấy từ lưới `cellColors`. (Ô "không hậu" đặt vật liệu được nhưng vô hiệu.)
- **2 họ vật liệu:** ván MDF sơn màu (`mdf_son`, 9 màu) + ván plywood veneer (`plywood_veneer`,
  3 vân gỗ); gộp 1 danh sách phẳng `MATERIALS` trong dna.ts. Mã vật liệu dạng `catalog/id`.
- **Ngăn kéo — 4 điều kiện:** đỉnh ô ≤ `DRAWER_MAX_TOP` (1200mm) · cột rộng 250–900mm
  (`FRONT_MIN_WIDTH`–`DRAWER_MAX_WIDTH`) · ô cao ≤ `DRAWER_MAX_HEIGHT` (400mm).
  Cánh: rộng 250–1200mm (`FRONT_MIN_WIDTH`–`DOOR_MAX_WIDTH`), cao ≤ 2400mm
  (`DOOR_MAX_HEIGHT`), tự tách 2 lá khi cột > 600mm (`WIDE_CELL`). Thiếu → lưới ẩn
  lựa chọn (`disabledByRow` + `disabledByCol`); `build()` fallback chuỗi (drawer→door→
  mở-có-hậu). Số bản lề mỗi lá tùy cao cánh (2/3/4/5).
- **Thùng hộc ngăn kéo:** mỗi ô ngăn kéo = mặt trước (false front, có lỗ tay nắm) + thùng hộc:
  2 hông + hậu (18mm) + đáy (9mm); thụt `SLIDE_GAP` (13mm) mỗi bên chừa ray; sâu ≈ chiều sâu
  tủ trừ ~90mm. (Tấm lưng của ô là hậu TỦ — riêng, không phải hậu hộc.)
- **Tấm lưng PER-Ô** (`T_BACK` = 9mm): ô có-hậu/cánh/ngăn kéo có lưng riêng; ô "không hậu"
  → bỏ lưng (nhìn xuyên). Thân tủ `T` = 18mm.
- **Kết cấu khung:** KHÔNG có tấm hông. Nóc/đáy/kệ = tấm ngang DÀI (chạy hết `W`); mọi vách
  đứng — gồm 2 mép biên — = đoạn NGẮN 1 tầng (`columns + 1` vị trí).
- **Giá** (`pricing.ts`): MDF 18mm 700k/m² · 9mm 350k · veneer 18mm 560k · 9mm 280k (tạm
  ~−20%, founder chỉnh sau) · bản lề 18k · ray 90k/bộ · margin ×1.6 · công 300k/đơn.
  `MATERIAL_RATE_PER_M2` theo (catalog × độ dày).
- **Tay nắm = LỖ KHOÉT Ø35** (không phụ kiện): ngăn kéo lỗ giữa cạnh trên; cánh lỗ góc trên
  đối diện bản lề. Ghi `Part.holes` (render 3D) + `Part.notes` (bảng cắt). Cánh/hộc lắp
  CHÌM, mặt phẳng cạnh trước khung; ô rộng > 500mm → tách 2 cánh.

**Engine đã mở rộng sau S2 (founder duyệt từng lần, đều additive):**
- `Configurator.tsx`: cột "Dày" bảng cắt; render núm động; `groupControls()` vẽ khung nhóm;
  `CellGridControl` — lưới mặt đứng + menu bật tại ô (2 biến thể: loại / màu); `shrink-0` sidebar.
- `types.ts`: `PanelHole` + `Part.holes?`; `Parameter` type `'cellgrid'` + `group?` +
  `colSizes/rowSizes/tint` + `disabledByRow/Col?` + `cellVariant?`.
- `renderer.tsx`: tấm có `holes` vẽ bằng `ExtrudeGeometry` (thay `boxGeometry`).
- `ProductDNA.resolveControls?` (núm động) + `normalizeValues?` (tự chỉnh tham số phụ thuộc —
  vd tự thêm tầng/cột). File `cellgrid.ts`: `reconcileCellGrid` nhận thêm `disabledByCol`.
- `renderer.tsx`: `Wall` (tường SÁT mặt hậu tủ) + `Dimensions` (3 đường đo tổng MẢNH +
  chấm tròn `DimDot` ở 2 đầu mút + nhãn chỉ ghi số — KHÔNG mũi tên / đầu chĩa ra; rộng & sâu
  nằm SÁT SÀN kiểu mặt bằng, cao là đường dọc mép trước-trái; màu chung `DIM_COL`) + vân gỗ
  procedural (`getGrainTexture` — MẶT NẠ xám NHÂN lên `color`, độ đậm để NHẸ/tự nhiên;
  `materials.ts` thêm `MaterialAppearance.grain?`). `<meshStandardMaterial>` có
  `key={part.material}` → đổi vật liệu là REMOUNT material (xem bug shader bên dưới).
  `Configurator.tsx`: cutlist cột "Vật liệu"; lưới cellgrid có `padding` = nét chia → viền
  ngoài đồng nhất dạng table.
- (sau S3) Wizard: `types.ts` thêm `Parameter.stepId?` + `ProductDNA.steps?` +
  `ProductDNA.getWarnings?`; `Configurator.tsx` thêm chế độ wizard + `NumberControl` (ô nhập
  tay) + `WarningBox` / `StepIndicator` / `StepNav`. Chi tiết ở mục "Nâng cấp UX" phía trên.
- (sau wizard) 5 cải tiến: `types.ts` thêm `Parameter.lockedCells?` · `Hardware.notes?` ·
  `Fitting` + `BuildResult.fittings?`; `Configurator.tsx` ô lưới khoá + ghi chú phụ kiện +
  vẽ `fittings`; `renderer.tsx` `FittingMesh` (chân tủ) + vân veneer per-ván (`makePartGrain`);
  `cutlist.ts`/`pricing.ts` hỗ trợ chân tủ. Chi tiết: mục "5 cải tiến sản phẩm".

**Giản lược có chủ ý (mở rộng sau, KHÔNG phải bug):**
- Tấm lưng mỗi ô là 1 tấm nguyên (chưa tối ưu theo khổ ván).
- Camera 3D cố định — tủ rất to hơi sát mép, khách tự xoay/zoom.
- `PanelHole` giả định lỗ trên mặt X-Y xuyên trục Z — chỉ đúng cho tấm mặt (Z là bề dày).
- Lưới "Vật liệu từng ô" cho đặt cả ô "không hậu" nhưng không hiệu lực (ô đó không có tấm).

**Bug đã bắt & sửa (lưu ý cho sau):**
- Slider có `min` không nằm trên lưới `step` → trình duyệt snap → React re-render bắn
  `onChange` giả → loạn state. FIX: `stepMin()` làm tròn `min` lên bội số `step`.
- Sidebar `<aside>` thiếu `shrink-0` → co lại trong flex-row. FIX: thêm `shrink-0`.
- Bảng cắt gộp tấm theo cả `material` → tấm khác vật liệu thành dòng riêng, nhưng
  `CutlistPanel` không hiện vật liệu → các dòng trông y hệt (tưởng "lặp lại"); React key cũng
  trùng. FIX: cột "Vật liệu" (ô màu + tên) + nhét `material` vào key — logic gộp giữ nguyên.
- 3D đen khi verify: trang preview ở chế độ ẩn → trình duyệt treo `requestAnimationFrame` →
  R3F không render. KHÔNG phải bug — mở pane preview ra là render lại (xem mục Cách verify).
- Veneer KHÔNG lên vân gỗ dù texture mặt nạ đúng: three.js KHÔNG tự biên dịch lại shader của
  `MeshStandardMaterial` khi `map` đổi null↔texture trên material CŨ (bị tái dùng) → shader cũ
  thiếu cờ `USE_MAP` nên bỏ qua texture. FIX: `key={part.material}` trên `<meshStandardMaterial>`
  → đổi vật liệu là tạo material MỚI → compile lại shader có `USE_MAP` → vân hiện. (Đổi `color`
  thuần — vd veneer→veneer cùng map — vẫn an toàn; key đổi nên remount, compile lại 1 lần, OK.)
- Veneer KHÔNG lên vân trên CÁNH / MẶT NGĂN KÉO (parts có lỗ tay nắm → dựng bằng
  `ExtrudeGeometry`): UV mặc định của `ExtrudeGeometry` tính theo TOẠ ĐỘ THẬT (mm), KHÔNG
  phải 0→1 như `boxGeometry` → `makePartGrain` đặt `repeat` (công thức cho UV 0→1) gặp UV
  cỡ hàng trăm → texture tile loạn → vân vụn thành nhiễu, nhìn như mất. FIX: truyền
  `UVGenerator` riêng cho `ExtrudeGeometry` (`generateTopUV` tự chuẩn hoá UV mặt trước/sau
  về 0→1). Đã kiểm: UV mặc định −300..300 → sau fix 0..1.

**Quy ước kỹ thuật:**
- Hệ toạ độ scene: X giữa = 0, Y = 0 ở sàn, mặt trước +Z. `Part.position` = tâm hộp, không xoay.
- `Part` (đã khóa): `size` ↔ `length/width/thickness` phải đồng bộ. `build()` set cả hai.
- Configurator: option có `value` dạng `"catalog/id"` (chứa `/`) → hiện ô màu swatch.
- Núm động: DNA có `resolveControls(values)` → Configurator render danh sách đó (tính lại
  khi tham số đổi); núm mới nạp `default`. Không có → render `parameters` tĩnh.
- Configurator render client-only: `page.tsx` dùng `'use client'` + `next/dynamic(..., {ssr:false})`.
- Shadow: three 0.184 bỏ `PCFSoftShadowMap` → truyền `shadows={{enabled, type: PCFShadowMap}}`.
- Console noise VÔ HẠI: `THREE.Clock has been deprecated` (~16 dòng/lần tải) do R3F 9.6.1. Bỏ qua.
- Next 16 có breaking changes — đọc `node_modules/next/dist/docs/` trước khi viết code Next.

## Cách verify hiện trạng

`preview_start` config **"furniture-brand"** (`.claude/launch.json` đã tạo, port 3462) → mở http://localhost:3462.
Configurator mở dạng **wizard 3 bước** (Kích thước → Thuộc tính ô → Màu & vật liệu). Mặc
định ở B1: tủ **1900×2200×350mm · 4 cột × 6 tầng**, khung "MDF Đen" — 2 tầng ngăn kéo / 2
tầng mở-không-hậu / 2 tầng cánh — giá **18.646.803₫**, bảng cắt **101 tấm · 16.54 m² ·
~198 kg** + 10 chân tủ. Kéo slider / gõ số tay / bấm nút / bấm ô lưới / chuyển bước → 3D +
giá + bảng cắt đổi ngay.
- **Validator (không cần mở website):** `pnpm validate` → tự kiểm 6/6 + 32/32 cấu hình ĐẠT, exit 0.
- ⚠️ **3D chỉ render khi pane/tab preview ĐANG MỞ (visible).** Trang ẩn → trình duyệt treo
  `requestAnimationFrame` → R3F không vẽ → canvas đen. KHÔNG phải bug — mở pane ra là render
  lại. Khi screenshot mà thấy 3D đen: mở/giữ pane preview rồi screenshot lại.
