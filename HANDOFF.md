# HANDOFF — trạng thái dự án

> Mỗi session cập nhật file này TRƯỚC KHI kết thúc. Session sau đọc để bắt nhịp.
>
> **⚠️ Đọc trước tiên**: [`PROJECT-LAYOUT.md`](./PROJECT-LAYOUT.md) — single source
> of truth tổng hợp source folders / Cloudflare resources / Apps Script / data
> flows / deploy workflows / common gotchas. Audit hoàn chỉnh 2026-05-22.

## 🔧 CellBar Refactor — Phase 1 (2026-05-27, NGOÀI roadmap chính)

**Trigger**: Founder yêu cầu giữa session — refactor UX configurator (bỏ toggle "Kiểu ô/Màu ô" ngoài, gộp vào popup ô) + thêm Chia/Gộp ô. Đây KHÔNG nằm trong roadmap S1-S12 chính, là sửa ngang dự án.

**Plan đầy đủ**: `~/.claude/plans/session-n-y-t-i-mu-n-keen-twilight.md` (6 phases).

### Phase 1 đã xong (commit `af15654`)
- Bỏ `EditModeToggle` (component góc trên 3D + state `editMode`).
- `CellBar` gộp 2 tab "Kiểu ô"/"Màu ô" trong cùng popup (neo bottom).
- Lift `cellTab` lên Configurator → animation "mở cánh" chỉ ở tab Kiểu.
- Reset `cellTab` về 'type' khi click ô mới.
- Thêm 6 nút placeholder **Chia (Dọc/Ngang) + Gộp (↑↓←→)** — disabled, wire ở Phase 3-4.
- Hint đổi: "Chạm ô tủ để đổi {kiểu/màu}" → "Chạm ô tủ để chỉnh".
- Verify: `pnpm validate` 33+6+8 PASS · `tsc` clean · 3 presets (compact/tall/loft) render đúng + giá khớp · E2E click ô → chọn option → setCell OK.

### Phase 2-6 sắp tới
| Phase | Nội dung |
|---|---|
| **P2** | Block list codec (`parseBlocks`/`encodeBlocks`/`blocksToGrid`/`gridToBlocks`) trong `cellgrid.ts` + migration runtime (lazy) |
| **P3** | Implement SPLIT (nút Chia dọc/ngang, vách gỗ THẬT, drawer excluded) — refactor `dna.build()` vách rendering theo block adjacency |
| **P4** | Implement MERGE (gộp ô lân cận, Excel-like — bỏ vách giữa, drawer excluded) |
| **P5** | Constraints (door 1200×2400, drawer 900×400, cell min 150mm) + preset showcase mới |
| **P6** | Polish + e2e + KHÔNG deploy (chờ founder duyệt riêng) |

### Quan trọng cho session sau
- **Approach**: block list with rowSpan/colSpan, NOT subgrid kiểu cũ. Branch `feature/sub-cells` (commits `96d2718`/`0ddce71` đã park) là **DEPRECATED** — không reuse code subgrid.ts vì hệ cũ chỉ 1D split inside open-back/nobk, không support cross-cells merge.
- **Grammar mới đề xuất**: pipe-delimited `"0,0,1,1,open-back|0,1,1,2,door"` — block ngăn `|`, field ngăn `,`. Backward: không có `|` → parse legacy `"a,b;c,d"`.
- **Migration timing**: hybrid — lazy cho preset legacy chưa chỉnh, eager khi user thực sự Chia/Gộp → Apps Script Sheet log không bị phá cho đơn cũ.
- **DNA opt-in**: flag `Parameter.cellLayoutMode?: 'uniform' | 'blocks'` để DNA tương lai chọn vào tính năng này.

## ✅ Pricing v4 — nesting + IKEA stepped margin (2026-05-27)

**Yêu cầu founder**: (1) cộng 40% hao hụt + 100k/ván cốt vào pricing; (2) markup IKEA-style theo panel count (ít panel margin thấp, nhiều panel margin cao); (3) smooth bước giá khi customer thêm/bớt panel; (4) dọn UI admin.

### Đã deploy production

| Worker | Domain | Version |
|---|---|---|
| `ke-maume` | ke.maume.asia | `62aa6592-337b-4fef-94dc-9ee8cd626ef7` |
| `maume-admin` | admin.maume.asia/admin/ke-catalog | `3a74c99f-cb9d-4bb6-a83d-3fe8927a2cb5` |

**Deploy method**: wrangler deploy local (KHÔNG qua git push). Git remote main lạc hậu so với production runtime — verify production qua `wrangler deployments list --name ke-maume` thay vì git log.

### Pricing engine v4 logic

```
materialCost = Σ(netArea × rate) × wasteMultiplier
  wasteMultiplier = max(1.4, 1/nestingUtil)    // sàn 40%, nesting tệ hơn → dùng số thực
laborCost = numSheets × 100_000                 // 100k/ván cốt từ nesting
margin = computeMargin(panelCount, anchors)     // IKEA linear interpolate
  anchors = [(20,1.3), (40,1.5), (80,1.7), (150,2.0)]
  panel<20 → flat ×1.3 ; panel>150 → plateau ×2.0 ; giữa → lerp
total = (materialCost + hardwareCost + laborCost) × margin
```

**Removed**: `laborPerOrder` cố định 300k/đơn (legacy), flat `margin` ×2.0 hardcode.
**Backward compat**: `config.boards` vắng → fallback laborPerOrder; `marginTiers` vắng → flat margin.

### Files modified (furniture-brand, deployed)

- `src/configurator/pricing.ts` — thêm `computeMargin()` linear interp, `DEFAULT_MARGIN_TIERS`, integrate nesting waste + labor
- `src/configurator/types.ts` — PriceConfig +4 nesting fields + marginTiers
- `src/lib/production-catalog.ts` — ProductionCatalog +wasteMultiplierMin/laborPerSheet/marginTiers, DEFAULT_CATALOG seed 10 boards (5 material × 2 thickness), `migrateMarginTiers()` (legacy null → explicit max), validateCatalog rules
- `src/lib/nesting/cost.ts` [NEW] — wrapper `computeNestingCost()` + 3 constants (MIN_WASTE_MULTIPLIER=1.4, DEFAULT_LABOR_PER_SHEET=100_000, DEFAULT_KERF_MM=3) — single source cho hệ số kinh doanh
- `src/lib/nesting/index.ts` — export FreeRect/findFirstFit/splitRect, populate `freeRects?` field per NestedBoardLayout
- `src/lib/dxf/types.ts` — NestedBoardLayout +freeRects? optional field
- `package.json` — thêm `dev:remote` + `deploy` scripts

### Files modified (maume admin, deployed)

Sync 1:1 với furniture-brand qua path alias `@/lib/ke/*`:
- `src/lib/ke/configurator/pricing.ts` — same logic computeMargin
- `src/lib/ke/configurator/types.ts` — same fields
- `src/lib/ke/production-catalog.ts` — same defaults + migrate
- `src/lib/ke/nesting/cost.ts` [NEW] — same wrapper
- `src/app/admin/ke-catalog/page.tsx`:
  - Section 4 dọn: bỏ "Tiền công mỗi đơn" + "Hệ số lãi (margin)" legacy → chỉ còn 3 input (kerf, sàn hao hụt, nhân công ván cốt)
  - Section 5 [NEW] "Bậc margin IKEA-style": 4 anchor row với tooltip lerp

### KV catalog production (push qua wrangler kv put)

- Key `catalog:production` namespace `9122f2b7b431485389a95a9887cb5516`
- Trước: 6 boards (chỉ MDF/Plywood/Plywood-melamine)
- Sau: 10 boards (thêm 4: mfc_melamine 18/9 + mdf_chong_am_melamine 17/9)
- `updatedAt: 2026-05-27T20:30:00.000Z`

### Production effects observed

| Metric | Trước | Sau |
|---|---|---|
| Preset wide (27 panels, MFC navy) | 7.945k₫ (stepped ×1.5) | 5.561k₫ (interp ×1.37) |
| Add 1 cánh price jump | ~1.5M₫ (cross threshold) | ~25-100k₫ (smooth) |
| Compact/studio/tall/wide (panels 27-36) | flat ×2.0 | tier ×1.37-1.46 (−25%) |
| Loft (129 panels) | flat ×2.0 | tier ×1.91 (gần plateau) |
| Tủ "kệ wide" preset (MFC) | "chưa chạy nesting" (KV thiếu MFC board) | nesting OK, 3 sheets, util 74% |

### Local-only (analysis tools, KHÔNG deploy)

- `scripts/simulate-offcut-pool.ts` — Multi-order simulation 1000 đơn × 5 seeds × 8 strategies (per-order/batch-7/14/30 × ±offcut). Output `/Users/hsonvu/CLAUDE/simulate-offcuts.html` (91KB dashboard 11 sections).
- `src/lib/nesting/with-offcuts.ts` — Wrapper offcut pool reuse, `nestWithOffcutPool()` với best-fit selection + mergeFreeRects để giảm fragmentation.
- `scripts/visualize-nesting.ts` — HTML SVG render nesting 1 preset.

**Kết luận simulation**: Batch-30 + offcut → waste 36.1% ± 0.16, net saving **1213M₫/1000 đơn** = ~1.2M₫/đơn (sau cancel 5% + damage 3% + storage 10k₫/m²/tháng). Chưa productionize (chỉ analysis để quyết business).

### Out-of-scope còn lại

- ⚠️ Productionize offcut pool: CNC workflow label, warehouse 1-2 pallets, admin UI quản lý
- ⚠️ MaxRects algorithm thay Guillotine FFD (+5-10% util)
- ⚠️ DXF export per batch cho operator
- ⚠️ 2-tier delivery: Express +20% / Standard chờ 30 ngày
- ⚠️ Validate giả định realistic với real orders từ Google Sheet `KÊ Orders`

### Memory updates

- `/Users/hsonvu/.claude/projects/-Users-hsonvu-CLAUDE/memory/feedback_production_not_git.md` [NEW]: Rule verify production qua `wrangler deployments list`, KHÔNG suy luận từ git remote (maume deploy chủ yếu qua wrangler local).
- `feedback_admin_local.md` [updated]: cross-link đến `[[production-not-git]]`.

## ✅ Refinement — Bước rời rạc cho `depth` (2026-05-27)

**Yêu cầu founder**: bó chiều sâu vào một số bước cố định để tiết kiệm khổ ván.

**Phương pháp**: viết `scripts/simulate-depth-waste.ts` — Monte Carlo 10.000 đơn
random (cùng seed cho mọi candidate set → fair comparison), build cutlist thật
qua `tuKe.build()`, nest lên 1220×2440 với kerf 3mm, tính util + sheets +
waste VND. Test 10 candidate sets.

**Kết quả** (xem `/tmp/depth-sim.log` hoặc rerun script):

| Bộ | Util | Sheets/đơn | Tiết kiệm/đơn vs free |
|---|---|---|---|
| {300, 400, 600} | 63.88% | 5.57 | 604.441đ (-28.3%) |
| **{300, 400, 500, 600}** ← CHỌN | 62.67% | 5.69 | **512.098đ (-23.9%)** |
| {300, 400, 500, 600, 700} | 61.03% | 6.01 | 310.006đ (-14.5%) |
| Step 50mm (300–700) | 59.08% | 6.24 | 135.862đ (-6.4%) |
| BASELINE (free 300–700) | 57.54% | 6.42 | 0 |

**Chốt** `{300, 400, 500, 600}` step 100mm vì là bộ tốt nhất giữ được "slider
step-đều" (UX quen thuộc, không phải đổi sang type 'option').

**Đã sửa**:
- `products/tu-ke/dna.ts:301` — `depth` parameter: min 300, max 600, step 100,
  default **400** (cũ 350).
- `products/tu-ke/presets.ts` — 4 preset (compact/studio/tall/wide) snap
  `depth: 350` → **400**; loft giữ 400. Header comment "×350" → "×400".
- `public/presets-index.json` — regen qua `pnpm generate-presets`.

**Tổ hợp khít khổ 1220mm** (tận dụng cross-order khi xưởng gom đơn):
- 4 × 300 = 1209/1220 (99% util)
- 3 × 400 = 1206/1220 (99%)
- 2 × 600 = 1203/1220 (98.6%)
- 1×600 + 2×300 = 1206/1220 (98.9%)
- 1×500 + 1×400 + 1×300 = 1206/1220 (98.9% — "tam thể")

**BASELINE S4 đã đổi** (founder duyệt): `8.160.145₫ · 17 tấm · 8.92 m²`
→ **`8.960.049₫ · 17 tấm · 9.64 m²`** (cùng số tấm, +0.72m² vì default depth
350→400). Mọi preset cũng tăng giá tương ứng (xem `pnpm generate-presets` log).

**Verify**: tsc OK · validate 33/33 + 6/6 + 8/8 machining PASS · presets-index
regen OK · CHƯA deploy (ngoài done-criteria phiên này).

---

## ▶ SESSION TIẾP THEO — Test xưởng pilot hoặc S6 SEO / S8 sản phẩm 2

S10 + S10.1 đã deploy đầy đủ (2026-05-24). Founder thử format DXF mới:
1. Admin `/admin/ke-orders` → tải ZIP đơn test
2. Mở `board-N-FRONT.dxf` (industry standard) trong LibreCAD/dxfviewer.com
3. Verify layer naming by tool/Ø (`DRILL_5MM`, `DRILL_8MM`, `POCKET_35MM`)
4. Mở `edge-holes.csv` trong Excel xem confirmat pilot trên cạnh
5. Founder pilot xưởng VN cụ thể → feedback chỉnh spec qua `/admin/ke-catalog`
   Section 5 (JSON editor)

Còn lại optional:
- **S6 SEO**: sitemap/robots/JSON-LD Organization/GA4/Search Console/Lighthouse
- **S8**: sản phẩm 2 + `docs/PRODUCT-GUIDE.md`
- Pretty form Section 5 admin (thay JSON editor) khi spec ổn định
- Bug 6 thùng hộc structured machining (xưởng feedback cần thì add)

> Trạng thái: S1–S5 + S7 + **S9** + **S10 + S10.1 deployed ✅** · S6 còn SEO chưa
> làm · S8 chưa làm · sub-cells PARKED.

## ✅ S10.1 — Refactor catalog spec + bug fixes + DXF industry standard (2026-05-24)

Founder review S10 ban đầu → phát hiện thiếu nhiều: bản lề chuẩn Blum, confirmat
M6.3 (liên kết vách↔ngang), chốt kệ sai vị trí (em đang khoan trên ngang, đúng
phải trên vách), thùng hộc thiếu vít, DXF format không phải industry standard.
Founder yêu cầu: dùng spec phụ kiện VN giá rẻ (Yali/Galin/Sugen) làm default,
admin edit được, fix logic.

### B1: Doc spec — `docs/CNC-WORKSHOP-SPEC.md` (~530 dòng)
9 sections phụ kiện chi tiết + 6 bugs em phát hiện + workflow industry + default
"VN cheap common". Founder confirm: dùng **chốt lò xo nhựa Ø8** cho tấm hậu.

### B2: MachiningSpec types + catalog extension (additive)
- `types.ts`: 9 interface spec + `MachiningSpec` + `MachiningEdgeDrill` op +
  `MachiningPurpose` thêm 'confirmat'/'dowel'.
- `machining-defaults.ts` (NEW): `DEFAULT_MACHINING_SPEC` + `resolveMachiningSpec()`.
- `production-catalog.ts`: `ProductionCatalog.machiningSpec?` + mergeCatalog deep-merge.
- `catalogToPriceConfig`: pass machiningSpec.

### B3: ProductDNA.build accept opts
`BuildOptions { priceConfig? }` — additive. `dna.build(params, opts)` resolves
spec từ opts hoặc DEFAULT.

### B4: Fix 4 critical bugs trong `dna.ts`
- **Bug 1** (chốt kệ sai vị trí): bỏ shelfPin trên tấm ngang đáy/nóc/kệ → move sang
  vách (line 32mm drilling, 2 dãy dọc cột mỗi mặt vách).
- **Bug 2**: drawer slide span 16mm → 32mm (chuẩn 32mm-system).
- **Bug 3** (NEW): thêm confirmat M6.3×50 — pilot Ø5×38 edge drill trên cạnh
  TRÊN+DƯỚI vách + counterbore Ø7×13 + thru Ø6.3 mặt đáy/nóc.
- **Bug 4**: bỏ vít hậu Ø3 → clip lò xo Ø8 (mode='clip', default founder duyệt).

### B5: Admin UI minimal — `/admin/ke-catalog` Section 5
JSON editor textarea cho machiningSpec với "Áp dụng" + "Reset defaults" buttons +
collapsible reference các trường. Pretty form 9 sub-section có thể làm sau.

### B6: DXF refactor industry standard
- `generateBoardFrontDXF()` — board-level lỗ side='front' TRANSFORM coords.
  Layer **by tool/Ø** (`CUT_PATH`, `DRILL_5MM`, `DRILL_8MM`, `DRILL_35MM`,
  `POCKET_35MM`, `ENGRAVE_LABEL`) — CAM software đổi mũi khoan tự động.
- `generateBoardBackDXF()` — chỉ lỗ side='back', flip y = boardWidth - y.
  Xưởng lật tổng board quanh trục dài.
- `generateEdgeHolesCSV()` — CSV machine-readable: board_id, part_id, edge,
  position_mm, diameter_mm, depth_mm, thickness_offset_mm, purpose.
- API `/api/admin/ke-dxf` → output mới ưu tiên + `legacy/parts/*.dxf` cho compat.

### B8: Bug 5+6
- Mặt ngăn kéo: thêm 4 vít M4 side='back' bắt vào hông hộc (4 góc, cách mép 80mm).
- Thùng hộc: note text liên kết — machining defer (xưởng tự dóng cữ).

### Verify ✅ (BASELINE giữ)
- furniture-brand: `tsc` sạch · `pnpm validate` **32/32 + 6/6 + 8/8 machining +
  tự kiểm 6/6** · **BASELINE 8.160.145₫ GIỮ NGUYÊN** · `test-dxf.ts` sinh DXF
  + ZIP 23 files OK · OpenNext build sạch.
- maume: `tsc` sạch · OpenNext build sạch.

### Deploy ✅
- ke-maume worker v`bf631808` (engine bug fixes)
- maume-admin worker v`880912ce` (B5 admin JSON + B6 DXF industry standard)
- Production smoke: BASELINE compact 5.204.049₫ giữ.

### Cấu trúc ZIP mới (B6 industry standard)
```
board-1-mdf_son-18mm-FRONT.dxf    ← Outline + lỗ FRONT, layer by Ø
board-1-mdf_son-18mm-BACK.dxf     ← Lỗ BACK only, flip y
...
edge-holes.csv                    ← Confirmat pilot + dowel trên cạnh
legacy/parts/*.dxf                ← Per-part (cho compat)
legacy/nesting/*-OUTLINE.dxf      ← Outline cũ
README.txt
```

### File mới + đụng — S10.1
- `src/configurator/types.ts`: thêm MachiningEdgeDrill + 9 spec interfaces + BuildOptions
- `src/configurator/machining-defaults.ts` (NEW): DEFAULT_MACHINING_SPEC + resolveMachiningSpec
- `src/lib/production-catalog.ts`: machiningSpec field + mergeCatalog/catalogToPriceConfig
- `products/tu-ke/dna.ts`: refactor dividerMachining + bottom/top/shelf + drawer
- `src/lib/dxf/generator.ts`: thêm generateBoardFrontDXF/BackDXF/EdgeHolesCSV
- `scripts/validate-dna.ts`: rewrite 6 → 8 ca machining cho logic mới
- `docs/CNC-WORKSHOP-SPEC.md` (NEW): research doc 530 dòng

Sync maume: 6 file (types/cutlist/machining-defaults/dna + dxf/generator + production-catalog).
Admin UI: `/admin/ke-catalog/page.tsx` thêm `MachiningSpecSection` component.
API: `/api/admin/ke-dxf/route.ts` dùng new generators.

### Lưu ý
- Pretty form 9 sub-section thay JSON editor (Section 5) — defer khi spec ổn
- Edge holes hiện chỉ confirmat — chưa có dowel edge drill (thêm khi cần)
- Thùng hộc machining = note only
- Validator có thể chưa cover edge cases (kệ giữa fixed mode, multi-product)

## ✅ Session 10 — Hồ sơ xưởng + xuất DXF cho CNC (XONG local 2026-05-24)

Founder duyệt scope FULL: 6 loại lỗ structured (chuẩn Blum/Hettich) + lỗ chân Ø8
+ UI ở admin maume. Engine mở rộng additive → **BASELINE 8.160.145₫ GIỮ NGUYÊN**.

### Engine extension — 2 file `src/configurator/` (additive, founder duyệt qua plan)
- **`types.ts`**: thêm types `MachiningSide` (`'front'|'back'`) · `MachiningPurpose`
  (handle/hinge/shelfPin/drawerSlide/backScrew/foot/other) · `MachiningDrill`
  (op:drill + x/y/Ø/depth/through) · `MachiningPocket` (op:pocket — cup bản lề
  Ø35×13mm). `Part` thêm `machining?: Machining[]` (tùy chọn). Quy ước toạ độ:
  gốc (0,0) = góc trái dưới frame physical, x_mm theo length axis, y_mm theo
  width axis. Side='front' = mặt khoan chính.
- **`cutlist.ts`**: `Cutlist` thêm `parts?: Part[]` raw (không gộp) — giữ machining
  riêng từng Part cho DXF/nesting. `mergeKey` KHÔNG đụng → UI cutlist text bất biến.

### DNA backfill — `products/tu-ke/dna.ts`
14 hằng số S10 chuẩn Blum/Hettich (cup Ø35×13 inset 22mm · plate 32mm spacing
inset 37mm · slide screw 16mm span inset 37mm · foot Ø8 sâu 12mm). Founder tinh
chỉnh được khi pilot xưởng. Helpers mới:
- Top-level: `drill()`/`pocket()` builder · `panelCoord()` chuyển scene→panel-local
  (smart axis detection từ size sort).
- Closure trong `build()`: `xpH/ypH` · `horizPinDrills()` · `horizBackScrewDrills()`
  · `dividerMachining(k,r)` (bản lề plate + ray drill) · `frontFaceMachining()`
  (handle + cup hinge + vít cup).

Mỗi panel() call nâng cấp:
- Đáy: shelfPin 'front' + backScrew 'front' + **foot Ø8 'back'** (mặt dưới)
- Nóc: shelfPin 'front' + backScrew 'front' (front=mặt dưới của nóc)
- Kệ giữa: shelfPin CẢ 2 SIDE + backScrew **through=true** xuyên
- Vách: hinge plate Ø4 hoặc drawerSlide Ø4 (front=mặt PHẢI vách)
- Cánh: handle Ø35 through + cup pocket Ø35×13 + 2 vít cup Ø4 'back'
- Mặt ngăn kéo: handle Ø35 through

Hoist `footZ` lên đầu `build()` (cần cho bottomMachining trước fittings loop).

### Lib mới furniture-brand
- **`src/lib/dxf/types.ts`**: `NestedPlacement` · `NestedBoardLayout` · `NestingResult`.
- **`src/lib/dxf/generator.ts`** (~210 dòng zero-dep): `generatePartDXF` +
  `generateNestingDXF`. DXF **R12 ASCII** (40 năm precedent). Layers: `OUTLINE` ·
  `DRILL_FRONT/BACK_<PURPOSE>` · `POCKET_FRONT/BACK_HINGE` · `TEXT_LABEL` ·
  `TEXT_FLIP_INSTRUCTION` (chỉ khi có lỗ side='back'). Tiếng Việt diacritics
  transliterate ASCII (xưởng CNC viewer cũ). Side='back' → y_mm flip = `W-y_mm`
  (lật quanh trục dọc giữ chiều vân).
- **`src/lib/dxf/zip.ts`** (~110 dòng zero-dep): STORE-only ZIP Workers-safe (chỉ
  Uint8Array+DataView+TextEncoder). CRC-32 IEEE 802.3 precomputed table.
- **`src/lib/nesting/index.ts`** (~190 dòng zero-dep): guillotine FFD, SAS heuristic
  split, support kerf + rotation (chỉ grain='none'). Default tủ 17 tấm → ~50%
  avg utilization (acceptable MVP).

### Validator extension — `scripts/validate-dna.ts`
Thêm **6 ca machining** additive (giữ 32+6+tự-kiểm cũ):
1. Đáy default — ≥4 shelfPin + ≥2 backScrew + ≥4 foot side='back'
2. Nóc default — ≥4 shelfPin + ≥2 backScrew
3. Kệ giữa (rows=3) — shelfPin CẢ 2 side + backScrew through=true
4. Cánh đơn (width=1000) — 1 handle + ≥2 cup Ø35 + ≥4 vít Ø4
5. Vách bên cánh — ≥4 hinge plate Ø4
6. Vách bên ngăn kéo (height=700) — ≥4 drawerSlide Ø4

### CLI test — `scripts/test-dxf.ts`
Build default → 17 part DXFs + 6 board nesting DXFs + output.zip (21KB, 23 files)
trong /tmp/dxf-test. Verify thủ công trong LibreCAD / dxfviewer.com.

### Maume admin UI mới — `/admin/ke-orders`
- **`/api/admin/ke-orders/route.ts`** (GET): proxy Apps Script `doGet?token=...`.
- **`/api/admin/ke-dxf/route.ts`** (POST `{slug, values}`): build → cutlist →
  nestBoards → generatePartDXF×N + generateNestingDXF×M + createZip → trả `application/zip`.
- **`/admin/ke-orders/page.tsx`**: table list + modal detail + button "Tải ZIP".
- `admin/layout.tsx`: nav thêm "KÊ Orders" 📋.
- `wrangler.jsonc`: comment 2 secrets cần.

### Apps Script `ke-orders-script/Code.js`
`doGet()` mở rộng: query `?token=<ADMIN_READ_TOKEN>` → trả `{success, orders: OrderRow[]}`
gồm 16 cols Sheet (timestamp/name/phone/slug/valuesJson/total/...). Không có token →
health check như cũ.

### Sync maume — 6 file
- `maume/src/lib/ke/configurator/types.ts` + `cutlist.ts` (identical)
- `maume/src/lib/ke/products/tu-ke/dna.ts` (alias adapt `@/configurator/`→`@/lib/ke/configurator/`)
- `maume/src/lib/ke/dxf/{types,generator,zip}.ts` (alias adapt)
- `maume/src/lib/ke/nesting/index.ts` (alias adapt)

### Verify ✅
- furniture-brand: `tsc` sạch · `pnpm validate` **32/32 + 6/6 + 6/6 machining +
  tự-kiểm 6/6** · **BASELINE 8.160.145₫ · 17 tấm · 8.92 m² GIỮ NGUYÊN** ·
  `test-dxf.ts` → /tmp/dxf-test/*.dxf + output.zip OK · OpenNext build sạch
  (worker 3.3MB / 906KB gz).
- maume: `tsc` sạch · OpenNext build sạch (worker 6.2MB / 1.17MB gz).

### S10 Deploy (founder làm thủ công)
1. **Apps Script**: `cd ke-orders-script && clasp push` → mở https://script.google.com
   → KE Orders Webhook → Deploy → New deployment → Web App / Anyone → note NEW
   deployment ID. Project Settings → Script Properties → `ADMIN_READ_TOKEN` =
   `openssl rand -hex 16`.
2. **Maume secrets**: `cd maume && npx wrangler secret put KE_ORDER_WEBHOOK`
   (paste NEW deployment ID) + `npx wrangler secret put KE_ORDERS_READ_TOKEN`
   (paste cùng ADMIN_READ_TOKEN). LƯU Ý: furniture-brand cũng cần update
   `KE_ORDER_WEBHOOK` với deployment ID mới.
3. **Verify**: `curl 'https://script.google.com/macros/s/<ID>/exec?token=<TOKEN>'`
   → `{success:true, orders:[...]}`.
4. **Catalog boards**: `admin.maume.asia/admin/ke-catalog` mục "Khổ ván" nhập 6
   dòng (3 loại × 2 độ dày × 1220×2440). Không nhập → nesting unplaced hết.
5. **Deploy**: `nvm use 22 && npx @opennextjs/cloudflare build && npx wrangler deploy`
   ở cả 2 dự án.

### Lưu ý
- **BASELINE bất biến**: machining tùy chọn, Cutlist.parts? tùy chọn — pricing
  không đọc machining, mergeKey không đụng.
- **Hằng số Blum**: standard công nghiệp; founder chỉnh khi pilot.
- **Nesting 50% utilization**: workaround — set grain='none' cho tấm hậu hoặc
  upgrade thuật toán MaxRects (sau).
- **Tiếng Việt DXF**: TEXT entity transliterate ASCII (compatible xưởng VN viewer
  cũ). Toạ độ + lỗ chính xác.
- **Render 3D KHÔNG đụng**: vẫn dùng `Part.holes` cho tay nắm Ø35.

## ✅ Catalog v3 — MDF chống ẩm An Cường + Edge banding (XONG local 2026-05-24)

Founder bổ sung **loại ván mới** "MDF chống ẩm phủ melamine" (An Cường) — cùng
6 mã NCC với plywood An Cường (MS 030 SH / MS 230 S / MS 9205 S / MS 025 MM /
MS 083 T / MS 050 T), nhưng cấu tạo MDF chống ẩm + dán cạnh ĐỒNG MÀU. Giá:
**240.000₫/m²** (17mm physical) · **165.000₫/m²** (9mm). Catalog 29 → **35 màu**.

Đồng thời tách **giá dán cạnh** thành dòng riêng trong báo giá (theo chu vi) —
áp cho mọi material có dán cạnh (mdf_son, mfc, plywood Minh Long, mca_*).
Plywood An Cường (lộ cạnh) KHÔNG tính.

### Phạm vi engine (additive — founder duyệt qua plan trước khi code)

**3 file engine `src/configurator/`** (tất cả additive, BASELINE validator giữ):
- **`types.ts`**: thêm `Part.perimeter?` (mm — set bởi cutlist) +
  `PriceConfig.edgeBandingPricePerM?` + `PriceConfig.edgeBandingMmByBoardType?`.
- **`cutlist.ts`**: nếu config có `edgeBandingMmByBoardType` cho material (và
  material không `noEdgeBanding`) → trừ kích thước cắt 2×ebMm mỗi chiều +
  set `Part.perimeter` (chu vi bản vẽ) + tổng `Cutlist.totalEdgeBandingM`.
  Build.parts gốc KHÔNG bị mutate (render 3D vẫn đúng kích thước thiết kế).
- **`pricing.ts`**: cộng dòng "Dán cạnh đồng màu" = `totalPerimeter × pricePerM`
  vào materialCost (chịu margin). Iterate build.parts trực tiếp (không qua Cutlist).
  Chỉ kích hoạt khi config có cả 2 field; vắng → tương thích ngược S9.

⚠️ **Quyết định kiến trúc 17mm**: dna.ts T = 18 GIỮ NGUYÊN (không refactor).
Catalog lưu rate MDF chống ẩm ở key 17 (founder data đúng physical), `catalogToPriceConfig`
**alias 17 ↔ 18** trong materialRates → engine lookup ở thickness 18 vẫn tìm được.
Lý do: refactor T (>20 chỗ sử dụng spacing math) sẽ phá BASELINE; deferred.

### Catalog `production-catalog.ts` v3
- `version: 3` · `boardTypes` 3 → **4** (thêm `mdf_chong_am_melamine`, density 720,
  edgeBandingMm 0.4) · các boardType cũ cũng thêm field `edgeBandingMm` (default 0.4).
- `CatalogColor.ratePerM2`: type lỏng hơn — `{18?, 17?, 9}` (cho phép 17 hoặc 18).
- 6 màu mới `mca_*` cho boardType mới (cùng 6 mã NCC An Cường — mã trùng nhưng
  loại ván khác). Bật cho `tu-ke` mặc định.
- `hardware` 4 → **5**: thêm row `edge_banding` (đơn vị "m", giá 8.000₫/m default).
- `catalogToPriceConfig`: alias rate body 17↔18, expose `edgeBandingPricePerM` từ
  hardware id="edge_banding", expose `edgeBandingMmByBoardType` từ boardTypes.
- `mergeCatalog`: nhận **CẢ v2 lẫn v3** (migration soft) — KV v2 cũ founder đã lưu
  sẽ giữ tất cả customizations cho 29 màu / 3 boardTypes / 4 hardware; 6 màu mới
  + boardType mới + edge_banding lấy từ DEFAULT. Founder Save 1 lần → KV lên v3.
- `validateCatalog`: 4 boardTypes + 35 colors (rate body ≥1 trong {17, 18}) + 5 hardware.

### Materials + DNA
- `materials.ts`: thêm `CATALOGS.mdf_chong_am_melamine` với 6 màu — `metalness: 0,
  roughness: 0.55`, **KHÔNG có** `edgeHex`/`noEdgeBanding` → renderer mặc định
  edge banding ĐỒNG MÀU (cùng hex face + edge), cutlist tính chu vi/giá dán cạnh.
- `dna.ts MATERIALS`: thêm 6 lựa chọn `mdf_chong_am_melamine/mca_*` (cuối list).

### Admin maume `ke-catalog/page.tsx`
- Render 4 nhóm boardType (thay vì 3) — mỗi nhóm có input **"Độ dày dán cạnh (mm)"**
  bên cạnh Mật độ.
- Cột header "Giá body" hiển thị **17mm** cho `mdf_chong_am_melamine`, **18mm**
  cho 3 loại khác — input bind đúng key.
- Section "Phụ kiện": tự thêm row "Dán cạnh đồng màu" (5 row total).

### Verify ✅
- furniture-brand: `tsc` sạch · `validate` **32/32 + 6/6 + 6/6 + tự kiểm** ·
  BASELINE **8.160.145₫** giữ (validator dùng `dna.priceConfig` không có edge
  banding config) · OpenNext build sạch.
- maume: `tsc` sạch · OpenNext build sạch (admin/ke dùng configurator engine
  → render 4 boardTypes + 35 màu).
- Preview e2e:
  - Default tủ mdf_son: giá web qua catalog = **`8.882.782₫`** (tăng +722.637₫ từ
    8.160.145₫ baseline) — edge banding cost (~17 tấm × chu vi × 8.000₫ × 1.6 margin).
  - Tủ MCA Vàng nghệ: **`4.042.049₫`** (giá An Cường 240k/m² < mdf_son 700k/m²
    → vật liệu rẻ hơn 66%, bù trừ phần edge banding).
  - Render màu MCA Vàng nghệ #F8D150 chính xác.

### BASELINE WEB sau khi founder cấu hình
- **Validator BASELINE**: 8.160.145₫ — GIỮ (cố định, dùng cho gate test).
- **Web BASELINE thực tế (sau founder admin save 2026-05-24)**: vẫn **8.160.145₫**
  cho default tủ mdf_son. Lý do: founder set `edgeBandingMm = 0` cho 3 boardType
  cũ (mdf_son · plywood_veneer · plywood_melamine) qua admin → engine skip edge
  banding cost cho default tủ → giá trùng baseline.
- **CHỈ MDF chống ẩm phủ melamine** (`mdf_chong_am_melamine`, edgeBandingMm = 0.4)
  có cộng dán cạnh đồng màu. Vd tủ MCA Vàng nghệ = **4.042.049₫** (đã verify live).
- Đây là **business model founder chốt**: dán cạnh chỉ áp cho 1 loại ván duy nhất.

### Sync maume — 6 file
4 file engine + `lib/ke/production-catalog.ts` (1 dòng import path) + admin page.
`diff` xác nhận: engine 4 file BYTE-IDENTICAL · catalog/dna 1 / 3 dòng import.

### Đã deploy (2026-05-24)
- ke-maume v`fb6fd499-e5c3-4380-8684-e04307d57cc3` (gồm 6 màu MCA + edge banding cost)
- maume-admin v`a0cbefa8-43b8-4e5f-8a9f-3d307076acb3`
- Verify live: ke.maume.asia `/` `/design` `/collection` = 200 · admin.maume.asia
  `/admin/ke` `/admin/ke-catalog` = 200 · API `/api/admin/ke-catalog` = 401.

## ✅ Catalog v3.1 — MCA cạnh đen (6 variant) + Swatch 2-half diagonal (2026-05-24)

Founder bổ sung **option cạnh đen** cho 6 màu MCA hiện có → 12 tổng options MCA.
UI swatch nâng cấp: tự động diagonal 2-half (↖ face · ↘ edge) cho mọi material
có `edgeHex !== hex`. Catalog 35 → **41 màu**.

### Phạm vi — 4 file engine + 1 admin (additive, founder duyệt qua AskUserQuestion)

**`src/configurator/materials.ts`**: thêm 6 entries `mca_*_edge_den` vào
CATALOGS.mdf_chong_am_melamine với `hex` = face material + `edgeHex: '#000000'`.
Renderer 2-tone (đã có từ S5 polish cho plywood) **tự động** reuse — không đụng
`renderer.tsx`. Tủ render face + edge đen line ở mọi cạnh panel.

**`src/configurator/Configurator.tsx`**: thêm helper `swatchStyle(material)`
→ trả về `linear-gradient(135deg, hex 50%, edgeHex 50%)` khi 2-tone, hoặc
`backgroundColor: hex` khi đồng màu. Áp dụng 2 spot: option button (Vật liệu khung
tab) + cutlist row swatch. **Side effect intended**: plywood An Cường/Minh Long
(`edgeHex: '#D4A574'` birch lộ cạnh) cũng hiện 2-half → UI honest với khách.

**`products/tu-ke/dna.ts MATERIALS`**: thêm 6 lựa chọn với label
"MCA <Tên> · cạnh đen".

**`src/lib/production-catalog.ts`**: thêm 6 dòng `defColor()` với cùng giá MCA
(240k/165k), mã NCC giống bản đồng màu, supplier An Cường. validateCatalog
35 → **41 colors**. Comments cập nhật.

**Admin maume `ke-catalog/page.tsx`**: thêm helper `swatchStyle()` inline (4
dòng — tránh import từ Configurator để không kéo R3F vào admin bundle). Bảng
màu giờ hiển thị 12 màu cho mdf_chong_am_melamine (6 đồng + 6 cạnh đen).

### Verify ✅
- furniture-brand: `tsc` sạch · `validate` **32/32 + 6/6 + 8/8 machining + tự kiểm**
  · BASELINE **8.160.145₫** giữ · OpenNext build sạch.
- maume: `tsc` sạch (fix sync sed pattern: cần catch cả `types` và `machining-defaults`)
  · OpenNext build sạch.
- Live e2e (Playwright):
  - `optionCount`: 6 MCA cạnh đen options hiển thị đầy đủ ✓
  - Swatch CSS: `linear-gradient(135deg, rgb(248, 209, 80) 50%, rgb(0, 0, 0) 50%)` ✓
  - Switch sang MCA Trắng kem cạnh đen → render face cream + edge đen line rõ ✓
  - Giá `4.042.049₫` (bằng MCA đồng màu — cùng material rate)

### Đã deploy (2026-05-24)
- ke-maume v`6982c3e8-9efe-43d9-8698-77af0b6a632c`
- maume-admin v`62c12bfa-33c7-4726-80d6-499342773e7c`
- Verify live: tất cả endpoint 200/401, MCA cạnh đen hoạt động đầy đủ.

### Lưu ý
- Founder **không cần** Save admin để 6 màu mới vào KV — `mergeCatalog` tự thêm
  từ DEFAULT_CATALOG. Nếu founder Save một lần, KV sẽ có đầy đủ 41 entries.
- **Pattern future expansion**: mỗi edge variant mới (đen / trắng / xám / vàng kim) là
  6 entries trong materials.ts + 6 entries DNA + 6 entries catalog + 1 entry boardType
  edgeBandingMm (nếu khác 0.4mm). Có thể tự động hóa bằng script generator sau.
- **Sync sed pattern** học được: dùng generic `'../configurator/'` thay vì hardcode
  `'../configurator/types'` để không miss imports khác (vd `machining-defaults`).

### Lưu ý
- **17mm dna.ts deferred**: Nếu cần literal 17mm cho body của MCA trong cutlist/BOM,
  cần refactor T per material trong dna.ts (>20 chỗ). Hiện engine vẫn report 18mm
  cho MCA panels — xưởng manually translate "MCA = mua 17mm boards An Cường".
- **Migration v2 → v3**: KV cũ tự upgrade khi mergeCatalog đọc; founder Save 1 lần
  trong admin để KV chính thức lên v3 (chỉ ảnh hưởng updatedAt).

## ✅ Session 9 — Đầu vào sản xuất: catalog vật liệu & phụ kiện (XONG 2026-05-23)

Số liệu sản xuất (đơn giá ván/phụ kiện, mật độ, cân, khổ ván, kerf, nhân công,
margin) tách khỏi hằng số cứng `pricing.ts` → thành **"catalog sản xuất"** lưu
Cloudflare KV (key `catalog:production`, cùng namespace `ke-presets`), admin
maume CRUD được, web KÊ đọc để tính giá tủ.

### Engine mở rộng — 4 file `src/configurator/` (additive, founder duyệt qua plan)
Chỉ-thêm-không-phá; caller cũ không truyền gì → fallback hằng số → kết quả y hệt.
- `types.ts`: `PriceConfig` thêm 4 field tùy chọn — `materialRates?` /
  `hardwarePrices?` / `materialDensities?` / `hardwareWeights?`.
- `pricing.ts`: `computePrice` đọc `config.materialRates?.[…] ?? MATERIAL_RATE_PER_M2[…]`
  — hằng số cũ thành lớp fallback mặc định.
- `cutlist.ts`: `buildCutlist(build, config?)` — thêm tham số tùy chọn ở CUỐI;
  cân nặng đọc `config?.materialDensities`/`hardwareWeights` nếu có.
- `Configurator.tsx`: thêm prop tùy chọn `priceConfig?` override `dna.priceConfig`.

### Tầng catalog (ngoài engine)
- `src/lib/production-catalog.ts` (MỚI): type `ProductionCatalog` + `DEFAULT_CATALOG`
  (mirror CHÍNH XÁC hằng số `pricing.ts` → neo giữ BASELINE) + `catalogToPriceConfig()`
  (phẳng hoá → PriceConfig) + `mergeCatalog()` (gác cổng KV thiếu dòng) +
  `validateCatalog()` + `getProductionCatalog()` (đọc KV, fallback DEFAULT).
- Routes đọc catalog → bơm `priceConfig`: `design/page.tsx` + `DesignClient.tsx`,
  `collection/page.tsx`, `collection/[slug]/page.tsx`, `page.tsx` + `HomeFeatured.tsx`.
- `page.tsx` (landing) thêm `export const dynamic = "force-dynamic"` — landing
  trước là static → giá đông cứng build-time; ép dynamic để đọc catalog KV live.

### Admin maume — `admin.maume.asia/admin/ke-catalog` (MỚI)
- `src/lib/ke-catalog-store.ts`: KV CRUD `getCatalog`/`putCatalog` (key singleton
  `catalog:production`; `getKV` throw-on-missing).
- `src/app/api/admin/ke-catalog/route.ts`: GET (KV trống → DEFAULT) + POST
  (validate → ghi). Auth tự động qua middleware `/api/admin/*`.
- `src/app/admin/ke-catalog/page.tsx`: form 4 mục — Vật liệu (3 dòng cố định) ·
  Phụ kiện (4 dòng cố định + SKU) · Khổ ván (list thêm/xoá) · Nhân công/kerf/margin.
  Import `production-catalog` dạng `import type` (chặn `getCloudflareContext`
  lọt client bundle).
- `admin/layout.tsx`: thêm nav "KÊ Vật liệu & Giá" + sửa `isActive` dùng
  `startsWith(href + "/")` (tránh `/admin/ke-catalog` làm sáng cả `/admin/ke`).

### Sync maume — 5 file phải đồng bộ khi engine đổi
4 engine file `configurator/{types,pricing,cutlist}.ts` + `Configurator.tsx`
→ `maume/src/lib/ke/configurator/` (đã `diff` xác nhận IDENTICAL). File
`production-catalog.ts` → `maume/src/lib/ke/production-catalog.ts` (khác đúng 1
dòng import: `./configurator/types` thay `../configurator/types`).

### Verify ✅
- furniture-brand: `tsc` sạch · `pnpm validate` **32/32 build · 6/6 pipeline · tự
  kiểm 6/6** · BASELINE **8.160.145₫ · 17 tấm · 8.92 m²** GIỮ NGUYÊN ·
  `generate-presets` giá 5 preset không đổi · OpenNext build sạch (`/` giờ ƒ Dynamic).
- maume: `tsc` sạch · OpenNext build sạch.

### ✅ Đã deploy (2026-05-23)
Ban đầu hoãn deploy (ngoài done-criteria phiên đó); sau founder duyệt → đã deploy
cùng đợt với "Catalog v2" bên dưới. Lệnh: `npx @opennextjs/cloudflare build &&
npx wrangler deploy` ở mỗi dự án (furniture-brand cần Node 22). Hoặc maume: push
`main` → `deploy-admin.yml` tự deploy.

### Lưu ý / quyết định
- **Seed**: KHÔNG cần script. `getProductionCatalog()` fallback `DEFAULT_CATALOG`
  khi KV trống → web chạy đúng ngay (giá = baseline). Admin mở `/admin/ke-catalog`
  (form điền sẵn DEFAULT) → bấm Lưu lần đầu = ghi KV `catalog:production`.
- **`deploy-admin.yml`**: định thêm path trigger `src/lib/ke-catalog-store.ts` +
  `src/lib/ke/**` nhưng bị security hook chặn sửa file workflow. CẦN thêm tay 2
  dòng đó vào mục `paths:` (hoặc bỏ qua — deploy admin vẫn kích hoạt từ thay đổi
  trong `src/app/admin/**` + `src/app/api/admin/**` đã có sẵn trong trigger).
- **Chi phí**: 0₫ — tái dùng KV namespace `ke-presets` sẵn có, không tạo tài
  nguyên Cloudflare mới.

## ✅ Catalog v2 — giá theo từng màu ván + mã nội bộ + bật/tắt màu (2026-05-23)

Founder yêu cầu catalog quản lý theo TỪNG MÀU thay vì theo loại ván: **23 màu**
(9 MDF sơn + 3 veneer + 11 melamine), mỗi màu có giá riêng (18/9mm), **mã nội
bộ**, và **bật/tắt riêng cho từng sản phẩm (DNA)** — màu tắt biến mất khỏi bảng
chọn màu trong configurator.

### Engine mở rộng — 3 file (additive, founder duyệt qua plan)
- `types.ts`: `PriceConfig` thêm `materialLabels?` (nhãn dòng bảng giá theo màu).
- `pricing.ts`: `computePrice` gộp diện tích theo MÃ MÀU đầy đủ (`catalog/id`)
  thay vì theo loại ván; thang fallback `materialRates[màu] ?? [catalog] ??
  hằng số`. BASELINE giữ vì validator dùng `tuKe.priceConfig` (không materialRates)
  → mọi màu fallback về đơn giá-loại-ván cũ → tổng y hệt.
- `Configurator.tsx`: prop `enabledMaterials?: string[]`; `controls` lọc bỏ
  option màu (value chứa `/`) không nằm trong danh sách bật — giữ `FRAME_COLOR`
  + màu đang chọn. Vắng prop → không lọc (tương thích ngược).

### `production-catalog.ts` → v2
- `ProductionCatalog` v2: `boardTypes[3]` (loại ván — giữ mật độ) + `colors[23]`
  (id `catalog/id` · label · `code` mã nội bộ · `ratePerM2{18,9}` · `enabledFor`
  slug DNA). `hardware`/`boards`/`labor`/`kerfMm`/`margin` giữ nguyên.
- `DEFAULT_CATALOG` v2: 3 boardType + 23 màu, giá mỗi màu = giá loại ván cũ →
  BASELINE bất biến.
- `catalogToPriceConfig`: `materialRates`+`materialLabels` theo id màu,
  `materialDensities` theo loại ván. Thêm `enabledMaterialsForDna(catalog,slug)`
  + `KNOWN_DNAS = [{slug:'tu-ke', label:'Tủ kệ'}]`.
- `mergeCatalog`/`validateCatalog` cập nhật v2. version 1→2 (KV chưa từng lưu →
  không cần migrate v1).

### Routes + Admin
- `design/page.tsx` tính `enabledMaterialsForDna(catalog,'tu-ke')` → truyền qua
  `DesignClient` → prop `enabledMaterials`. `collection/*` + `HomeFeatured` KHÔNG
  đổi (chỉ gọi `catalogToPriceConfig`, tự chạy với v2).
- Admin `ke-catalog/page.tsx` mục "Vật liệu" viết lại: 3 nhóm loại ván (mỗi nhóm
  1 ô mật độ) + bảng 23 màu (ô màu hex + Tên SỬA ĐƯỢC · Mã nội bộ · Giá 18 ·
  Giá 9 · cột ☑ bật/tắt per-DNA sinh theo `KNOWN_DNAS`). Ô màu render bằng
  `resolveMaterial(id).hex` (import từ engine copy — pure, client-safe). Sửa tên
  màu → lưu vào catalog → hiện ở bảng phân tích giá (`materialLabels`); bảng chọn
  màu cho khách trên web vẫn lấy tên từ `dna.ts MATERIALS` (chưa nối — việc sau).

### Sync maume — 4 file
`configurator/{types,pricing,Configurator}` + `production-catalog.ts` →
`maume/src/lib/ke/` (3 engine `diff` IDENTICAL; production-catalog khác đúng 1
dòng import). Bộ file phải sync nay gồm 5: `configurator/{types,pricing,cutlist}.ts`
+ `Configurator.tsx` + `production-catalog.ts`.

### Verify ✅
- furniture-brand: `tsc` sạch · `pnpm validate` **32/32 + 6/6 + tự kiểm** ·
  BASELINE **8.160.145₫** giữ · `generate-presets` giá 5 preset không đổi ·
  OpenNext build sạch.
- maume: `tsc` sạch · OpenNext build sạch.
- Đã deploy (2026-05-23, founder duyệt): worker `ke-maume` v`f8f09699` +
  `maume-admin` v`e24317c9` (lần cuối — gồm cả ô màu hex + tên sửa được). Verify
  production: ke.maume.asia/collection/compact = 5.204.049₫ (BASELINE giữ —
  catalog v2 chạy đúng) · admin/ke-catalog HTTP 200 · API `/api/admin/ke-catalog`
  chặn 401 khi chưa đăng nhập.

### Lưu ý
- Màu bị tắt mà cabinet đang dùng: 3D vẫn vẽ đúng (`resolveMaterial` không phụ
  thuộc bật/tắt), khung tủ giữ giá trị đang chọn — chỉ không còn trong bảng chọn.
- Thêm sản phẩm mới (Session 8) → thêm 1 dòng vào `KNOWN_DNAS` → admin tự có
  thêm cột bật/tắt; route sản phẩm đó truyền `enabledMaterials` riêng.

## ✅ Catalog — thêm 6 màu An Cường + field NCC (2026-05-23)

Founder bổ sung 6 màu ván plywood melamine của **An Cường**; làm rõ 11 màu
melamine cũ là của **Minh Long**. Catalog 23 → **29 màu**.

### 6 màu An Cường (plywood_melamine · giá 330.000/233.000₫ cho 18/9mm)
| Mã nội bộ | id | Tên | hex |
|---|---|---|---|
| MS 030 SH | ac_vang_nghe | ML Vàng nghệ | #F8D150 |
| MS 230 S | ac_den_tuyen | ML Đen tuyền | #000000 |
| MS 9205 S | ac_trang_kem | ML Trắng kem | #E4E0D4 |
| MS 025 MM | ac_nau_xam | ML Nâu xám | #897F75 |
| MS 083 T | ac_xanh_muc | ML Xanh mực | #052345 |
| MS 050 T | ac_xanh_thien_thanh | ML Xanh thiên thanh | #84B0CD |

Hex lấy bằng resize-1×1 từ ảnh swatch trong `~/Downloads` (ảnh là màu phẳng đặc).
Mã nội bộ = mã trong TÊN ẢNH (không liên quan hex). Mã ML 2xx của Minh Long khớp
100% ảnh "BST màu đơn sắc" (xác minh dò hex lệch 0.0).

### Thay đổi
- `materials.ts`: +6 entry `CATALOGS.plywood_melamine` (hex + edgeHex `#D4A574` +
  noEdgeBanding — cùng cấu tạo lộ cạnh như Minh Long).
- `dna.ts MATERIALS`: +6 lựa chọn màu (khách chọn được trong configurator).
- `production-catalog.ts`: `CatalogColor` thêm field `supplier`. `defColor` nhận
  thêm `code`/`supplier`/`rate?` (tham số tùy chọn ở cuối — 12 lời gọi MDF/veneer
  cũ không đổi). 11 màu Minh Long gán code "ML 2xx" + supplier "Minh Long"; 6 màu
  An Cường gán "MS xxx" + "An Cường" + giá riêng. `validateCatalog` 23→29.
- Admin `ke-catalog/page.tsx`: bảng màu thêm cột **NCC** (ô nhập, bind `col.supplier`).
- Engine LOGIC KHÔNG đổi — chỉ thêm dữ liệu màu.

### Sync maume — 4 file
`materials.ts` + `production-catalog.ts` (cp; production-catalog khác 1 dòng
import) · `dna.ts` (sửa tay — khác 3 dòng import, 6 dòng An Cường khớp nội dung) ·
`ke-catalog/page.tsx` (maume-only).

### Verify ✅
- furniture-brand: `tsc` sạch · `validate` **32/32 + 6/6 + tự kiểm** · BASELINE
  **8.160.145₫** giữ (tủ mặc định không dùng melamine) · `generate-presets` giá 5
  preset không đổi · OpenNext build sạch.
- maume: `tsc` sạch · OpenNext build sạch.
- Đã deploy (2026-05-23): ke-maume v`a3efddeb` · maume-admin v`02f0a1e9` (gồm
  cả bug fix bên dưới). Verify: /collection/compact = 5.204.049₫ · /design 200 ·
  admin/ke-catalog 200 · API chặn 401.

### Bug fix — admin không hiện 6 màu An Cường (2026-05-23)
Founder báo trang ke-catalog không thấy 6 màu An Cường. **Nguyên nhân**: admin
`GET /api/admin/ke-catalog` trả THẲNG bản KV (catalog cũ 23 màu, founder lưu
22/5) — KHÔNG qua `mergeCatalog`; còn web (`getProductionCatalog`) thì CÓ merge
nên /design vẫn thấy 29 màu. Bất đối xứng. **Sửa**: route GET dùng
`mergeCatalog(stored)` → nâng bản KV cũ lên 29 màu (6 An Cường + mã + NCC điền từ
DEFAULT). `mergeCatalog` cũng chỉnh: `code`/`supplier` rỗng ở bản cũ → lấy giá
trị DEFAULT (`s.code || def.code`) để mã ML/MS hiện ra. Catalog KV cũ KHÔNG có
tùy chỉnh (giá toàn mặc định — đã kiểm) nên merge an toàn. Founder bấm Lưu 1 lần
→ KV cập nhật thành bản 29 màu.

### Lưu ý
- 2 NCC cùng loại ván "plywood phủ melamine" — phân biệt bằng field `supplier`,
  KHÔNG tách loại ván. Per-color pricing (Catalog v2) cho phép 2 NCC giá khác nhau
  sống chung 1 loại ván.
- Tên 6 màu An Cường là ĐỀ XUẤT — founder sửa được trong admin.

## ✅ Render 3D — sửa màu bị tối + bóng đổ mềm như ánh sáng trong nhà (2026-05-23)

Founder báo render làm màu **tối hơn thật**, lòng hộc tủ "đen xì" → khó phân biệt
ô có cánh / không cánh; bóng đổ **gắt như nắng trưa**. Yêu cầu: render đúng màu
(quan trọng với khách) + ánh sáng dịu kiểu trong nhà.

### Nguyên nhân
- R3F mặc định dùng `ACESFilmicToneMapping` — dìm tối + lệch tông → sai màu thật.
- Đèn nền quá thấp (ambient 0.2 / hemisphere 0.6) → lòng hộc tủ gần như đen.

### Thay đổi — 2 file engine `src/configurator/` (additive, founder duyệt qua plan)
- **`Configurator.tsx`**: Canvas `gl` thêm `toneMapping: NeutralToneMapping`
  (Khronos PBR Neutral — giữ màu trung thực; áp cho cả 2 nhánh isShot).
  `SHADOW_CONFIG.type` = `PCFShadowMap` (three r184 đã DEPRECATE
  `PCFSoftShadowMap` → tự fallback + cảnh báo console; dùng thẳng cho gọn).
- **`renderer.tsx` `SceneLighting`**: cân lại đèn cho tone mapping Neutral + cảm
  giác trong nhà — ambient 0.2→**2.5**, hemisphere 0.6→**1.4**, đèn chính (key)
  1.6→**1.1** + `shadow-radius={7}` + `shadow-intensity={0.7}` (bóng mềm, nhạt,
  không gắt), đèn phụ (fill) 0.5→**0.62**.
- ⚠️ three r184: thang `intensity` đèn ~**6×** so trực giác cũ — đèn nền phải đặt
  cao thì màu mới ra đúng dưới toneMapping Neutral (đã ghi chú trong code).
- Engine LOGIC + giá KHÔNG đổi — chỉ tầng hiển thị 3D.

### Verify ✅
- furniture-brand: `tsc` sạch · `validate` **32/32 + 6/6 + tự kiểm** · BASELINE
  **8.160.145₫** giữ (render không chạm pricing) · OpenNext build sạch.
- maume: `tsc` sạch · `next build` sạch (admin `/admin/ke` cũng dùng configurator
  này → render đẹp lên theo).
- Đo pixel trên preview `/design`: mặt ngoài tủ `#45–#4b` · lòng hộc `#4c–#52` ·
  màu thật `#4e4e4e` → khớp màu, lòng hộc rõ ràng, tường không bị "cháy" trắng.

### Sync maume — 2 file
`configurator/renderer.tsx` + `configurator/Configurator.tsx` (cp — 1-1 byte
khớp; `diff` xác nhận 0 khác biệt).

### Đã deploy (2026-05-23)
- ke-maume v`ad30ea47-07a2-45af-96e9-73242245e76b` · maume-admin
  v`c0b52a3d-df00-42f5-a2e8-b5193b30a913`.
- Verify live: ke.maume.asia `/` `/design` `/collection` = 200 · admin.maume.asia
  `/` `/admin/ke` `/admin/ke-catalog` = 200 · API `/api/admin/ke-catalog` = 401.

### Lưu ý
- ~~Màu đen tuyền (`#000000`) vẫn tối trong hộc~~ → đã xử lý ở **iteration 2** dưới
  bằng IBL (xem section tiếp theo).
- Wrangler cần Node ≥ 22 (`nvm use 22` trước khi `wrangler deploy`); Node 20 mặc
  định sẽ báo lỗi version.

## ✅ Render 3D — iteration 2: IBL chống "bệt" + tương phản trên màu tối (2026-05-23)

Sau iteration 1 (tone mapping + cân đèn), founder báo render **rất bệt** — tương
phản sáng/tối quá gần nhau, cảm giác phẳng/2D. Tủ ĐEN/màu tối không phân biệt
được vùng sáng-tối (vẫn lặp lại vấn đề "đen xì" iteration 1 mới giảm 1 phần).
Đề xuất: "apply thêm 1 chút phản xạ cho toàn bộ vật liệu chăng?"

### Nguyên nhân
- Scene chưa có **environment map** (IBL — image-based lighting). PBR `MeshStandardMaterial`
  cần "khung cảnh phản chiếu" để tạo highlight. Không có IBL → các bề mặt phẳng
  đứng chỉ nhận diffuse light đều → không spot sáng phản xạ → **flat**.
- Phụ kiện kim loại (chrome, brass — `metalness 0.95`) lẽ ra bóng nhất cũng flat
  vì không có gì để phản xạ ngoài 2 directional light.
- Iteration 1 nâng ambient 2.5 để chống "đen xì" → vô tình át luôn key light →
  mất nốt tương phản còn lại.
- Tủ ĐEN: diffuse = 0 (đen hấp thụ); chỉ specular từ IBL mới làm nó "có khối".

### Thay đổi — 1 file engine `src/configurator/renderer.tsx` (founder duyệt option A)
- **Thêm `<SceneIBL intensity={0.55} />`**: component nội bộ dùng `RoomEnvironment`
  (built-in three.js, thủ tục) + `PMREMGenerator` → tạo cubemap studio in-engine,
  gán vào `scene.environment`. ⚠️ **Không dùng drei `<Environment>`** vì HDR fetch
  + PMREM bị bug **WebGL context-lost** với React 19 / Turbopack (đã test xác
  nhận; drei khoảng v10 + R3F v9 + Turbopack hiện không tương thích cho Environment).
- **Cân lại đèn** (IBL gánh phần "ambient via reflection" → đèn nền hạ MẠNH để
  không cộng dồn → grey không bị wash):
  - ambient 2.5 → **0.6** · hemisphere 1.4 → **0.6**
  - key directional 1.1 → **1.1** (cuối cùng; đã thử 1.5 nhưng màu sáng loá → 1.3 → 1.1)
  - fill 0.62 giữ
- **Shadow contrast** (founder báo bóng đổ yếu/mờ): `shadow-radius` 7→**3**
  (mép bóng tập trung, không nhoè) · `shadow-intensity` 0.7→**0.95** (bóng đậm)
  → bóng RÕ nhưng vẫn mềm-vừa (không gắt như nắng trưa).
- **Cân IBL + key cho màu sáng** (founder báo trắng/màu nhạt loá sau lần đầu IBL
  1.0 + key 1.5): IBL 1.0 → **0.55** · key 1.5 → **1.1** → trắng không clip,
  grey gần đúng màu, đen vẫn giữ ~95% highlight Fresnel (spread 4-78 / 0-255).
- Engine LOGIC + giá KHÔNG đổi · `materials.ts` (roughness/metalness 29 màu)
  KHÔNG đổi · pricing/cutlist/Configurator.tsx KHÔNG đổi.

### Kết quả đo pixel trên preview `/design`
| Trường hợp | Kết quả |
|---|---|
| Tủ grey (default) | Front `#56` (87% true) · interior `#50` (~true) · top `#fc` (wall BG) |
| **Tủ đen tuyền** (`#000`, ML Đen tuyền) | Spread **76 units** (min 4 → max 80) · phân biệt rõ lưng tủ vs mặt cánh vs side panels · **không còn flat #010101** |
| Wall | `#fa-fc` (warm beige, không bị washed) |

### Verify ✅
- furniture-brand: `tsc` sạch · `validate` **32/32 + 6/6 + tự kiểm** · BASELINE
  **8.160.145₫** giữ · OpenNext build sạch (kèm `rm -rf .next .open-next`).
- maume: `tsc` sạch · OpenNext build sạch.

### Sync maume — 1 file
`configurator/renderer.tsx` (cp — 1-1; diff xác nhận 0 khác biệt).

### Lưu ý
- `ScreenshotLighting` (mode chụp thumbnail catalog) KHÔNG đụng → thumbnail giữ
  studio look cũ, không cần regenerate. Chỉ interactive `/design` đẹp lên.
- IBL `RoomEnvironment` là cubemap thủ tục, footprint VRAM nhỏ (~1MB), không
  fetch external CDN → không phụ thuộc kết nối / third-party uptime.
- Nếu drei sửa Environment compatible với React 19 / Turbopack sau này, có thể
  swap về `<Environment preset="apartment">` để dùng HDR thật (chất lượng cao
  hơn `RoomEnvironment` thủ tục). Hiện tại RoomEnvironment đủ tốt cho mục đích.
- Test e2e khi deploy: vào `/design` → tab "Vật liệu khung" → chọn "ML Đen tuyền"
  → tủ phải có chiều khối (lưng tủ sáng hơn cánh trước rõ rệt).

### Đã deploy (2026-05-23) — 3 lần trong cùng iteration
- v1 IBL 1.0 + key 1.5 + shadow yếu → `ad30ea47` / `c0b52a3d`
- v2 + shadow contrast (radius 3, intensity 0.95) → `deac4ebe` / `7d77db25`
- v3 (final) + IBL 0.55 + key 1.1 cho trắng không loá → **`4b50167d`** / **`80692e62`**
- Verify live: ke.maume.asia `/` `/design` `/collection` = 200 · admin.maume.asia
  `/admin/ke` `/admin/ke-catalog` = 200.

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

## ✅ Phase A — Configurator mode 'admin' | 'public' (XONG 2026-05-21)

Founder yêu cầu tích hợp KÊ admin vào maume.asia, sync presets qua Cloudflare KV.
Đây là dự án 3-5 ngày, split 3 phase. Phase A đã ship trong session này:

- Configurator prop `mode` mở rộng từ 2 → 4 giá trị (additive):
  - `'interactive'` (default, behavior cũ — backward compat)
  - `'screenshot'` (S5 polish, render thumbnail)
  - `'admin'` (Phase A NEW) — full UI + "Lưu preset" button (Phase A: localStorage stub)
  - `'public'` (Phase A NEW) — full UI nhưng ẨN ExportConfig + SavePreset (khách hàng)
- `onSavePreset` callback prop (optional) — Phase C maume admin sẽ pass callback wire vào API
- `SavePresetButton` component mới (admin only) — gradient màumè bg, status idle/saving/saved/error
- `ExportConfigButton` visible cho 'interactive' + 'admin', KHÔNG 'public'

Verify: tsc + validate 32/32 + 6/6 pass. Engine bất biến với cách dùng cũ
(default mode='interactive' giữ behavior gốc).

## ✅ Phase B — Cloudflare Workers + KV migration (XONG 2026-05-21)

Migrate KÊ từ GitHub Pages static export → Cloudflare Workers SSR đọc KV.
Production live: **https://ke.maume.asia** (custom domain, SSL auto).

### Stack thay đổi
- Adapter: **`@opennextjs/cloudflare` 1.19.11** (Next.js 16 → Workers)
- Runtime: Node 22 (wrangler 4.x yêu cầu ≥22; project switch từ 20 → 22 LTS qua nvm)
- KV namespace: **`ke-presets`** (id `9122f2b7b431485389a95a9887cb5516`)
- Binding: **`KE_PRESETS`** (uppercase, theo convention)

### Files mới / sửa
- `wrangler.jsonc` (mới) — main `.open-next/worker.js`, compat date 2025-03-25, flags
  `nodejs_compat` + `global_fetch_strictly_public`, KV binding `KE_PRESETS`, route
  `ke.maume.asia` (custom_domain: true → CF tự tạo CNAME + cert).
- `open-next.config.ts` (mới) — `defineCloudflareConfig({})` tối thiểu, KHÔNG dùng
  incrementalCache (KÊ chưa có ISR/revalidate).
- `cloudflare-env.d.ts` (mới) — types `CloudflareEnv` cho `KE_PRESETS` (KVNamespace) +
  `ASSETS` (Fetcher).
- `next.config.ts` — BỎ `output: 'export'` / `trailingSlash` / basePath GitHub Pages.
  Giữ `images.unoptimized: true` (chưa wire CF Images binding).
- `tsconfig.json` — thêm `types: ["@cloudflare/workers-types"]` + include
  `cloudflare-env.d.ts`.
- `src/lib/presets-store.ts` (mới) — helper KV + fallback:
  - `listPresets()` — KV.list({prefix:'preset:'}) → bulk get; rỗng/lỗi → PRESETS built-in
  - `findPreset(slug)` — KV.get(preset:<slug>); miss → tìm trong PRESETS array
  - `getCloudflareContext({ async: false })` qua try/catch → ngoài Workers (next dev,
    build SSR) tự fallback, không crash.
- `src/app/collection/page.tsx` — async server component, `listPresets()`, thêm
  `export const dynamic = 'force-dynamic'` (ép SSR mỗi request, không prerender).
- `src/app/collection/[slug]/page.tsx` — BỎ `generateStaticParams`, async fetch
  `findPreset(slug)` runtime.
- `src/app/design/page.tsx` — convert từ client → async server component đọc
  searchParams + KV, pass `initialValues` xuống `DesignClient`.
- `src/app/design/DesignClient.tsx` (mới) — client wrapper, dynamic import Configurator
  ssr:false (Three.js cần WebGL). Engine BẤT BIẾN, chỉ wrap.
- `scripts/seed-kv.ts` (mới) + `pnpm seed-kv` — đọc PRESETS → emit bulk JSON →
  `wrangler kv bulk put --remote`. Idempotent (KV.put overwrite).
- `.gitignore` — thêm `.open-next/` + `.wrangler/` + `.dev.vars`.
- `.github/workflows/deploy.yml` → renamed `.disabled` (GitHub Pages workflow dừng).

### KV schema (Option A — 1 key per preset)
```
Key:   preset:<slug>     (ví dụ: preset:compact)
Value: JSON.stringify(Preset) — { slug, name, description, category, accent, usecase, values }
```
Lý do chọn A thay vì `_index + items`: không race condition (atomic put per preset),
KV.list() đủ nhanh cho <100 items. Phase C admin chỉ cần KV.put / KV.delete, không
phải sync `_index`.

### Verify ✅ (2026-05-21)
- `pnpm validate` — 32/32 + 6/6 PASS (engine bất biến)
- `pnpm exec tsc --noEmit` — clean
- `npx opennextjs-cloudflare build` — 5 routes:
  - `/` ○ static (landing dùng PRESETS built-in qua Hero/HomeFeatured — curated)
  - `/_not-found` ○ static
  - `/collection` ƒ dynamic (force-dynamic)
  - `/collection/[slug]` ƒ dynamic
  - `/design` ƒ dynamic
- Worker deployed: `ke-maume` worker (account `maume.decor@gmail.com`)
- Production curl: ke.maume.asia/ → 200, /collection → 200 + 5 preset từ KV
  (Compact/Loft/Studio/Tall/Wide), /collection/compact → 200 + giá 5.204.049₫ + JSON-LD,
  /design?preset=loft → 200

### Quyết định/lưu ý
- **Landing `/` vẫn dùng PRESETS built-in** (Hero.tsx, HomeFeatured.tsx) — đó là
  curated marketing showcase, không cần dynamic. Admin thêm preset → chỉ /collection
  reflect. Nâng cấp landing đọc KV là task tương lai nếu cần.
- **Workers.dev URL disabled** sau khi gắn custom_domain — wrangler warning. Founder
  dùng ke.maume.asia là chính; nếu cần URL test riêng, set `workers_dev: true` trong
  wrangler.jsonc.
- **Cloudflare Images binding KHÔNG enable** — `images.unoptimized: true` giữ. KÊ
  hiện chỉ có thumbnails PNG nhỏ + gradient placeholder, không cần optimize.
- **R2 incremental cache KHÔNG enable** — KÊ chưa có ISR; nếu sau thêm `revalidate`
  cho route nào, cần wire `r2IncrementalCache` hoặc `kvIncrementalCache` vào
  `open-next.config.ts` + tạo R2 bucket.

## ✅ Tweak — Hide breakdown/cutlist/BOM cho user + remove ExportConfig (2026-05-22)

Founder feedback: user end KHÔNG được thấy phân tích giá, cutlist, BOM — chỉ
admin thấy. Plus xóa ExportConfigButton (dev tool legacy).

### Changes Configurator.tsx
- **Mode default cho /design**: `'interactive'` → **`'public'`**. Override
  qua `?mode=interactive` cho dev testing. Param `?mode=screenshot` vẫn cho capture.
- **TotalPriceOnly component** (mới): render 1 dòng "Giá tham khảo: X.XXX.XXX₫"
  + ghi chú "Báo giá chính xác sau khi đặt hàng". Cho user end mode.
- **Gate PricePanel + CutlistPanel** by `isAdmin`:
  ```tsx
  {isAdmin ? <><PricePanel/><CutlistPanel/></> : <TotalPriceOnly/>}
  ```
  Admin (admin.maume.asia/ke) thấy full breakdown + cutlist + BOM table.
  User (ke.maume.asia/design) chỉ thấy total tóm tắt.
- **ExportConfigButton REMOVED**: xóa component definition + render + var `isPublic`
  + `showExportConfig`. ~110 dòng code legacy biến mất. Lý do: admin Save preset
  đã có proper flow tại admin.maume.asia/ke, dev tool clipboard JSON không còn cần.
- Mode docs comment update reflect new defaults.

### OrderDialog full data send
- Body POST `/api/order` giờ gửi **full**:
  - `price`: PriceBreakdown { total, lines: [...] } (đầy đủ chi tiết)
  - `cutlist`: Cutlist { totalPanels, totalAreaM2, totalWeightKg, rows: [...] } (đầy đủ rows)
  - `bom`: Fitting[] (chân tủ, phụ kiện) — passed via OrderButton prop
- OrderButton + OrderDialog props thêm `fittings: Fitting[]`.

### Apps Script schema v5 (16 columns)
Old (14 cols): timestamp · contact (5) · slug · name · values · giá total · panels · weight · **cutlist JSON** · status

New (16 cols): timestamp · contact (5) · slug · name · values · giá total · panels · weight · **Giá JSON** · **Cutlist JSON** · **BOM JSON** · status

3 JSON columns riêng → founder script tách parse cho xưởng cắt:
- "Giá JSON" — full PriceBreakdown
- "Cutlist JSON" — full Cutlist rows for cutting list
- "BOM JSON" — fittings array (chân tủ, bản lề, etc.)

Auto-migrate logic trong `doPost`: nếu old sheet `lastColumn < 16` → rename
thành `Orders-old-<timestamp>` (không xoá để safe), tạo "Orders" mới với 16 cols.
5 test rows cũ vẫn còn trong sheet archive nếu founder cần.

### Verify ✅
- furniture-brand: tsc + validate 32/32 + 6/6 PASS
- Force rebuild (`rm -rf .open-next .next`) — build cache cũ blocking deploy:
  fixed bằng full rebuild.
- Apps Script v5 deployed (cùng URL): `clasp deploy -i <existingDeploymentId>`
  keep stable webhook.
- curl POST /api/order với full price+cutlist+BOM → `{"success":true,"orderId":2}`
- Playwright /design?preset=compact:
  - `hasGiaThamKhao: true` (TotalPriceOnly hiện)
  - `hasBangCat: false`, `hasPriceBreakdownTitle: false`, `hasSaoChep: false` (ẨN)
  - `hasOrderBtn: true` (Order button còn)
- Sheet KÊ Orders mới: 16 columns headers, row 2 = first real order với 3 JSON cells.

### Lưu ý
- **Build cache gotcha**: `next build` + `opennextjs-cloudflare` đôi khi cache
  Configurator chunk → deploy không apply visibility changes. Fix: `rm -rf
  .open-next .next` trước build. Để vào CI script sau nếu thấy lặp lại.
- **Old sheet "Orders-old-<ts>"** trong Drive — founder có thể xoá manual nếu
  muốn clean. Auto-rename giữ để safe data, không phá test rows.
- **Mode docs**: nếu sau Phase D có thêm modes (vd 'embed', 'fullscreen'), update
  docs trong Configurator.tsx + type signature `mode?: ...`.

## ✅ Session 7 — Đơn hàng → xưởng (2026-05-22)

End-to-end order pipeline: khách hàng /design → submit form → CF Worker → Apps
Script → Google Sheet KÊ Orders + email notify founder.

### Architecture
```
ke.maume.asia/design Configurator
  ↓ Khách click "🛒 Đặt hàng tủ này" (sidebar Configurator)
  ↓ OrderDialog modal: form name/phone/email/address/note
  ↓ Submit → POST /api/order (ke-maume worker)
  ↓ Worker proxy: fetch Apps Script webhook URL (KE_ORDER_WEBHOOK secret)
  ↓ Apps Script doPost(e):
      1. Parse JSON body
      2. getOrCreateSpreadsheet() — auto-create "KÊ Orders" lần đầu
      3. Append row: timestamp + contact + preset + values + price + cutlist
      4. MailApp.sendEmail() → maume.decor@gmail.com
  ↓ Trả { success, orderId } qua redirect chain
  ↓ Worker forward → client
  ↓ Modal show success: "Đã gửi đơn! Maumè liên hệ qua SĐT trong 24h"
```

### Apps Script project
- **Script ID**: `1WkRU188OPBlDnrOJdGn3C9qZnI3_O1Wj8lFJoBRB78AikIC1H415-Nzp`
- **Deployment v3** ID: `AKfycbzetYeGnOjjE8Befjhs8QIv5MTZZ1UTMxW6whuvRA0iL9JnNxnc78NY6IoxZYlwICbq`
- **Access**: ANYONE (founder set qua dashboard 1 lần — clasp CLI không support set)
- Folder local: `/Users/hsonvu/CLAUDE/ke-orders-script/` (Code.js + appsscript.json + .clasp.json)
- Deploy lại sau khi sửa: `clasp push -f && clasp deploy -i <deploymentId>` (giữ URL không đổi)

### Files mới
- `furniture-brand/src/app/api/order/route.ts` — POST /api/order, validate, fetch Apps Script
- `furniture-brand/src/configurator/Configurator.tsx` — append `OrderButton` + `OrderDialog`:
  - Prop `presetMeta?: { slug, name }` (additive, optional)
  - `showOrderButton = !isShot && !isAdmin` (visible cho interactive + public)
  - Form fields: name/phone/email/address/note. name + phone required.
  - Status state machine: idle → sending → success/error
  - Success view: ✓ + "Đã gửi đơn" + "liên hệ qua SĐT trong 24h"
- `furniture-brand/src/app/design/page.tsx` + `DesignClient.tsx` — pass `presetMeta` từ KV lookup
- `ke-orders-script/Code.js` — Apps Script doPost handler + auto-create Sheet + sendNotifyEmail

### Secret
- `KE_ORDER_WEBHOOK` = deployment ID `AKfycbze...` (CF Worker secret, lưu qua
  `wrangler secret put`). API route prepend `https://script.google.com/macros/s/` + `/exec`.

### Verify ✅
- Apps Script GET `/exec` → `{"ok":true,"service":"KE Orders Webhook"}` (health)
- curl POST /api/order trực tiếp → `{"success":true,"orderId":5}` (worker proxy OK)
- Playwright E2E: ke.maume.asia/design?preset=compact → click Đặt hàng → fill
  form → submit → modal success "Đã gửi đơn"
- Sheet KÊ Orders: row 5+ với đầy đủ data (timestamp, name "Founder Test E2E",
  phone, preset Compact, price 5.204.049₫, cutlist 31 tấm)
- Email notify: gửi đến maume.decor@gmail.com (Apps Script MailApp)

### Quyết định
- **CF Worker fetch handle 302 redirect** đúng (POST preserved qua redirect chain
  Apps Script → googleusercontent.com). curl không làm được vì redirect target
  trả 405 cho POST. Đây là Google Apps Script quirk.
- **Apps Script auto-create Sheet** lần đầu run → KHÔNG cần founder pre-create.
  Sheet ID lưu trong PropertiesService — persistent qua deployments.
- **Email notify đơn giản plaintext** — không HTML formatting (tránh spam filter).
  Subject prefix "[KÊ]" để filter sheet trong Gmail.
- **Form fields name + phone required**, còn lại optional. Email/address giúp
  founder follow up nhưng không bắt buộc (giảm friction submit).

## ✅ Tweak — Smart bbox crop thumbnail (2026-05-22)

Founder feedback round 3: "tỷ lệ chiều dọc rất không cân đối" — uniform framing
chưa đủ vì cabinet aspect ratio extreme (Tall 0.27, Wide 2.67) làm tile vuông
có tủ NHỎ giữa nhiều whitespace.

### Smart bbox crop pipeline
```
1. Capture canvas 1920×900 (Configurator screenshot mode)
2. Scan pixels: detect cabinet (maxDev > 70 from white) →
   bbox [minX, minY, maxX, maxY]
   - Sample every 2 pixels cho speed (~25ms vs 100ms)
   - Shadow opacity 0.25 → maxDev ~64 < threshold → KHÔNG include shadow
3. Pad bbox 8% mỗi cạnh để không sát mép
4. Make square: side = max(cropW, cropH), pad dimension nhỏ hơn white space
5. Draw cabinet crop → square 600×600 canvas with white bg fill
6. toDataURL('image/png') → upload KV thumb storage
```

### Result
- TALL (600×2200): trước 23% tile width → giờ ~50% (bbox crop tight, pad horizontal)
- WIDE (2400×900): trước 32% tile height → giờ ~55% (bbox crop tight, pad vertical)
- COMPACT (800×1200): trước 57% width → giờ ~85% (near-full fill)
- LOFT (2000×2400): ~85% → ~90% (always was good)
- STUDIO (1500×1800): ~70% → ~85%

### Files thay đổi
- `maume/src/lib/ke/capture-thumbnail.ts` `captureCanvasThumbnail`:
  - Replace center-crop static với pixel scan + smart bbox detection
  - `getImageData` từ offscreen 2D canvas (WebGL canvas → 2D bằng drawImage)
  - Loop 2-step sample, threshold maxDev > 70

### Verify ✅
- Deploy maume-admin (chỉ admin worker, capture logic không đụng ke-maume)
- Loop save 5 preset qua Playwright
- ke.maume.asia/collection screenshot:
  - Mọi tủ fill tile uniformly bất kể aspect
  - Sàn trắng + bóng nhẹ giữ nguyên (ShadowMaterial threshold)
  - Cabinet luôn centered trong square (pad equally 2 bên dimension nhỏ hơn)

### Limit cuối
- TALL vẫn có whitespace 2 bên vì aspect 0.27 quá extreme (cabinet 5× cao hơn rộng).
  Bbox crop tight nhất rồi, không thể loại hết whitespace nếu giữ aspect-square tile.
- WIDE tương tự với whitespace trên dưới.
- Để chuyển TALL/WIDE fill 100% tile, cần đổi tile aspect động per cabinet
  (CSS aspect-ratio dynamic theo cabinet aspect) — phá grid uniform, không khuyến nghị.

## ✅ Tweak — Thumbnail uniform framing + aspect-square tile (2026-05-22)

Founder feedback: "thumbnail không hề cân đối" + "tỷ lệ chiều dọc rất không cân đối"
sau khi xem screenshot baseline 2.4m scaling.

### Pivot baseline 2.4m → uniform framing
Catalog Tylko/IKEA pattern: mỗi tủ fill ~85% frame của RIÊNG NÓ. Mất sense of
real-scale (Compact và Loft trông cùng size) nhưng grid cân đối, gọn gàng.

### Changes
- **`Configurator.tsx`** `computeScreenshotCamera`:
  - Revert distance fixed → distance PER-CABINET:
    `d = max(width, height) / FILL / 2 / tan(FOV_half_rad)`
  - FILL = 0.85, FOV = 25° → mỗi cabinet max dim chiếm 85% frame.
  - Camera Y = `height/2 + 300mm` (offset cố định, KHÔNG scale theo h) →
    tilt angle invariant qua mọi cabinet → composition consistent.
- **`PresetCard.tsx`** tile aspect: `aspect-[4/5]` → **`aspect-square`**.
  Match thumbnail square 1:1 → loại letterbox top/bottom. Mỗi tile fill 100%
  bởi thumbnail.

### Verify ✅
- furniture-brand: tsc + validate 32/32 + 6/6 PASS
- Build + deploy ke-maume + maume-admin
- Loop save 5 preset qua Playwright → regenerate thumbnail với camera mới
- ke.maume.asia/collection screenshot: 5 thumbnails đều fill tile uniformly,
  visual size ngang nhau bất kể real height (Compact, Loft, Tall trông cùng to).
- Tile aspect-square → 4 card/row → grid gọn hơn 4:5 vertical.

### Quyết định
- **Uniform framing trumps real-scale**: founder ưu tiên visual cân đối qua
  showing real proportions. Specs (kích thước mm) hiện ở dòng meta bên dưới
  thumbnail → khách vẫn biết tủ thật to nhỏ.
- **FILL=0.85 + camY offset 300mm** = công thức cuối, có thể tinh chỉnh
  qua 2 constants này nếu founder muốn nới thêm/siết chặt.
- **Tile aspect-square** → grid gọn hơn, ít whitespace. Founder có thể đổi
  lại nếu muốn tile cao hơn (aspect-[4/5] cũ).

## ✅ Tweak — Thumbnail URL link qua KV (free, không cần R2) (2026-05-22)

Founder yêu cầu: thumbnail thành URL link thay vì base64 inline, KHÔNG cần thẻ tín dụng.

### Pivot R2 → KV
- Founder muốn URL link nhưng R2 yêu cầu credit card kể cả free tier → pivot dùng
  KV cùng namespace `ke-presets` với key prefix `thumb:`. Free 100K reads/day.
- 1 binding KE_PRESETS đã có ở cả 2 worker → KHÔNG cần đụng wrangler.jsonc.

### Architecture
```
Admin Save → captureCanvasThumbnail (base64) → POST /api/admin/ke-presets
                                                       ↓ putPreset()
                              KV.put("thumb:<slug>-<ts>.png", binary PNG)
                              KV.put("preset:<slug>", { ..., thumbnail: URL })
                                                       ↓
ke.maume.asia/collection → render <img src="https://ke.maume.asia/thumb/...">
                          ↓
                       ke-maume worker /thumb/[key] route
                       → KV.get("thumb:...", "stream")
                       → return PNG with Cache-Control 1 năm immutable
```

### Files mới
- **`furniture-brand/src/app/thumb/[key]/route.ts`** — serve PNG từ KV qua
  stream, headers `Cache-Control: public, max-age=31536000, immutable`.
- **`maume/src/lib/ke-presets-store.ts`** `uploadThumbnail()`:
  - Decode base64 dataURL → Uint8Array
  - Key `<slug>-<timestamp>.png` → URL immutable
  - KV.put(`thumb:<key>`, bytes) — binary PNG trong KV value
  - Return URL `https://ke.maume.asia/thumb/<key>`
- **`putPreset()`** transparent conversion: nếu thumbnail là base64
  dataURL → upload → replace bằng URL trước khi KV.put preset.
- **`maume/src/app/api/admin/ke-presets/migrate-r2/route.ts`** (legacy name,
  thực chất migrate sang KV thumb):
  - List all preset → preset nào có base64 → putPreset (auto-convert) → URL.
  - Idempotent: preset đã có URL → skip.
- **`maume/scripts/migrate-r2-thumbnails.mjs`** — wrapper curl POST endpoint
  với Bearer token.
- **`cloudflare-env.d.ts`** thêm KV.get overloads cho `stream` + `arrayBuffer`,
  KV.put accept Uint8Array.

### Verify ✅ (production)
- Build + deploy ke-maume + maume-admin
- POST `/api/admin/ke-presets/migrate-r2` (Bearer token) →
  `{"total":5,"migrated":["compact","loft","studio","tall","wide"],"skipped":[]}`
- KV state sau migration:
  - preset:* size **28-57KB → 677-971B** (~25× nhỏ hơn)
  - thumb:* keys 5 cái, mỗi cái ~28-57KB binary PNG
- ke.maume.asia/collection HTML img src:
  - 5/5 dùng URL `https://ke.maume.asia/thumb/<slug>-<timestamp>.png`
  - KHÔNG còn `data:image/png;base64,...` inline
- Visual: 5 thumbnails đồng bộ sàn trắng tinh, baseline 2.4m, bóng mềm.

### Lưu ý
- **KV reads quota**: 100K free/day. /collection load = 5 thumbnail reads /
  unique-cache-miss visitor. Browser cache 1 năm → returning visitors KHÔNG hit
  KV. Estimate < 1K reads/day cho launch. Còn nhiều headroom.
- **Cache-Control immutable**: URL chứa timestamp → resave preset = key khác
  → tự bust cache. Browser thấy URL mới → fetch fresh. KHÔNG cần purge CDN.
- **Tên `migrate-r2`** giữ vì idempotent — chạy lại an toàn. Không cần đổi
  name sau pivot, nhưng tôi gắn comment giải thích.
- **Backward compat**: PresetCard + admin PresetThumbnail vẫn render đúng cả 2
  format: URL `https://...` hoặc base64 `data:...` (src attribute accept cả 2).

## ✅ Tweak — Thumbnail composition (sàn trắng tinh + baseline 2.4m) (2026-05-21)

Founder feedback round 2 sau thumbnail auto-render: "ảnh xấu, sàn cần trắng tinh,
góc cần cân đối và gần hơn, lấy items cao max 2m4 làm gốc".

### Engine changes
- **`renderer.tsx`** `Ground({ variant })`:
  - `variant='studio'`: dùng **`<shadowMaterial transparent opacity={0.25} color="#000000" />`**
    thay vì meshStandardMaterial. ShadowMaterial vô hình → bg trắng visible
    through → sàn TRẮNG TINH seamless, bóng overlay nhẹ.
  - `variant='default'` giữ nguyên meshStandardMaterial xám cho interactive scene.
- **`Configurator.tsx`** `computeScreenshotCamera`:
  - Distance FIXED theo baseline:
    ```
    BASELINE_HEIGHT = 2400; FRAME_FILL = 0.85; FOV = 25°
    d = (BASELINE / FILL / 2) / tan(FOV_half_rad) ≈ 6360mm
    ```
  - Constant cho mọi cabinet → tủ thấp tự nhiên nhỏ hơn → sense of scale catalog.
  - camY = `h/2 + h*0.15` (scale theo tủ) → tilt invariant qua mọi size.
  - 3 góc đối xứng giữ nguyên (iso-front-right, front, iso-front-left).

### Verify
- 2 worker rebuild + deploy (ke-maume + maume-admin)
- Auto-loop 5 preset save qua Playwright (admin.maume.asia/admin/ke):
  - Click Sửa → Save → next preset → loop 5 lần
  - All 5 KV size mới (28-57KB) với thumbnail base64 v2
- ke.maume.asia/collection screenshot verify:
  - Sàn trắng tinh xuyên suốt 5 tile
  - Loft (h=2400) chiếm ~85% tile height
  - Compact (h=1200) chiếm ~45% tile height
  - Wide (h=900) chiếm ~35% tile height
  - Bóng đổ mềm phía sau + dưới mỗi tủ, không "lơ lửng"

### Quyết định
- **FRAME_FILL=0.85** — vừa, có whitespace (founder duyệt option Recommended).
- **Shadow opacity=0.25** — vừa, depth cue rõ không quá đậm.
- **Baseline 2400** = `TIER_MAX` của 1 ô (cabinet height cap). Phù hợp vì
  KV không có cabinet vượt 2400mm. Nếu tương lai cho phép custom h > 2400,
  baseline phải tăng theo.
- **Tile aspect**: PresetCard vẫn `aspect-[4/5]`, thumbnail square `object-contain`
  → tủ vuông trong tile vertical → letterbox top/bottom với bg white. Founder
  có thể đổi PresetCard sang `aspect-square` để bớt whitespace nếu muốn.

## ✅ Tweak — Thumbnail auto-render khi admin Save preset (2026-05-21)

Founder yêu cầu: thumbnail tự sinh khi Lưu preset (không batch script),
3 góc camera deterministic theo slug, sàn trắng tinh + bóng mềm,
camera fit theo size tủ (không bị che với tủ cao).

### Engine changes (`src/configurator/`)
- **`renderer.tsx`** `Ground({ variant })` — thêm prop `variant?: 'default' | 'studio'`.
  Studio = `#ffffff` seamless với bg trắng → bóng đổ clean trên sàn trắng.
- **`Configurator.tsx`**:
  - Prop mới `screenshotAngle?: 'iso-front-right' | 'front' | 'iso-front-left'`
    (default 'iso-front-right' giữ behavior cũ).
  - Camera computed dynamic qua helper `computeScreenshotCamera(W, H, D, angle)`:
    distance = `max(W, H, D*2) * 2.8`, camY = `H/2 + H*0.15`, position theo
    angle. Target qua OrbitControls = `[0, H/2, 0]` thay vì hardcode 1200.
  - Screenshot mode: bg trắng + Ground studio + ScreenshotLighting cũ.
  - 3 góc: iso-front-right (default), front (chính diện X=0), iso-front-left
    (X mirror).

### Capture pipeline inline (maume admin)
- **`src/lib/ke/capture-thumbnail.ts`** (mới):
  - `pickAngle(slug)`: hash slug → 1 trong 3 angles deterministic.
  - `captureCanvasThumbnail(rootEl, targetSize=600)`: tìm canvas → center-crop
    vuông từ 1540×900 → downscale 600×600 → fill white bg → toDataURL('image/png').
  - Crop vuông 1:1 phục vụ cả admin table (3:2) và collection (4:5) — object-contain.
- **`src/app/admin/ke/page.tsx`** `KeEditor`:
  - State `captureMode: 'admin' | 'screenshot'` toggle khi Save.
  - Flow: setMode('screenshot') → wait 150ms (RAF + render) → captureCanvasThumbnail
    → setMode('admin') → POST preset với `thumbnail` field.
  - Configurator props: `mode={captureMode}` + `screenshotAngle={pickAngle(slug)}`.

### Schema changes
- **`Preset` interface** (cả furniture-brand + maume copy): thêm
  `thumbnail?: string` (base64 PNG dataURL, optional, ~50-200KB).

### Consumer
- **`src/components/PresetCard.tsx`** (furniture-brand):
  - Image src ưu tiên `preset.thumbnail` → fallback `/presets/<slug>.png`.
  - `object-cover` → `object-contain` cho thumbnail vuông fit trong 4:5 tile.
- **`src/app/collection/page.tsx`** (furniture-brand): pass `preset.thumbnail`
  vào PresetCardData.
- **`src/app/admin/ke/page.tsx`** (maume) `PresetThumbnail`: render `<img>` nếu
  có thumbnail, fallback gradient placeholder cũ.

### Verify ✅ (production)
- `furniture-brand`: tsc + validate 32/32 + 6/6 PASS.
- 2 worker redeployed (ke-maume v `b346c23a` + maume-admin v `516832c0` rồi
  `bwachocsc` cho square crop fix).
- Playwright admin.maume.asia/admin/ke:
  - Click Sửa Compact → editor mở → click Save preset
  - Mode briefly 'screenshot' (UI flicker 150ms) → capture base64 PNG → POST
  - List view: Compact row render `<img src="data:image/png;base64,..."`
- Playwright ke.maume.asia/collection: 5 thumbnails grid hiện ra; Compact
  thumbnail mới (sàn trắng, tủ render đẹp + cam thẫm), 4 cái còn lại vẫn
  PNG cũ raw.

### Quyết định / lưu ý
- **KV value size**: 5 preset × ~150KB thumbnail = ~750KB tổng. KV limit 25MB
  → fit thoải mái. Cache CDN bù read latency.
- **`object-contain`** cho thumbnail vuông trong tile 4:5: tủ fill width,
  letterbox top/bottom với bg white seamless. Trade-off: tủ nhỏ hơn cũ.
  Founder accept để có pipeline auto-generate.
- **Save lại 4 preset còn lại** (loft/studio/tall/wide) để cũ → new flow:
  admin/ke → Sửa từng cái → Save (không cần đổi value, just click Save).
- **3 angles deterministic theo slug hash** (`charCodeAt sum % 3`) — mỗi preset
  cố định 1 góc. Đổi tên slug → đổi angle (do hash khác). Tốt cho UX consistency.
- **UI flicker 150ms** khi save — chấp nhận được cho one-shot admin action.
  Alternative: render 2nd hidden Configurator (phức tạp hơn). Founder
  preview ngay sau save.

## ✅ Tweak — Số tầng max ĐỘNG theo chiều cao (2026-05-21)

Founder yêu cầu: `max(rows)` không hardcode = 6 mà tính từ `height / (CELL_MIN + T)`.

### Files sửa (BOTH dna.ts furniture-brand + maume/src/lib/ke copy)
- **`products/tu-ke/dna.ts`** — 3 edits:
  1. Thêm helper `maxRowsForHeight(height)` (sau `minRowsForEvenHeight`):
     ```ts
     // n*(CELL_MIN+T) + T ≤ height  ⇒  n ≤ (height - T) / (CELL_MIN + T)
     Math.max(1, Math.floor((height - T) / (CELL_MIN + T)))
     ```
     T=18, CELL_MIN=150 ⇒ 600mm→3, 1200mm→7, 2400mm→14.
  2. `resolveControls` — apply `max: dynMaxRows` ở **cả 2 mode** (even + manual).
  3. `normalizeValues` — `v.rows = Math.min(v.rows, maxRowsForHeight(v.height))`
     trước khi raise min → auto-clamp khi user shrink height.
  4. `minRowsForEvenHeight` đổi `paramById('rows').max` → `maxRowsForHeight(height)`
     (consistency: while-loop bound dùng cùng dynamic max).

### Verify ✅
- furniture-brand: `pnpm validate` 32/32 + 6/6 PASS, `tsc` clean
- Playwright production admin.maume.asia/admin/ke:
  - Compact (h=1200): Số tầng slider min=1 **max=7** ✓ (công thức 7.04→7)
  - Drag Chiều cao→2400: Số tầng max **7→14** ✓ (công thức 14.18→14)
- Deploy: ke-maume + maume-admin worker đều redeployed thành công.

### Quyết định
- Max áp cả 2 mode (chia đều + từng tầng) — không cho user vượt physical fit.
- Auto-clamp xuống khi height shrink, đối xứng với logic auto-INCREASE đã có
  (rows tăng khi height tăng trong even mode).
- Static `max: 6` trong parameter definition giữ nguyên (legacy fallback, bị
  resolveControls override). Không cần đụng.

## ✅ Phase C — Maume admin /admin/ke (XONG 2026-05-21)

Admin UI quản lý preset KÊ deployed tại **`admin.maume.asia/ke`**. Maume worker
share cùng KV namespace `ke-presets` với KÊ worker → admin tạo/sửa preset là
ke.maume.asia/collection thấy ngay (force-dynamic).

### Architecture đã ship
```
admin.maume.asia/ke           Configurator mode='admin' + form metadata
                              ↓ Lưu (POST /api/admin/ke-presets, Bearer auth)
                              ↓
                     Cloudflare KV namespace "ke-presets"
                              ↓
ke.maume.asia/collection (SSR force-dynamic) → fetch KV → render
ke.maume.asia/design?preset=xxx → fetch KV → Configurator mode='interactive'
```

### Files thay đổi trong maume
- `wrangler.jsonc` — thêm `kv_namespaces` binding `KE_PRESETS` (cùng namespace ID
  `9122f2b7b431485389a95a9887cb5516`)
- `cloudflare-env.d.ts` (mới) — **MINIMAL** ambient declarations cho `KVNamespace`
  + `CloudflareEnv`. KHÔNG dùng `@cloudflare/workers-types` global vì xung đột
  `Response.json()` return type (DOM `Promise<any>` vs Workers `Promise<unknown>`)
  break existing admin pages (about/page.tsx setState(unknown) lỗi).
- `tsconfig.json` — chỉ thêm `cloudflare-env.d.ts` vào include. KHÔNG có `types`
  array.
- `src/lib/ke/` (copy 1-1 từ furniture-brand):
  - `configurator/` (Configurator.tsx, renderer.tsx, types.ts, materials.ts,
    pricing.ts, cutlist.ts, cellgrid.ts) — engine BẤT BIẾN
  - `products/tu-ke/dna.ts` + `presets.ts` — adapt imports `@/configurator/` →
    `@/lib/ke/configurator/`
- `src/lib/ke-presets-store.ts` (mới) — KV CRUD helper: `listPresets`, `getPreset`,
  `putPreset`, `deletePreset`. `getCloudflareContext({async:false})` runtime.
- `src/app/api/admin/ke-presets/route.ts` (mới) — GET/POST/DELETE handlers.
  Auth tự inherit từ middleware `/api/admin/*` matcher (Bearer token).
- `src/app/admin/ke/page.tsx` (mới) — 2-view state machine: list (table với
  thumbnail gradient + outline schematic) | edit (top-bar metadata form + full
  Configurator mode='admin'). Pass `onSavePreset(values)` → closure capture meta
  → POST API → refresh list.
- `src/app/admin/layout.tsx` — thêm nav item `{ href: "/admin/ke", label: "KÊ
  Configurator", icon: "🪑" }`

### Code share strategy đã chọn
**Option A — copy 1-1** (manual sync khi engine update). Lý do:
- Đơn giản nhất cho MVP
- Maume Tailwind 3 vs KÊ Tailwind 4 — copy + verify nhanh hơn workspace setup
- Sau khi engine stable có thể chuyển B (pnpm workspace) hoặc git submodule.

### Stack dependencies thêm vào maume
- `three@^0.184.0` + `@react-three/fiber@^9.6.1` + `@react-three/drei@^10.7.7`
- `@types/three@^0.184.1` (dev)
- `@cloudflare/workers-types` (dev — installed but NOT loaded global, chỉ as
  reference cho future)

### Tailwind 3 vs 4 — KHÔNG cần port
Configurator KÊ KHÔNG dùng custom @theme tokens (grep cho thấy `gradient-text`
chỉ ở landing components, không trong configurator). Class arbitrary
(`text-[#F5A088]`) + standard utilities (`bg-neutral-100`) work cả 2 version.

### Auth model
Middleware `src/middleware.ts` matcher `/api/admin/:path*` Bearer token gate
áp dụng tự động cho `/api/admin/ke-presets`. Page `/admin/ke` qua client-side
auth check trong admin layout (localStorage token).

### Verify ✅ (2026-05-21)
- `npx @opennextjs/cloudflare build` — OK, 1 ƒ Proxy + multiple routes
- `wrangler deploy` → `maume-admin` worker version `dbf19c57-036c-4d95-a276-fd761f153714`
- `curl admin.maume.asia/admin/ke` → 200 (HTML page, client redirect login nếu
  no token)
- `curl admin.maume.asia/api/admin/ke-presets` (no auth) → 401
  `{"error":"Chưa đăng nhập"}` ✓ middleware gate hoạt động
- KE_PRESETS binding active trong worker deploy log

### Quyết định/lưu ý cho Phase D (nếu có)
- **GitHub Action workflow `deploy-admin.yml`** sẽ auto-trigger khi push các file
  admin-related → KHÔNG cần lo conflict với manual deploy. Workflow đọc cùng
  `wrangler.jsonc` (đã có KV binding) nên deploy CI cũng gắn đúng KV.
- **`@cloudflare/workers-types` chỉ là dev dependency tham khảo** — KHÔNG bao giờ
  add vào `types` array của tsconfig. Nếu Phase D cần thêm CF binding (R2, D1...)
  → khai báo manual trong cloudflare-env.d.ts.
- **Thumbnail hiện là gradient + outline placeholder**. Future: render 3D
  thumbnail thật (tốn effort screenshot pipeline).
- **Slug immutable sau khi tạo** (UI disable input slug khi edit). Lý do: slug
  là KV key — đổi slug = delete cũ + tạo mới, dễ lỗi. Founder muốn rename → xoá
  + tạo lại với slug mới.
- **Direct-eval warnings** từ OpenNext bundler — không critical, KHÔNG ảnh hưởng
  runtime. Pattern internal handler.mjs, không phải code mình.

### Code share strategy
- **Option A**: copy code 1-1 (manual sync khi update)
- **Option B**: pnpm workspace với package `@maume/ke-engine` shared (clean nhưng setup)
- **Option C**: git submodule

Recommend Option A cho MVP — đơn giản, sync manual ban đầu, có thể chuyển B sau khi code stable.

### KV schema (đã ship Phase B — Option A)
```
Key:   preset:<slug>     (ví dụ: preset:compact)
Value: JSON.stringify({ slug, name, description, category, accent, usecase, values })
```
Phase C khi viết admin POST: dùng cùng key prefix `preset:`. Có thể thêm field
`createdAt/updatedAt` vào value khi cần audit log.

### Risk
- **Maume Tailwind 3 vs KÊ Tailwind 4**: Configurator dùng arbitrary classes (`text-[#F5A088]`) → may work cross-version. Custom utilities (`gradient-text`) phải port. Verify trước.
- **R3F + Next.js trong Cloudflare Workers Edge Runtime**: Three.js cần WebGL (browser-only). `next/dynamic ssr:false` (đã có) sẽ work. Edge SSR chỉ render shell, R3F load client-side.
- **Auth gating**: KÊ admin route trong maume layout đã có auth — chỉ rely vào maume layout check.

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

## ✅ Redesign /design mobile + camera fit (XONG 2026-05-22)

Redesign UX trang `/design` (configurator) — mobile-first, direct-3D manipulation.
**Engine BẤT BIẾN** — chỉ sửa `Configurator.tsx` (presentation). Validate vẫn 32/32 + 6/6.

### Đã ship (Configurator.tsx — sync cả 2 worker)
- **Layout cố định**: bỏ drawer kéo + wizard. Mobile = 3D trên (`max-md:h-[56dvh]`)
  + panel dưới (`max-md:h-[44dvh]`). Desktop = sidebar trái `md:w-[340px]` + canvas.
- **Direct-3D manipulation**: `CellHitboxes` (mesh vô hình mỗi ô) + `cellBoxes()`
  (dựng từ `colSizes/rowSizes`) + `CellPopup` (drei `<Html>` neo tại ô) + toggle
  `EditModeToggle` (Kiểu ô / Màu ô). Chạm ô 3D → popup đổi loại/màu.
- **Panel tab ngang** (mobile): nhóm controls Rộng/Cao/Sâu/Vật liệu khung thành
  tab — `activeTab` state, mỗi tab 1 nhóm (`max-md:hidden` nhóm khác). Desktop
  xếp dọc đủ 4 nhóm (`md:hidden` hàng tab).
- **OrderBar** (component mới, `md:hidden`): thanh giá + nút Đặt hàng NỔI ở đáy
  3D viewport. Desktop giữ `TotalPriceOnly` + `OrderButton` trong sidebar
  (`max-md:hidden`). Tái dùng nguyên `OrderDialog` — 2 điểm vào loại trừ bằng CSS.
- **Nén mobile**: bỏ header (`max-md:hidden`), toggle/input/slider/nút thu gọn
  (`max-md:` prefix → desktop bất biến). Tab Vật liệu khung 23 lựa chọn → hộp
  cuộn nội bộ `max-md:max-h-[164px]`. Kết quả: panel cuộn 389px → 0–23px.
- **`FitCamera`** (component mới): camera tự fit khung — target = tâm tủ, distance
  theo bounding sphere + min(fov dọc, fov ngang theo aspect). Giữ góc orbit, refit
  khi đổi kích thước / resize. Fix mobile cắt đỉnh tủ. ⚠️ Dùng `makeDefault` trên
  OrbitControls + `useThree(s=>s.controls)` (KHÔNG dùng ref — lỗi thứ tự ref vs
  layout-effect khi FitCamera là sibling trước OrbitControls).

### Verify ✅ (Playwright 375×812 + 1440×900)
4 tab cuộn 0–23px · cell popup chạm ô → đổi loại → giá cập nhật · OrderBar →
OrderDialog OK · FitCamera: tủ lọt khung mobile+desktop, refit khi đổi cao,
orbit OK · desktop bất biến (tab ẩn, header hiện, sidebar đủ 4 nhóm).

### Refinement 2 (founder duyệt 2026-05-22)
- **Popup neo cố định**: bỏ drei `<Html>` (neo tại ô). `CellPopup` giờ là thẻ
  `absolute bottom-3 right-3` compact `w-52`, render NGOÀI `<Canvas>` (sibling).
  Bỏ props `flipLeft/flipUp`. Header ghi ô đang chỉnh ("Kiểu ô · ô R×C").
- **`CellHighlight`** (component mới): khối hộp trong suốt đỏ (`#ff2020` opacity
  0.5) phủ ô đang chọn — trong `<Canvas>`. Vì popup không còn neo tại ô nên cần
  tín hiệu này để biết đang chỉnh ô nào. `popupBox` đổi vai trò: từ neo Html →
  cấp box cho CellHighlight.
- **OrderBar**: KHÔNG còn thanh bar đáy. Giờ trả fragment 2 phần tử nổi góc
  TRÊN 3D viewport — giá (góc trên-trái, chữ + text-shadow, không nền) + nút
  Đặt hàng (góc trên-phải). Vẫn `md:hidden`; desktop dùng sidebar như cũ.

### Refinement 3 (founder duyệt 2026-05-22)
- **Popup → `CellBar`**: bỏ thẻ popup góc. Giờ là THANH NGANG neo `absolute
  inset-x-0 bottom-0` sát cạnh dưới 3D viewport (CẢ mobile lẫn desktop). Option
  = ô icon/màu + nhãn dưới, `flex overflow-x-auto` + `w-max mx-auto` (4 ô kiểu
  vừa khít canh giữa; 23 ô màu cuộn ngang). `CellPopup` đổi tên → `CellBar`.
- **OrderBar trên CẢ desktop**: bỏ `md:hidden` → giá + nút Đặt hàng nổi góc
  trên 3D viewport ở cả 2 breakpoint. Sidebar KHÔNG còn giá/nút.
- **Xoá `TotalPriceOnly` + `OrderButton`** (dead sau khi sidebar bỏ giá/nút).
  `OrderBar` là điểm vào đơn DUY NHẤT (vẫn dùng `OrderDialog`).
- **EditModeToggle**: đổi mode KHÔNG còn đóng bar (`onChange={setEditMode}`) —
  đang mở bar mà bấm Kiểu↔Màu thì bar giữ nguyên, chỉ đổi danh sách option.

### Lưu ý
- Touch target hạ 48→40px ở vài control + popup option (founder duyệt — ưu tiên gọn).
- `CellGridControl`/`CellMenu` thành dead-ish code (vẫn được ParamControl gọi qua
  nhánh `type==='cellgrid'` nên không cảnh báo TS unused) — panel lọc bỏ cellgrid.
- `cellBoxes()` + `FRAME_T=18` mirror dna.ts — nếu engine đổi id part/bề dày khung
  phải cập nhật. `FitCamera` đọc `values.width/height/depth` (như screenshot camera).
- ⚠️ Verify CSS class qua substring: `'md:hidden'` ⊂ `'max-md:hidden'` — dễ khớp
  nhầm. Kiểm bằng `getComputedStyle().position` hoặc khớp chính xác.

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
