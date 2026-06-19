# P96 — Bộ UI dùng chung cho 2 config (tủ x + tủ y)

Nguồn: workflow 6-agent (2026-06-18, `tasks/wjv431jwr.output`). Mục tiêu: 2 config dùng CHUNG vỏ-thiết-kế
(chrome) → sửa 1 chỗ cả 2 đổi, hết drift. Founder chốt: **tách kit + chuyển CẢ 2 tủ** (đụng UI tủ x, KHÔNG đụng engine/giá/baseline).

## Nguyên tắc bất biến
- CHỈ sửa JSX/className. TUYỆT ĐỐI không đụng: dna/pricing.ts/cutlist.ts/types.ts/renderer.tsx, state (values/intentValues/setParam/rowSelect/colSelect/cellPopup/mode3D), logic CellBar split-merge, tab bar, slider, ColSizeRow.
- Giá baseline tủ x = **5.613.280₫** — verify sau MỖI region.
- Primitive (Segmented/PillButton…) KHÔNG tự giữ state — chỉ nhận value+onChange (giữ 2-way binding với dna).

## Bộ kit (src/configurator/ui/) — 14 component + tokens
ConfigShell · EditorialHeader · SectionCard + SectionHeading · Segmented · PillButton(fill-active) ·
SwatchButton · OrderBar · OrderDialog · FloatingButtons(+FloatingIconButton) · HintPill · WarningBox ·
Toast · SavePresetButton · tokens.ts (gom chuỗi className lặp ≥3 lần).
+ Export `swatchCss`/`swatchStyle` từ **materials.ts** (engine chung) thay vì copy.
+ Tủ x **import PricePanel/CutlistPanel từ ./admin-detail-panels**, XOÁ bản inline (3406-3605) → hết 1 cặp trùng lớn.

## Giữ RIÊNG (ban-chất-khác-nhau, KHÔNG ép chung)
Tab bar (x) · slider NumberControl/ColSizeRow (x) · CellBar chia/gộp/sub-cell (x) · panel "Ô đang chọn"+nút "+"+Tetris (y) · màu per-ô khung/cánh/nẹp (y) · NestingModal (x, admin). Các vùng này vẫn DỰNG TỪ primitive chung (card/segmented/swatch) nhưng logic riêng.

## Kế hoạch 5 pha
- **P0** baseline: tsc sạch + chụp ảnh BEFORE (x admin+public, desktop+mobile; y) + ghi giá baseline.
- **P1** dựng kit + export helper + cho x import admin-detail-panels (xoá inline). Caller CHƯA đổi → ảnh y hệt BEFORE.
- **P2** migrate **tủ y** sang kit (rủi ro thấp). Giữ EdgeAddButtons/Tetris/màu per-ô.
- **P3** migrate **tủ x** sang kit — TỪNG VÙNG, 1 commit/region, thứ tự an toàn→khó: WarningBox→HintPill→FloatingButtons→SavePresetButton→EditorialHeader→ConfigShell→OrderBar/OrderDialog→SectionCard/Segmented/PillButton/SwatchButton trong ParamControl/CellBar. Sau mỗi region: tsc + so ảnh pixel + giá=5.613.280₫; lệch ngoài dự kiến → revert region.
- **P4** dọn code chết + cập nhật docs + liệt kê diff còn lại (giữ riêng).

## Rủi ro tủ x (tóm)
Giá baseline cứng · state binding dễ vỡ · CellBar nghiệp vụ lưới · Segmented tier-steps x dùng nền `--color-bg` (≠ surface-2) → cho prop bg giữ baseline · OrderBar x 'giá-trái nút-phải' (prop layout) · NestingModal palette trung tính (để riêng) · 1 commit/region để dễ bisect.

## Quyết định founder (chốt trước khi code)
1. Segmented tier-steps x nền `--color-bg` vs surface-2 → **đề xuất: prop bg giữ baseline x**.
2. OrderBar: 1 layout chung (2 tủ GIỐNG hệt) hay prop layout mỗi tủ khác → **CẦN CHỐT**.
3. Header spacing/kicker chuẩn hoá + kicker prop → đề xuất OK.
4. Toast cho cả x? → đề xuất để sẵn kit, x adopt nếu cần.
5. NestingModal (admin x) đưa về accent ngay hay pha riêng → **CẦN CHỐT**.
6. Mirror maume: kit ở src/configurator/ui/ → mirror copy như phần còn lại của configurator/.
7. Tên thư mục: **src/configurator/ui/** (chốt).

## Founder đã chốt (18/06)
- OrderBar: **theo tủ x** (giá góc trên-trái, nút Đặt hàng góc phải) → tủ y đổi theo, tủ x giữ nguyên.
- NestingModal (admin tủ x): **đưa về tông cam** cho đồng bộ (tủ y KHÔNG có nesting) → làm ở P3/P4.
- Tiến hành: **bắt đầu P0/P1** (dựng kit).
- (Em tự chốt) Q1 prop bg giữ baseline x · Q3 chuẩn hoá header + kicker prop · Q4 Toast để sẵn kit · Q6 kit ở src/configurator/ui/ mirror copy như configurator/ · Q7 thư mục `ui/`.

## Tiến độ
- **P1 nền tảng XONG (18/06):** tạo `src/configurator/ui/tokens.ts` + `ui/index.tsx` (15 export: ConfigShell, Sidebar, EditorialHeader, SectionCard, SectionHeading, Segmented, PillButton, SwatchButton, FloatingIconButton + IconUndo/IconRuler, HintPill, WarningBox, Toast, SavePresetButton, OrderBar, OrderDialog). Export `swatchCss` từ materials.ts. OrderBar theo layout tủ x (giá trái text-shadow + nút phải); OrderDialog tổng quát hoá `summary` (ReactNode riêng từng tủ) + `buildPayload` (payload riêng). Segmented có prop `bg` ('surface-2'|'bg') giữ baseline tier-steps tủ x. tsc FB 0 lỗi. Kit CHƯA dùng (chưa đụng 2 config) → production y nguyên.
- **P2 migrate TỦ Y XONG (18/06):** YConfigurator dùng kit (EditorialHeader, SavePresetButton, SectionCard/Heading, Segmented, PillButton, SwatchButton, FloatingIconButton, HintPill, WarningBox, Toast, OrderBar). Xoá OrderDialog cục bộ + inline OrderBar + swatchCss → **−178 dòng** (861→683). OrderBar chuyển layout TỦ X (giá góc-trái + nút phải); nút tròn nổi dời md:top-28. Giữ: Tetris/EdgeAddButtons/màu per-ô/edge swatch flat. tsc FB+maume 0 lỗi; browser render OK (canvas, giá display-italic top-left, console sạch). Mirror: copy ui/tokens+index, materials.ts (identical), YConfigurator sed (chỉ khác import). CHƯA deploy (chờ P3).
- **P3a migrate TỦ X — vùng OrderBar XONG (19/06):** xoá local `OrderBar`+`OrderDialog` (262 dòng đuôi file) → dùng kit `<OrderBar priceTotal summary buildPayload>`. summary tủ x = Mẫu/Kích thước(W×H×D)/Cấu trúc(cột×tầng); buildPayload = {preset,values,price,cutlist,bom:fittings} (giống cũ 100%). Tiêu đề dialog "Đặt hàng tủ kệ"→"Đặt hàng" (đồng bộ tủ y; nút CTA vẫn "Đặt hàng"). Configurator 4080→3829 dòng (−251). tsc FB+maume 0 lỗi; **validate-dna TẤT CẢ ĐẠT (33/33 build, baseline 5.613.280₫ giữ)**; browser: giá góc-trái + nút phải, dialog mở đúng summary+5 trường, console sạch. Mirror maume: cùng 3 sửa (truncate + import + call site); diff FB↔maume CHỈ còn 2 dòng path `@/lib/ke/...`.
- **P3b migrate TỦ X — chrome XONG (19/06, qua workflow 6-agent phân tích spec):** WarningBox · HintPill · FloatingButtons(undo+ruler) · EditorialHeader → kit, qua **1 edit import gộp** (tránh xung đột cùng-dòng). **Nâng kit TRƯỚC** (cả 2 tủ hưởng, tủ x giữ baseline): HINT_PILL token +biến thể md (px-4/py-1.5/text-[11px]/whitespace-nowrap) + HintPill wrapper +md:top-6; WarningBox tự tương thích (có title→⚠-tiêu-đề + dòng trần kiểu tủ x; không title→⚠-mỗi-dòng kiểu tủ y) + cap w-[min(360px,…)] + md:top-20 + shadow-lg + leading-relaxed; WARNING_BOX token bỏ `shadow` (mỗi nơi tự đặt: WarningBox shadow-lg, Toast shadow). Xoá hàm `WarningBox` cục bộ CHẾT (876-887, trùng tên kit). IconRuler tủ x đổi barbell→cây-thước (KHỚP tủ y, đúng mục tiêu). tsc FB+maume 0 lỗi; validate-dna 33/33 baseline giữ; browser tủ x (header/nút nổi/hint/order render OK, console sạch) + tủ y (vẫn chạy, hưởng nâng). Mirror: copy kit (identical) + Configurator sed 2 path.
- **P3c controls trong panel XONG (19/06, workflow 6-agent phân tích 5 component):** KẾT LUẬN quan trọng — **gần như TẤT CẢ controls panel là keep-inline ĐÚNG ĐẮN** (mẫu riêng tủ x: lưới swatch-CÓ-NHÃN material/edge picker với swStyle động, slider kéo + ô nhập số dính state/throttle, CellBar pill có CellSymbol SVG, D-pad gộp 3×3, lưới ô CellGrid). Ép vào primitive sẽ vỡ hình HOẶC buộc primitive giữ state (phạm quy tắc). **Đã migrate 3 cái sạch:** (1) **nâng kit Segmented** +prop `className`+`numeric` (tabular-nums) — backward-compatible, tủ y không đổi; (2) ParamControl TOGGLE → `<Segmented className="max-w-xs">`; (3) NumberControl nấc Cao/Rộng → `<Segmented numeric>` (map String/Number giữ binding); (4) vỏ thẻ CellBar → `<SectionCard>` (token CARD verbatim, đổi cả open dòng 722 + close). tsc FB+maume 0 lỗi; validate-dna 33/33 baseline giữ; browser: tủ y segmented "Chế độ màu" render đúng bằng Segmented nâng (chứng minh tương thích ngược) + tủ x default render + console sạch. Mirror: kit identical, Configurator 2 path.
- **HOÃN (cần nâng kit thêm prop variant trước — admin/ít-thấy, ghi nhận):** SavePresetButton (admin; kit khác hành vi localStorage + hình full-width→pill) · CellBar tab Kiểu/Màu (cần Segmented variant hover `bg-accent-bg` + bỏ shadow + px-2.5/tracking-wide/gap-0.5).
- **P4 NestingModal → tông CAM XONG (19/06):** sơ đồ xếp tấm (admin tủ x) đổi từ neutral/black/white sang accent: overlay `bg-[var(--color-ink)]/40`+blur, body `bg-[var(--color-bg)]`, viền `accent/15`, text `accent`/`accent/55`/`accent/60`, nút × `surface-2`→hover accent-fill, badge ✂ nửa/phần-tư `emerald`→`accent`, cảnh báo "không vừa khổ" `amber`→`accent-bg+accent`. GIỮ fill nhiều-màu (hsl) cho từng mảnh trong sơ đồ (chức năng phân biệt mảnh cắt — không cam-hoá). tsc 0, admin-gated nên verify qua tsc (FB public không có mode='admin').
- **P1b dedupe PricePanel/CutlistPanel XONG (19/06):** tủ x bỏ bản INLINE (PricePanel+CutlistPanel = ~196 dòng) → `import { PricePanel, CutlistPanel } from './admin-detail-panels'` (nguồn chung tủ y đã dùng). Diff XÁC NHẬN code GIỐNG HỆT (chỉ khác `export` + comment). Xoá `swatchStyle` cục bộ (giờ thừa, chỉ inline CutlistPanel dùng). Configurator 3829→3531 dòng. tsc FB+maume 0; validate 33/33 baseline; public render OK (h1/giá/canvas, console sạch); mirror Configurator 2 path, admin-detail-panels identical.
- **✅ P96 HOÀN TẤT (phần khả thi).** Drift UI giải quyết: chrome + OrderBar + segmented + cards + bảng giá + NestingModal đều dùng chung/đồng tông. **HOÃN (cần nâng kit variant, admin/ít-thấy):** SavePresetButton (hành vi localStorage khác) + CellBar tab Kiểu/Màu (hover variant). **CHỜ FOUNDER GÕ DEPLOY** → build+deploy 2 worker (ke-maume + maume-admin).

Giá baseline 5.613.280₫ được validate-dna bảo vệ; ảnh BEFORE tủ x chụp ngay trước P3.
