# CNC Workshop Spec — Phụ kiện & Lỗ khoan

> Document research các loại phụ kiện + spec lỗ khoan/phay chuẩn để xuất DXF cho
> xưởng CNC. Default values lấy theo **phụ kiện VN giá rẻ phổ biến** (Yali / Galin
> / Sugen / Skinox / IVAN / EuroCity — tier rẻ, không phải Blum/Hettich/Häfele
> premium). Founder review từng block "🔧 FOUNDER" và sửa nếu xưởng dùng khác.
>
> Sau khi founder confirm → em sẽ:
> 1. Mở rộng `ProductionCatalog.machiningSpec` chứa các số này
> 2. Thêm form admin `/admin/ke-catalog` (tab "Quy cách phụ kiện CNC")
> 3. Refactor `dna.ts` consume catalog thay vì hardcode constants
> 4. Refactor DXF generator theo industry standard (board-level, FRONT/BACK riêng)

## Mục lục

1. [Phương pháp ráp tổng quan](#1-phương-pháp-ráp-tổng-quan)
2. [Bản lề âm cup Ø35](#2-bản-lề-âm-cup-ø35)
3. [Ray ngăn kéo full extension](#3-ray-ngăn-kéo-full-extension)
4. [Confirmat screw (vít liên kết chính)](#4-confirmat-screw-vít-liên-kết-chính)
5. [Dowel gỗ Ø8](#5-dowel-gỗ-ø8)
6. [Chốt kệ Ø5 — system 32mm line drilling](#6-chốt-kệ-ø5--system-32mm-line-drilling)
7. [Vít hậu](#7-vít-hậu)
8. [Chân tủ](#8-chân-tủ)
9. [Tay nắm](#9-tay-nắm)
10. [Bug logic hiện tại em cần fix](#10-bug-logic-hiện-tại-em-cần-fix)
11. [Layer DXF chuẩn industry (CAM-ready)](#11-layer-dxf-chuẩn-industry-cam-ready)

---

## 1. Phương pháp ráp tổng quan

**Tủ kệ panel (flat-pack VN style) thường dùng KẾT HỢP:**
- **Confirmat M6.3×50** làm vít cố định chính (~70% giao điểm) — cạnh ván vào mặt ván
- **Dowel Ø8×30** làm điểm định vị (~30% kết hợp với confirmat, hoặc thay thế confirmat ở chỗ khó vặn)
- **Vít hậu Ø3-4** cho tấm lưng (ván 9mm)
- **Cam lock** (knockdown ratchet) — nếu tủ "flat-pack" cho khách tự ráp; em CHƯA support trong dna, có thể add sau

### 🔧 FOUNDER CHỌN: phương pháp ráp chính cho tủ kệ
- [ ] Confirmat only (đơn giản, vít chìm 100% giao điểm)
- [x] **Confirmat + Dowel kết hợp** (default em đề xuất — chắc + định vị, chuẩn xưởng VN trung bình)
- [ ] Cam lock + Dowel (knockdown, khách ráp tại nhà)
- [ ] Khác: _____________

---

## 2. Bản lề âm cup Ø35

**Phổ biến VN giá rẻ**: Yali / Sugen / EuroCity / Galin (Trung Quốc OEM, ~30-50k/cái)
**Trung-cao cấp**: Blum Clip Top, Hettich Sensys, Häfele Metalla (3-5× giá)

Cả 2 tier dùng **CHUẨN CHUNG Ø35 cup hinge system** — chỉ khác chất lượng giảm chấn, không khác kích thước lỗ → DXF output dùng được mọi tier.

### Spec default em đề xuất

| Tham số | Default | Ý nghĩa |
|---|---|---|
| `cupDia` | **35mm** | Đường kính cup bản lề (chuẩn industry global) |
| `cupDepth` | **13mm** | Chiều sâu cup khoét vào mặt trong cánh |
| `cupInsetFromEdge` | **22mm** | Tâm cup cách mép gắn bản lề (mép trái/phải cánh) — Blum chuẩn |
| `cupScrewDia` | **4mm** | Vít cố định cup vào cánh |
| `cupScrewDepth` | **12mm** | Sâu vít cup (qua mặt trong cánh, không xuyên) |
| `cupScrewOffset` | **24mm** | Tâm 2 vít cup cách tâm cup ±24mm (theo trục dài cánh) — Blum chuẩn |
| `plateInsetFromEdge` | **37mm** | Tâm plate cách mép trước vách (full overlay 6mm) |
| `plateScrewSpan` | **32mm** | 2 vít plate cách nhau 32mm (chuẩn 32mm-system) |
| `plateScrewDia` | **4mm** | Vít M4 cố định plate vào vách |
| `plateScrewDepth` | **12mm** | Sâu vít plate |

### Logic số lượng bản lề theo chiều cao cánh
- Cánh < 1200mm: **2 bản lề** (đều cách đầu/đuôi 100mm)
- Cánh 1200-1799mm: **3 bản lề** (đều cách đầu/đuôi 100mm, chia đều giữa)
- Cánh 1800-2199mm: **4 bản lề**
- Cánh 2200-2400mm: **5 bản lề**

### 🔧 FOUNDER chỉnh nếu xưởng khác
- [ ] cupInsetFromEdge thay đổi: __ mm (VD: 21mm cho Sugen, 22mm cho Blum)
- [ ] cupScrewOffset thay đổi: __ mm (VD: 26mm cho Hettich Sensys)
- [ ] plateInsetFromEdge thay đổi: __ mm (VD: 37mm full overlay / 47mm half overlay / 7mm inset)
- [x] **Giữ default Blum standard (22/24/37/32)** ✓

---

## 3. Ray ngăn kéo full extension

**Phổ biến VN giá rẻ**: HG / Hozawa / Wellmax / Smartlock (~70-150k/bộ 350mm)
**Trung-cao cấp**: Hettich Atira, Häfele Matrix, Blum Tandem (3-10× giá)

Đa số ray hộc bi 3-lá VN dùng **chuẩn 32mm system** (lỗ vít cách nhau bội 32mm).

### Spec default em đề xuất

| Tham số | Default | Ý nghĩa |
|---|---|---|
| `lengthOptions` | **[250, 300, 350, 400, 450, 500]mm** | Bộ size chuẩn xưởng VN |
| `screwDia` | **4mm** | Vít M4 cố định ray |
| `screwDepth` | **12mm** | Sâu vít (mặt vách 18mm — vít không xuyên) |
| `clusterFrontInsetFromEdge` | **37mm** | Cụm vít trước cách mép trước vách |
| `clusterBackInsetFromEdge` | **37mm** | Cụm vít sau cách mép sau vách |
| `clusterScrewSpan` | **32mm** | 2 vít trên/dưới mỗi cụm cách nhau 32mm (chuẩn 32mm system) |
| `gapPerSide` | **13mm** | Khe hở giữa thùng hộc và vách ô (chừa ray) |

### Quy tắc match size ray theo chiều sâu tủ D
- D bội 50 → ray = `floor((D-50)/50)*50` (an toàn, ray < thùng vài mm)
- D lẻ → ray = `round((D-50)/50)*50` (gần nhất)
- Clamp trong [250, 500]
- VD: D=350 → ray 300mm. D=500 → ray 450mm.

### ⚠️ Em đã làm SAI ở Phase 2 — sẽ fix

Em hiện đặt `SLIDE_SCREW_SPAN_Y = 16mm` (cách nhau 16mm). **ĐÚNG phải là 32mm**
(chuẩn 32mm system). Fix khi consume catalog.

### 🔧 FOUNDER chỉnh nếu cần
- [x] **Giữ default 32mm system** (chuẩn industry) ✓
- [ ] Đổi span Y: __ mm

---

## 4. Confirmat screw (vít liên kết chính)

**Phổ biến VN**: EuroCity, Hafele, Galin, MILUX, JIS (~5-10k/cái M6.3×50)

Đây là **vít liên kết CHÍNH** giữa vách và tấm ngang. Em hiện **CHƯA có** trong DNA — đây là **lỗ hổng quan trọng** founder chỉ ra.

### Spec default em đề xuất

| Tham số | Default | Ý nghĩa |
|---|---|---|
| `screwDia` | **6.3mm** | Đường kính thân vít (M6.3) |
| `screwLength` | **50mm** | Chiều dài vít (ráp 18mm + 18mm) |
| `pilotDia` | **5mm** | Lỗ mồi trên CẠNH ván — đường kính 5mm |
| `pilotDepth` | **38mm** | Sâu lỗ mồi (vít M6.3×50 cần ~38mm bám vào cạnh) |
| `counterboreDia` | **7mm** | Lỗ đầu vít trên MẶT ván đối ứng (counterbore) |
| `counterboreDepth` | **13mm** | Sâu counterbore (đầu vít chìm hết) |
| `perJoint` | **2** | Số confirmat mỗi giao điểm vách-ngang |
| `jointInsetFromFront` | **50mm** | Vít 1 cách mép trước |
| `jointInsetFromBack` | **50mm** | Vít 2 cách mép sau (= cách hậu) |

### Logic vị trí lỗ
Mỗi giao điểm **vách đứng ↔ tấm ngang (đáy/nóc/kệ)** có **2 confirmat**:
- Vít 1: trên cạnh trên vách (cho đáy) HOẶC cạnh dưới (cho nóc) — vào tấm ngang
- Lỗ mồi Ø5 trên CẠNH vách (trục dọc vách, tâm cách trước 50mm)
- Lỗ counterbore Ø7 trên MẶT tấm ngang (mặt dưới đáy / mặt trên nóc / mặt 2 của kệ)
- Tâm counterbore khớp tâm pilot khi ráp xong

### 🔧 FOUNDER chỉnh
- [x] **Giữ default M6.3×50 (chuẩn nhất VN)** ✓
- [ ] Đổi sang M7×50 (chắc hơn, ít phổ biến): __
- [ ] Đổi `perJoint` thành 3 (tủ nặng / cao): __
- [ ] Đổi inset từ mép trước: __ mm (default 50mm)

### ⚠️ Edge drilling — workshop note
Lỗ mồi Ø5 trên CẠNH vách = **edge drilling**, cần CNC 5-axis hoặc máy khoan ngang.
Xưởng cơ bản 3-axis có thể làm tay với dưỡng khoan (drill jig). Em sẽ:
- Output edge holes thành 1 file riêng `board-N-EDGE.dxf` với annotation rõ
- Hoặc note trong README "lỗ này phải khoan thủ công, vị trí: ..."

---

## 5. Dowel gỗ Ø8

**Phổ biến VN**: dowel gỗ keo Ø8×30mm hoặc Ø6×25mm — tự cắt từ thanh gỗ keo (~500-1000đ/cái)

### Spec default em đề xuất

| Tham số | Default | Ý nghĩa |
|---|---|---|
| `dowelDia` | **8mm** | Đường kính chốt gỗ |
| `dowelLength` | **30mm** | Chiều dài chốt |
| `pilotDia` | **8mm** | Lỗ mồi (= dia chốt, fit chính xác) |
| `pilotDepth` | **15mm** | Sâu lỗ mồi mỗi đầu (tổng = 2×15 = 30mm khớp chốt) |
| `perJoint` | **2** | Số dowel mỗi giao điểm (kết hợp với 2 confirmat) |
| `spacingFromConfirmat` | **80mm** | Cách lỗ confirmat 80mm (xen kẽ trên cạnh ván) |

### 🔧 FOUNDER chỉnh
- [x] **Giữ default Ø8×30** ✓
- [ ] Dùng Ø6×25 cho tủ nhẹ: __
- [ ] Bỏ dowel (chỉ confirmat) — đơn giản hơn nhưng độ chính xác kém: __

---

## 6. Chốt kệ Ø5 — system 32mm line drilling

**⚠️ Đây là chỗ em SAI logic lớn nhất ở S10 — fix luôn.**

### Em làm sai
Em khoan lỗ chốt kệ Ø5 **trên ĐÁY/NÓC/KỆ ngang** (tại vị trí mỗi vách). Sai.

### Đúng là
Lỗ chốt Ø5 phải khoan trên **MẶT TRONG VÁCH ĐỨNG** (cạnh trong vách hướng vào ô).
2 mode:

#### Mode A: 32mm line drilling (cho phép di chuyển kệ)
- Khoan **dãy lỗ Ø5** trên 1 đường thẳng dọc vách, lỗ cách nhau **32mm** (chuẩn 32mm system)
- 2 dãy: 1 dãy cách mép TRƯỚC vách 37mm, 1 dãy cách mép SAU vách 37mm
- Khách di chuyển kệ → cắm chốt vào cặp lỗ phù hợp
- Số lỗ: hết chiều cao vách (vd vách 1067mm → ~30 lỗ mỗi dãy)

#### Mode B: Fixed shelf (kệ cố định, không di chuyển)
- Chỉ 4 lỗ Ø5 tại đúng vị trí kệ cố định: 2 lỗ trước (cách mép trước 50mm, mỗi mép trên/dưới kệ 1 lỗ), 2 lỗ sau
- Không 32mm line — gọn hơn, ít lỗ hơn nhưng kệ không di chuyển được

### Spec default em đề xuất

| Tham số | Default | Ý nghĩa |
|---|---|---|
| `mode` | **`'line32mm'`** | Cho phép di chuyển kệ (đa số khách thích) |
| `pinDia` | **5mm** | Lỗ chốt Ø5 |
| `pinDepth` | **11mm** | Sâu (chốt Ø5×11 cắm vào, lộ ra ~5mm để đỡ kệ) |
| `columnInsetFromFront` | **37mm** | Dãy trước cách mép trước vách 37mm |
| `columnInsetFromBack` | **37mm** | Dãy sau cách mép sau vách 37mm |
| `lineStartFromBottom` | **64mm** | Lỗ đầu tiên cách đáy vách (= 2×32mm) |
| `lineSpacing` | **32mm** | Cách nhau 32mm dọc cột |
| `lineEndFromTop` | **64mm** | Lỗ cuối cách đỉnh vách |

### 🔧 FOUNDER chọn
- [x] **Mode `line32mm`** (di chuyển kệ — em recommend) ✓
- [ ] Mode `fixed` (đơn giản, ít lỗ, kệ cố định): __

### ⚠️ Hệ quả khi fix
- Tấm đáy/nóc/kệ không khoan chốt nữa — bỏ machining shelfPin trên tấm ngang
- Vách đứng có ~60 lỗ Ø5 (2 dãy × 30 lỗ) — DXF vẽ nhiều hơn nhưng đúng workflow
- Cutlist UI text vẫn giữ note "vị trí chốt kệ" — chỉ thay đổi vị trí trên vách

---

## 7. Chốt lò xo nhựa Ø8 (back fastener)

**Founder confirmed (2026-05-24)**: hậu dùng **chốt lò xo nhựa Ø8** thay vì vít.

**Phổ biến VN giá rẻ**: clip nhựa Ø8 hoặc Ø10 — cấu tạo có lá lò xo, cắm vào lỗ
mồi trên VÁCH ĐỨNG mặt trong. Tấm hậu trượt vào ép clip → lò xo bung giữ.
~500-2000đ/cái (rẻ hơn cả vít confirmat).

**Hãng tham khảo VN**: clip nhựa OEM Trung Quốc / Galin / Skinox.

### Spec default em đề xuất

| Tham số | Default | Ý nghĩa |
|---|---|---|
| `mode` | **`'clip'`** | Chọn clip lò xo (vs `'screw'` cũ) |
| `clipDia` | **8mm** | Ø lỗ clip trên vách |
| `clipDepth` | **12mm** | Sâu lỗ (clip cắm 10mm + chừa 2mm) |
| `clipInsetFromBackEdge` | **15mm** | Tâm clip cách mép SAU vách (clip nằm gần tấm hậu) |
| `clipsPerEdge` | **2** | 2 clip mỗi cạnh vách láng giềng ô có hậu (1 trên + 1 dưới) |
| `clipMarginFromCellEnd` | **80mm** | Clip trên cách đỉnh ô / clip dưới cách đáy ô 80mm |

### Workflow xưởng + DXF
Mỗi ô có hậu: **2 vách láng giềng × 2 clip = 4 lỗ Ø8** trên mặt trong vách (hướng vào ô).
- Vách k ↔ ô c-1 (bên trái): 2 clip trên mặt TRÁI vách (side='back')
- Vách k ↔ ô c (bên phải): 2 clip trên mặt PHẢI vách (side='front')
- Vách biên (k=0 hoặc k=columns) chỉ có 1 ô láng giềng → 2 clip

Tấm hậu (ván 9mm) **KHÔNG khoan gì** — chỉ cắt outline kích thước rộng × cao ô + 2mm play mỗi cạnh.

### Tác động lớn
- Hết hoàn toàn `backScrew` machining trên tấm ngang (đáy/nóc/kệ) — Bug 4 cũ.
- Tấm hậu trượt vào → tủ có thể tháo tấm hậu mà không cần tháo nóc/đáy (bảo trì dễ).
- DXF đơn giản hơn: ván 9mm chỉ outline + label, không có lỗ.

### 🔧 FOUNDER chỉnh (nếu cần)
- [x] **Loại 1 — Chốt nhựa lò xo Ø8, 4 clip/ô** (em recommend, đã apply) ✓
- [ ] Đổi sang Ø10: __
- [ ] Đổi 3 clip/cạnh = 6/ô (ô cao > 1500mm): __
- [ ] Đổi `clipInsetFromBackEdge` 15 → ___ mm
- [ ] Đổi sang vít hậu cũ (mode='screw'): __

---

## 8. Chân tủ

**Phổ biến VN, 3 loại:**

### Loại 1: Chân nút mỏng cấy (Ø8 dowel-style)
- Phổ biến tủ nhẹ, đẹp gọn. ~3-5k/cái
- 1 lỗ Ø8 sâu 12mm trên đáy mặt dưới, chân ép vào
- Em đang dùng loại này ✓

### Loại 2: Chân plate 4 vít (chân nhựa/kim loại chân tủ to)
- 4 lỗ Ø3.5 sâu 12mm trên đáy mặt dưới (vít M4×12 bắt chân)
- Layout vít: 4 lỗ vuông cạnh 25-32mm (tùy plate)
- Bắt chân chịu tải lớn hơn

### Loại 3: Chân vít M8 (chân điều chỉnh cao)
- 1 lỗ Ø10 + tarô M8 trên đáy mặt dưới
- Chân xoay điều chỉnh cao thấp 0-15mm

### Spec default em đề xuất

| Tham số | Default | Ý nghĩa |
|---|---|---|
| `mode` | **`'pin'`** (Loại 1) | Em đang dùng |
| `pinDia` | **8mm** | Ø lỗ định vị |
| `pinDepth` | **12mm** | Sâu lỗ |
| `insetFromEdge` | **45mm** | Tâm chân cách mép trước/sau đáy |
| `positionsPerDivider` | **2** | 2 chân/vách (1 trước + 1 sau) |

### 🔧 FOUNDER chọn
- [x] **Loại 1 — Chân nút mỏng Ø8** (em đang dùng) ✓
- [ ] Loại 2 — Chân plate 4 vít: __
- [ ] Loại 3 — Chân vít M8 điều chỉnh: __

---

## 9. Tay nắm

**Phổ biến VN, 3 loại:**

### Loại 1: Tay nắm móc (recessed/J-handle/recess pull)
- 1 lỗ Ø35 khoét xuyên cánh — em đang dùng
- Tay nắm là thanh kim loại lắp vào lỗ Ø35 + 2 vít từ mặt trong
- ~20-50k/cái

### Loại 2: Tay nắm thanh ngang (bar handle/D-pull)
- 2 lỗ Ø5 cách nhau 96mm / 128mm / 160mm (chuẩn industry)
- Vít M4 từ mặt trong cánh xuyên ra bắt tay nắm
- ~10-30k/cái phổ biến

### Loại 3: Tay nắm Cup pull (mặt ngăn kéo tủ vintage)
- 2 lỗ Ø5 cách nhau 64mm (chuẩn)
- Vít M4 xuyên

### Spec default em đề xuất

| Tham số | Default | Ý nghĩa |
|---|---|---|
| `mode` | **`'recessed'`** (Loại 1) | Em đang dùng — đơn giản nhất |
| `recessedDia` | **35mm** | Lỗ khoét xuyên |
| `recessedInsetFromEdge` | **40mm** | Tâm lỗ cách mép cánh |

### 🔧 FOUNDER chọn
- [x] **Loại 1 — Tay nắm móc Ø35** ✓
- [ ] Loại 2 — Bar handle 2 lỗ Ø5, spacing __ mm (96/128/160): __
- [ ] Loại 3 — Cup pull spacing 64mm: __

---

## 10. Bug logic hiện tại em cần fix

Sau khi catalog xong, em sẽ refactor để fix:

### Bug 1: Chốt kệ sai vị trí
- Hiện: lỗ Ø5 trên ĐÁY/NÓC/KỆ ngang
- Đúng: lỗ Ø5 dãy dọc trên MẶT TRONG VÁCH (32mm line drilling)
- Fix: bỏ machining `shelfPin` trên `bottom`/`top`/`shelf-N`; thêm vào `divider-cN-rN`

### Bug 2: Lỗ ray ngăn kéo span sai
- Hiện: `SLIDE_SCREW_SPAN_Y = 16` (sai)
- Đúng: 32mm (chuẩn 32mm system)
- Fix: đổi sang `catalog.machiningSpec.drawerSlide.clusterScrewSpan = 32`

### Bug 3: Thiếu confirmat M6.3 — không có liên kết vách ↔ tấm ngang
- Hiện: KHÔNG có operation nào
- Fix: thêm 2 lỗ confirmat mỗi giao điểm
  - Lỗ pilot Ø5×38 trên CẠNH vách (edge drilling)
  - Lỗ counterbore Ø7×13 + lỗ xuyên Ø6.3 trên MẶT tấm ngang

### Bug 4: Lỗ chồng visually trên DXF
- Hiện: file DXF 1 tấm có cả FRONT + BACK trong cùng 2D frame → circle chồng visualization
- Fix: tách 2 file `<part>-FRONT.dxf` + `<part>-BACK.dxf` (hoặc bỏ per-part, chỉ board-level)

### Bug 5: Mặt ngăn kéo thiếu vít từ thùng vào false-front
- Hiện: chỉ có handle Ø35
- Cần thêm: 4 vít M4 từ trong thùng hộc bắt ra mặt false-front (cố định mặt vào thùng)

### Bug 6: Thiếu vít hộc với đáy hộc
- Hiện: thùng hộc 4 tấm (2 hông + hậu + đáy) không có vít liên kết
- Cần: 4 vít/cạnh đáy hộc ghép vào hông + hậu (dowel hoặc vít)

---

## 11. Layer DXF chuẩn industry (CAM-ready)

Founder approved Option 1A + by tool/diameter naming. Layer plan:

### Per-board FRONT file (`board-N-<material>-<thickness>-FRONT.dxf`)
```
CUT_PATH        — outline tất cả tấm đã nest trên board
ENGRAVE_LABEL   — text nhãn ID tấm (in mờ)
DRILL_2.5MM     — lỗ mồi vít hậu (pilot Ø2.5)
DRILL_4MM       — vít M4 (cup hinge, plate, drawer slide)
DRILL_5MM       — lỗ chốt kệ + confirmat pilot trên cạnh
DRILL_7MM       — confirmat counterbore (đầu vít chìm)
DRILL_8MM       — dowel + chân tủ pin
DRILL_35MM      — tay nắm recessed
POCKET_35X13    — cup bản lề (sâu 13mm)
```

### Per-board BACK file (`board-N-<material>-<thickness>-BACK.dxf`)
Cùng layer nhưng chỉ chứa lỗ side='back' (mặt sau board). Xưởng lật tổng board.

### Per-board EDGE file (optional, `board-N-EDGE.dxf`)
Annotation cho edge drilling (confirmat pilot Ø5 trên cạnh) — vì 2D DXF không thể vẽ trực tiếp lỗ trên cạnh. Gồm:
- Top view của board (như nesting) với text marker "EDGE_HOLE @ x=__, y=__, Ø5 depth 38mm"
- Hoặc xuất riêng thành CSV `edge-holes.csv` (machine-readable cho CNC 5-axis)

### 🔧 FOUNDER confirm
- [x] **By tool/diameter naming** (chuẩn industry) ✓
- [x] **FRONT/BACK separate files per board** ✓
- [ ] Edge file format: [ ] DXF annotation [x] **CSV machine-readable** [ ] Cả 2

---

## 12. Implementation phases (sau khi founder confirm doc này)

**Phase B (Catalog schema)** — 1-2h
- Mở rộng `ProductionCatalog` thêm `machiningSpec: MachiningSpec` với 9 sub-sections (hingeCup, hingePlate, drawerSlide, confirmat, dowel, shelfPin, backScrew, foot, handle)
- DEFAULT_CATALOG fill values theo doc này
- `mergeCatalog` + `validateCatalog` cập nhật
- Sync sang maume

**Phase C (Admin UI)** — 2h
- `/admin/ke-catalog` thêm tab "Quy cách CNC"
- Form 9 section với label + tooltip giải thích

**Phase D (Engine consume)** — 3-4h
- Refactor `dna.ts`:
  - Bỏ 14 hằng số S10 hardcoded
  - Thêm `getSpec()` helper đọc từ `priceConfig.machiningSpec` với fallback default
  - Update mọi `panel()` call dùng spec
- Fix logic chốt kệ (move từ ngang → vách, 32mm line drilling)
- Thêm confirmat operation
- Thêm vít liên kết hộc

**Phase E (DXF refactor)** — 3-4h
- Rewrite `generateNestingDXF()` → output board-level với lỗ transform sẵn
- Tách FRONT/BACK files
- Layer by tool/diameter
- Edge holes CSV output
- Bỏ per-part DXF (founder approved)

**Phase F (Verify + deploy)** — 1h
- Validator: extend test machining để cover spec mới
- Local test với LibreCAD
- Deploy ke-maume + maume-admin

**Tổng**: ~10-12h sau khi founder review xong doc này.

---

## 13. Câu hỏi cuối cùng cho founder

Trước khi em start Phase B, founder review doc này và confirm:

1. **Tất cả block 🔧 FOUNDER** — em đã default theo "VN cheap common" — founder chỉ cần đổi nếu xưởng cụ thể họ làm việc dùng khác
2. **Edge drilling output format** (Section 11) — CSV machine-readable hay DXF annotation hay cả 2?
3. **Founder có biết xưởng cụ thể nào sẽ làm production?** Nếu có em research workflow CAM họ dùng (vd nếu xưởng dùng Cabinet Vision thì format hơi khác Mozaik)
4. **Cam lock** (knockdown ratchet) cho tủ flat-pack — founder có muốn hỗ trợ không? Hay chỉ ráp xưởng (không knockdown)?

Founder confirm xong em start code Phase B.
