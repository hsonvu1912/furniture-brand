# Copy audit — ngăn.maume.asia

**Mục đích:** Liệt kê toàn bộ chuỗi text tiếng Việt khách nhìn thấy trên website + **đề xuất viết lại**
theo `ngan-voice-vi.md`. **File này chỉ liệt kê & đề xuất — không sửa code.**

- **Codebase:** `furniture-brand/` (Next.js, deploy lên ngan.maume.asia; ke.maume.asia → 308 redirect)
- **Quét:** 2026-06-20 · **Pass viết lại:** 2026-06-20
- **Phạm vi:** `src/app/**`, `src/components/**`, `src/configurator/**`, `src/lib/**`
- **Đã bỏ qua:** comment, tên biến/hàm/key kỹ thuật, text tiếng Anh thuần, `console.log`, className/URL/slug.

**Cột "Đề xuất":** câu viết lại theo giọng ngăn. Câu nào vốn đã tự nhiên & không phạm luật → ghi
**`giữ nguyên`** (không viết lại cho có). Mục **(admin)** = chỉ hiện ở `mode='admin'`, khách KHÔNG thấy →
ngoài phạm vi giọng khách, để `giữ nguyên`.

> **Tổng quan:** Copy hiện tại đã rất sát giọng (ngắn, cụ thể, giọng thợ). Toàn site chỉ có **2 vi phạm
> CẤM cứng** (từ *"Khám phá"* mở đầu — mục 2 & 3) cùng một ít chen tiếng Anh và vài câu dịch sượng ở
> dialog đặt hàng. Xem **`## Tóm tắt thay đổi`** ở cuối để biết đổi gì & vì sao.

---

## 1. Header & điều hướng — `src/components/Header.tsx`

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/components/Header.tsx | NAV array (dòng 12) | label | Bộ sưu tập | giữ nguyên |
| src/components/Header.tsx | NAV array (dòng 13) | label | Thiết kế | giữ nguyên |
| src/components/Header.tsx | NAV array (dòng 14) | label | Liên hệ | giữ nguyên |
| src/components/Header.tsx | Logo link aria-label (dòng 43) | tooltip | Trang chủ ngăn by màumè | giữ nguyên |
| src/components/Header.tsx | Nút mobile aria-label (dòng 63) | tooltip | Đóng menu | giữ nguyên |
| src/components/Header.tsx | Nút mobile aria-label (dòng 63) | tooltip | Mở menu | giữ nguyên |
| src/components/Header.tsx | Nút mobile (dòng 66) | button | Đóng | giữ nguyên |
| src/components/Header.tsx | Nút mobile (dòng 66) | button | Menu | giữ nguyên |
| src/components/Header.tsx | Mobile menu dialog aria-label (dòng 88) | tooltip | Menu điều hướng | giữ nguyên |

---

## 2. Trang chủ — `src/components/*` (Hero, marquee, story, value props, how-it-works, featured, quote, category)

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/components/Hero.tsx | Hero — caption trái (dòng 21-23) | label | Tủ kệ thiết kế tham số — \<Ngan/\> by màumè | giữ nguyên |
| src/components/Hero.tsx | Hero — h1 (dòng 24-27) | heading | tủ kệ đo từng milimet. | giữ nguyên |
| src/components/Hero.tsx | Hero — body (dòng 29-32) | body | Chọn một mẫu sẵn, hoặc bắt đầu từ tờ giấy trắng. Xoay 3D, đổi vật liệu, xem giá ngay. Xưởng Việt Nam làm theo bản vẽ của bạn — không sai số. | giữ nguyên |
| src/components/Hero.tsx | Hero — CTA chính (dòng 39) | button | Bắt đầu thiết kế → | giữ nguyên |
| src/components/Hero.tsx | Hero — CTA phụ (dòng 42) | button | Xem 5 mẫu sẵn | giữ nguyên |
| src/components/Hero.tsx | Hero — featured link aria-label (dòng 52) | tooltip | Xem {featured.name} | giữ nguyên |
| src/components/Hero.tsx | Hero — featured img alt (dòng 57) | alt | {featured.name} — {featured.usecase} | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 7) | label | tủ kệ | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 8) | label | thiết kế | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 9) | label | tham số | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 11) | label | cut-list xưởng | giữ nguyên *(tag trang trí, xem ghi chú)* |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 12) | label | tủ TV | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 13) | label | tủ sách | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 14) | label | tủ trang trí | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 15) | label | tủ giày | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 16) | label | tủ đầu giường | giữ nguyên |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 17) | label | custom kích thước | giữ nguyên *(tag trang trí, xem ghi chú)* |
| src/components/BrandMarquee.tsx | KEYWORDS (dòng 18) | label | MDF sơn | giữ nguyên |
| src/components/StorySection.tsx | Caption (dòng 14) | label | Triết lý làm tủ | giữ nguyên |
| src/components/StorySection.tsx | Blockquote (dòng 15-18) | body | "Không có 2 ngôi nhà giống nhau, nên không có 2 chiếc tủ giống nhau." | giữ nguyên |
| src/components/StorySection.tsx | Body (dòng 19-22) | body | \<Ngan/\> tin rằng nội thất nên đo theo bạn, không phải bạn co theo nội thất. Mỗi bản vẽ chúng tôi gửi xưởng là duy nhất, theo từng milimet bạn chỉnh. | giữ nguyên |
| src/components/StorySection.tsx | CTA (dòng 23) | button | Thử thiết kế → | giữ nguyên |
| src/components/ValueProps.tsx | PROPS — prop 1 tiêu đề (dòng 10) | heading | tham số hoá | giữ nguyên *(thuật ngữ thương hiệu, xem ghi chú)* |
| src/components/ValueProps.tsx | PROPS — prop 1 body (dòng 11) | body | Cột, tầng, kích thước, vật liệu, ngăn — bạn kéo thanh trượt, tủ đổi ngay theo từng milimet. Không có 2 chiếc giống nhau. | giữ nguyên |
| src/components/ValueProps.tsx | PROPS — prop 2 tiêu đề (dòng 16) | heading | 3D realtime | **Xem 3D ngay** |
| src/components/ValueProps.tsx | PROPS — prop 2 body (dòng 17) | body | Không phải tưởng tượng. Mỗi lần chỉnh là thấy ngay khối tủ trên màn hình, xoay được, zoom được, xem trước khi đặt. | giữ nguyên |
| src/components/ValueProps.tsx | PROPS — prop 3 tiêu đề (dòng 20) | heading | cut-list xưởng | **bảng cắt xưởng** |
| src/components/ValueProps.tsx | PROPS — prop 3 body (dòng 21) | body | Mỗi thiết kế đẻ ra bảng cắt chi tiết theo từng tấm ván, đúng quy cách xưởng VN. Đặt là làm — không sai số. | giữ nguyên |
| src/components/ValueProps.tsx | Heading section (dòng 28-30) | heading | Vì sao \<Ngan/\> | giữ nguyên |
| src/components/HowItWorks.tsx | STEPS — bước 1 tiêu đề (dòng 11) | heading | chọn mẫu | giữ nguyên |
| src/components/HowItWorks.tsx | STEPS — bước 1 body (dòng 12) | body | Bắt đầu từ 1 trong 5 mẫu thiết kế sẵn (Compact, Studio, Loft, Tall, Wide), hoặc từ tờ giấy trắng. Mỗi mẫu mở Configurator để bạn chỉnh tiếp. | **Bắt đầu từ 1 trong 5 mẫu thiết kế sẵn (Compact, Studio, Loft, Tall, Wide), hoặc từ tờ giấy trắng. Mỗi mẫu mở trình dựng để bạn chỉnh tiếp.** |
| src/components/HowItWorks.tsx | STEPS — bước 2 tiêu đề (dòng 16) | heading | đo từng milimet | giữ nguyên |
| src/components/HowItWorks.tsx | STEPS — bước 2 body (dòng 17) | body | Kéo thanh trượt — chiều rộng, cao, sâu đến từng mm. Đổi cột, đổi tầng, đổi cánh/ngăn kéo theo từng ô. Xem 3D xoay được, zoom được. | giữ nguyên |
| src/components/HowItWorks.tsx | STEPS — bước 3 tiêu đề (dòng 20) | heading | xưởng làm — giao | giữ nguyên |
| src/components/HowItWorks.tsx | STEPS — bước 3 body (dòng 21) | body | Chốt giá, đặt 50%. Xưởng VN cắt CNC theo bản vẽ DXF, sai số 0. Giao tận nhà, lắp ráp trong 60 phút. Bảo hành 24 tháng. | giữ nguyên |
| src/components/HowItWorks.tsx | Header — kicker (dòng 30) | label | 3 bước | giữ nguyên |
| src/components/HowItWorks.tsx | Header — heading (dòng 31-33) | heading | Cách \<Ngan/\> làm việc. | giữ nguyên |
| src/components/HomeFeatured.tsx | Heading (dòng 27) | heading | Bộ sưu tập | giữ nguyên |
| src/components/HomeFeatured.tsx | Link xem tất cả (dòng 33) | button | Xem tất cả → | giữ nguyên |
| src/components/QuoteSection.tsx | Caption (dòng 12) | label | Lời từ khách | giữ nguyên |
| src/components/QuoteSection.tsx | Blockquote (dòng 14-16) | body | "Tôi đo phòng xong, \<Ngan/\> tính ra chiếc tủ đúng từng centimet." | giữ nguyên |
| src/components/QuoteSection.tsx | Chữ ký (dòng 17-19) | label | Linh · Studio 28m² · Tp. HCM | giữ nguyên |
| src/components/CategoryList.tsx | Section heading (dòng 11) | heading | Khám phá theo loại tủ | **Chọn theo loại tủ** |
| src/components/CategoryList.tsx | CTA (dòng 26) | button | Hoặc thiết kế riêng → | giữ nguyên |

---

## 3. Footer — `src/components/Footer.tsx`

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/components/Footer.tsx | Mantra row (dòng 23) | body | Thiết kế từng milimet | giữ nguyên |
| src/components/Footer.tsx | Mantra row (dòng 27) | body | Render 3D realtime | **Dựng 3D ngay** |
| src/components/Footer.tsx | Mantra row (dòng 31) | body | Xưởng Việt Nam · Since 2026 | **Xưởng Việt Nam · Từ 2026** |
| src/components/Footer.tsx | Brand statement (dòng 39) | body | làm cho việc đóng tủ kệ riêng dễ hơn. | giữ nguyên |
| src/components/Footer.tsx | Brand statement (dòng 41-44) | body | Bạn chỉnh từng milimet, chọn vật liệu, xem 3D ngay. Xưởng VN cắt CNC theo bản vẽ, giao tận nhà, lắp ráp trong 60 phút. | giữ nguyên |
| src/components/Footer.tsx | Email signup heading (dòng 47-49) | heading | Đăng ký nhận mẫu mới | giữ nguyên |
| src/components/Footer.tsx | Email signup placeholder (dòng 53) | placeholder | Email của bạn | giữ nguyên |
| src/components/Footer.tsx | Email signup nút (dòng 60) | button | Đăng ký | giữ nguyên |
| src/components/Footer.tsx | Nav grid — heading (dòng 96) | heading | Khám phá | **Xem nhanh** |
| src/components/Footer.tsx | Nav grid (dòng 99) | label | Bộ sưu tập | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 100) | label | Thiết kế tự do | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 101) | label | Liên hệ | giữ nguyên |
| src/components/Footer.tsx | Nav grid — heading (dòng 106) | heading | Loại tủ | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 109) | label | Tủ TV | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 110) | label | Tủ trang trí | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 111) | label | Tủ sách | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 112) | label | Tủ giày | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 113) | label | Tủ đầu giường | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 123) | label | Spec gỗ & vật liệu | **Gỗ & vật liệu** |
| src/components/Footer.tsx | Nav grid (dòng 124) | label | Tham số hoá | giữ nguyên *(thuật ngữ thương hiệu, xem ghi chú)* |
| src/components/Footer.tsx | Nav grid — heading (dòng 129) | heading | Về \<Ngan/\> | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 134) | label | Brand mẹ: màumè | **Thương hiệu mẹ: màumè** |
| src/components/Footer.tsx | Nav grid (dòng 137) | label | Xưởng Việt Nam | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 138) | label | Bảo hành 24 tháng | giữ nguyên |
| src/components/Footer.tsx | Nav grid — heading (dòng 144) | heading | Liên lạc | giữ nguyên |
| src/components/Footer.tsx | Nav grid (dòng 153) | label | Tp. Hồ Chí Minh · VN | giữ nguyên |
| src/components/Footer.tsx | Bottom strip (dòng 179) | body | © {year} \<Ngan/\> by màumè. Mọi quyền được bảo lưu. | giữ nguyên |
| src/components/KeLogo.tsx | Wordmark (dòng 23) | label | by màumè | giữ nguyên |

---

## 4. Bộ sưu tập (danh sách + filter) — `collection/page.tsx`, `CollectionClient.tsx`, `FilterBar.tsx`, `PresetCard.tsx`

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/app/collection/page.tsx | Header inline wordmark (dòng 42) | heading | ngăn | giữ nguyên |
| src/app/collection/page.tsx | Header inline title (dòng 44) | heading | Bộ sưu tập | giữ nguyên |
| src/app/collection/page.tsx | Intro paragraph (dòng 48-49) | body | {presets.length} mẫu thiết kế sẵn — click vào mẫu để mở Configurator và chỉnh tiếp theo ý bạn. | **{presets.length} mẫu thiết kế sẵn — bấm vào mẫu để mở trình dựng và chỉnh tiếp theo ý bạn.** |
| src/app/collection/page.tsx | Suspense fallback (dòng 52) | body | Đang tải… | giữ nguyên |
| src/components/CollectionClient.tsx | Heading (dòng 37) | label | Tủ kệ | giữ nguyên |
| src/components/CollectionClient.tsx | Heading (dòng 37) | label | Mô-đun | giữ nguyên |
| src/components/CollectionClient.tsx | Filter label (dòng 66) | label | Loại tủ | giữ nguyên |
| src/components/CollectionClient.tsx | Filter option (dòng 67) | label | Tất cả | giữ nguyên |
| src/components/CollectionClient.tsx | Filter option (dòng 68) | label | Tủ kệ | giữ nguyên |
| src/components/CollectionClient.tsx | Filter option (dòng 69) | label | Mô-đun | giữ nguyên |
| src/components/CollectionClient.tsx | Empty state (dòng 75) | body | Không tìm thấy | giữ nguyên |
| src/components/CollectionClient.tsx | Empty state (dòng 76) | body | Không có mẫu nào phù hợp. | giữ nguyên |
| src/components/FilterBar.tsx | SORTS (dòng 13) | option | Mặc định | giữ nguyên |
| src/components/FilterBar.tsx | SORTS (dòng 14) | option | Giá ↑ | giữ nguyên |
| src/components/FilterBar.tsx | SORTS (dòng 15) | option | Giá ↓ | giữ nguyên |
| src/components/FilterBar.tsx | Desktop — label (dòng 47) | label | Loại | giữ nguyên |
| src/components/FilterBar.tsx | Desktop — label (dòng 66) | label | Sắp xếp | giữ nguyên |
| src/components/FilterBar.tsx | Mobile — label (dòng 99) | label | Loại | giữ nguyên |
| src/components/FilterBar.tsx | Mobile — label (dòng 117) | label | Sắp xếp | giữ nguyên |
| src/components/PresetCard.tsx | Link aria-label (dòng 68) | tooltip | Xem {preset.name} | giữ nguyên |
| src/components/PresetCard.tsx | Img alt (dòng 78) | alt | {preset.name} — tủ {preset.usecase} | giữ nguyên |
| src/components/PresetCard.tsx | Meta (dòng 121) | label | {totalPanels} tấm | giữ nguyên |
| src/components/PresetCard.tsx | Meta (dòng 122) | label | {columns}×{rows} · {totalPanels} tấm | giữ nguyên |

---

## 5. Trang sản phẩm — `collection/[slug]/page.tsx`, `ProductGallery.tsx`

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/app/collection/[slug]/page.tsx | Breadcrumb link (dòng 121-123) | body | Bộ sưu tập | giữ nguyên |
| src/app/collection/[slug]/page.tsx | ProductGallery alt (dòng 139) | alt | {preset.name} — tủ kệ {preset.usecase} | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — label (dòng 152) | label | Loại tủ | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — label (dòng 158) | label | Kích thước phủ bì | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — label (dòng 158) | label | Kích thước | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — value (dòng 161) | body | {…} × {…} × {…} mm | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — label (dòng 166) | label | Số ô | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — value tu-y (dòng 169) | body | {moduleCount} ô | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — value tu-ke (dòng 170) | body | {…} cột × {…} tầng | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — label (dòng 175) | label | Số cánh | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — value (dòng 177) | body | {result.doorCount} cánh | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — label (dòng 182) | label | Số tấm ván | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Thông số — value (dòng 184) | body | {cutlist.totalPanels} tấm | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Màu — caption (dòng 192) | label | Màu có sẵn · {availableColors.length} | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Màu — swatch title/aria-label (dòng 197-198) | tooltip | {c.label} | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Màu — note (dòng 208-210) | body | Chọn màu khung & từng ô khi bấm "Thiết kế tủ này". | giữ nguyên |
| src/app/collection/[slug]/page.tsx | Giá — caption (dòng 219-221) | body | Giá tham khảo · chưa gồm vận chuyển & lắp đặt | giữ nguyên |
| src/app/collection/[slug]/page.tsx | CTA (dòng 226) | button | Thiết kế tủ này → | giữ nguyên |
| src/components/ProductGallery.tsx | Thumbnail button aria-label (dòng 43) | tooltip | Xem góc {i + 1} | giữ nguyên |

---

## 6. Configurator — Tủ kệ (lưới cột × tầng) — `src/configurator/Configurator.tsx`

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/configurator/Configurator.tsx | TAB_SHORT (dòng 99) | option | Rộng | giữ nguyên |
| src/configurator/Configurator.tsx | TAB_SHORT (dòng 100) | option | Cao | giữ nguyên |
| src/configurator/Configurator.tsx | TAB_SHORT (dòng 101) | option | Sâu | giữ nguyên |
| src/configurator/Configurator.tsx | TAB_SHORT (dòng 102) | option | Ô tủ | giữ nguyên |
| src/configurator/Configurator.tsx | TAB_SHORT (dòng 103) | option | Vật liệu | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — ngăn kéo (dòng 348) | error | Ô rộng {cm}cm — ngăn kéo cần ô rộng tối thiểu 25cm | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — ngăn kéo (dòng 349) | error | Ô rộng {cm}cm — ngăn kéo cần ô rộng tối đa 90cm | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — ngăn kéo (dòng 352) | error | Ô cao {cm}cm — ngăn kéo cần ô cao tối đa 40cm | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — ngăn kéo (dòng 353) | error | Ô ở cao quá — ngăn kéo chỉ phù hợp dưới 1,2m | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — ngăn kéo (dòng 355) | error | Ngăn kéo không hợp kích thước | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — cánh (dòng 359) | error | Ô rộng {cm}cm — cánh cần ô rộng tối thiểu 25cm | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — cánh (dòng 360) | error | Ô rộng {cm}cm — cánh cần ô rộng tối đa 120cm | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — cánh (dòng 363) | error | Ô cao {cm}cm — cánh cần ô cao tối đa 240cm | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — cánh (dòng 365) | error | Cánh không hợp kích thước | giữ nguyên |
| src/configurator/Configurator.tsx | getDisabledReason — default (dòng 367) | error | Không hợp kích thước | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — option ô gộp (dòng 549) | option | Cánh | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — splitVTitle (dòng 640) | tooltip | Không thể chia dọc — ô {ngăn kéo/cánh/này} không đủ rộng cho 2 sub-cell hợp lệ | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — splitVTitle (dòng 641) | tooltip | Chia ô thành 2 {ngăn kéo/cánh/phần} trái-phải (50/50) | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — splitHTitle (dòng 643) | tooltip | Không thể chia ngang — ô không đủ cao cho 2 sub-cell hợp lệ | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — splitHTitle (dòng 644) | tooltip | Chia ô thành 2 {ngăn kéo/cánh/phần} trên-dưới (50/50) | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — mergeUpTitle (dòng 647) | tooltip | Không thể gộp lên — không có ô láng giềng phù hợp | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — mergeUpTitle (dòng 648) | tooltip | Gộp với ô bên trên | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — mergeDownTitle (dòng 650) | tooltip | Không thể gộp xuống — không có ô láng giềng phù hợp | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — mergeDownTitle (dòng 651) | tooltip | Gộp với ô bên dưới | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — mergeLeftTitle (dòng 653) | tooltip | Không thể gộp sang trái — không có ô láng giềng phù hợp | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — mergeLeftTitle (dòng 654) | tooltip | Gộp với ô bên trái | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — mergeRightTitle (dòng 656) | tooltip | Không thể gộp sang phải — không có ô láng giềng phù hợp | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — mergeRightTitle (dòng 657) | tooltip | Gộp với ô bên phải | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — unmergeTitle (dòng 659) | tooltip | Ô chưa được gộp — không có gì để bỏ | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — unmergeTitle (dòng 660) | tooltip | Bỏ gộp: tách block lớn về các ô riêng | **Bỏ gộp: tách khối lớn về các ô riêng** |
| src/configurator/Configurator.tsx | CellBar — header heading (dòng 709) | heading | Ô con đang chọn | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — header heading (dòng 709) | heading | Ô đang chọn | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — nút × (dòng 713) | tooltip | Bỏ chọn ô | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — tab (dòng 723) | label | Kiểu ô | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — tab (dòng 724) | label | Màu ô | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — note frozenByMerge (dòng 732-734) | body | Ô này đang gộp lớn. Bấm Bỏ gộp bên dưới để chỉnh kiểu & màu từng ô. | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — note mergedRestrict (dòng 740-742) | body | Ô gộp đang Mở (không hậu) — chọn Cánh ở tab Kiểu ô để tô màu. | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — note locked color (dòng 746) | body | Ô mở-không-hậu không có vật liệu để đổi. | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — option reason (dòng 761) | error | Ô con sau khi chia không đủ kích thước cho "{label}" | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — nhãn Chia (dòng 803) | label | Chia | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — nút chia dọc (dòng 807) | button | Dọc | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — nút chia ngang (dòng 814) | button | Ngang | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — nhãn Gộp (dòng 824) | label | Gộp | giữ nguyên |
| src/configurator/Configurator.tsx | CellBar — nút bỏ gộp (dòng 848) | button | ⊟ Bỏ gộp ô | giữ nguyên |
| src/configurator/Configurator.tsx | NumberControl — readonly (dòng 959) | label | {unit} · = tổng các ô | giữ nguyên |
| src/configurator/Configurator.tsx | NumberControl — segmented option (dòng 981) | option | {n} cm | giữ nguyên |
| src/configurator/Configurator.tsx | NumberControl — input aria-label (dòng 1007) | tooltip | {label} — nhập số | giữ nguyên |
| src/configurator/Configurator.tsx | EditorialHeader — kicker (dòng 2132) | heading | Tủ kệ · ngăn | giữ nguyên |
| src/configurator/Configurator.tsx | EditorialHeader — hint (dòng 2133) | body | Kéo thanh trượt chỉnh kích thước. Chạm vào ô tủ trên hình để đổi kiểu & màu. | giữ nguyên |
| src/configurator/Configurator.tsx | Chiều cao editor — nhãn tầng (dòng 2206) | label | Tầng {rowSelect + 1} | giữ nguyên |
| src/configurator/Configurator.tsx | Chiều cao editor — nút × (dòng 2211) | tooltip | Bỏ chọn tầng | giữ nguyên |
| src/configurator/Configurator.tsx | Chiều cao editor — nấc cm (dòng 2232) | option | {n} cm | giữ nguyên |
| src/configurator/Configurator.tsx | Chiều cao editor — hint (dòng 2240-2241) | body | Kéo thanh trên để cao/thấp (tự thêm/bớt tầng 30cm). Chạm vào một tầng trên hình để chỉnh riêng chiều cao tầng đó. | giữ nguyên |
| src/configurator/Configurator.tsx | Chiều rộng editor — heading (dòng 2253) | heading | Chỉnh rộng cột | giữ nguyên |
| src/configurator/Configurator.tsx | Chiều rộng editor — nút × (dòng 2258) | tooltip | Bỏ chọn cột | giữ nguyên |
| src/configurator/Configurator.tsx | Chiều rộng editor — hint (dòng 2275-2277) | body | Chạm vào một cột trên hình để chỉnh riêng rộng cột đó (kích thước từng cột hiện ngay trên mô hình). Kéo thanh trên để rộng/hẹp cả tủ. | giữ nguyên |
| src/configurator/Configurator.tsx | Nút về trang chủ (mobile) aria-label (dòng 2315) | tooltip | Về trang chủ | giữ nguyên |
| src/configurator/Configurator.tsx | FloatingIconButton — hoàn tác aria-label (dòng 2325) | tooltip | Hoàn tác | giữ nguyên |
| src/configurator/Configurator.tsx | FloatingIconButton — hoàn tác title (dòng 2325) | tooltip | Hoàn tác thay đổi gần nhất | giữ nguyên |
| src/configurator/Configurator.tsx | FloatingIconButton — kích thước aria-label (dòng 2326) | tooltip | Bật/tắt kích thước tổng | giữ nguyên |
| src/configurator/Configurator.tsx | FloatingIconButton — kích thước title (dòng 2326) | tooltip | Ẩn kích thước tổng | giữ nguyên |
| src/configurator/Configurator.tsx | FloatingIconButton — kích thước title (dòng 2326) | tooltip | Hiện kích thước tổng | giữ nguyên |
| src/configurator/Configurator.tsx | WarningBox — title (dòng 2331) | heading | ⚠ Cảnh báo kích thước | giữ nguyên |
| src/configurator/Configurator.tsx | HintPill — tab Ô tủ (dòng 2343) | body | Chạm ô để chỉnh | giữ nguyên |
| src/configurator/Configurator.tsx | HintPill — tab Chiều cao (dòng 2345) | body | Chạm tầng để chỉnh cao | giữ nguyên |
| src/configurator/Configurator.tsx | HintPill — tab Chiều rộng (dòng 2346) | body | Chạm cột để chỉnh rộng | giữ nguyên |
| src/configurator/Configurator.tsx | OrderBar summary (dòng 2356) | body | Mẫu: | giữ nguyên |
| src/configurator/Configurator.tsx | OrderBar summary — fallback tên (dòng 2356) | body | Tủ tự thiết kế | giữ nguyên |
| src/configurator/Configurator.tsx | OrderBar summary (dòng 2357) | body | Kích thước: | giữ nguyên |
| src/configurator/Configurator.tsx | OrderBar summary (dòng 2358) | body | Cấu trúc: | giữ nguyên |
| src/configurator/Configurator.tsx | OrderBar summary (dòng 2358) | body | {columns} cột × {rows} tầng | giữ nguyên |
| src/configurator/Configurator.tsx | ColSizeRow — tên cột (dòng 2893) | label | Cột {index + 1} | giữ nguyên |
| src/configurator/Configurator.tsx | CellGridControl — aria-label ô (dòng 3259) | tooltip | Cột {c + 1}, tầng {r + 1} | giữ nguyên |
| src/configurator/Configurator.tsx | CellGridControl — aria-label khoá (dòng 3259) | tooltip | — khoá (ô mở không hậu) | giữ nguyên |
| src/configurator/Configurator.tsx | CellGridControl — helper text (dòng 3292) | body | Bấm 1 ô để chọn — ô đúng tỉ lệ và màu như mặt đứng tủ. | giữ nguyên |

---

## 7. Configurator — Tủ mô-đun (Tetris) — `src/configurator/YConfigurator.tsx`

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/configurator/YConfigurator.tsx | EdgeAddButtons — nút "+" (dòng 215) | tooltip | Thêm ô tủ | giữ nguyên |
| src/configurator/YConfigurator.tsx | PICK_FEATS (dòng 242) | option | Mở | giữ nguyên |
| src/configurator/YConfigurator.tsx | PICK_FEATS (dòng 243) | option | Mở có hậu | giữ nguyên |
| src/configurator/YConfigurator.tsx | PICK_FEATS (dòng 244) | option | Cánh | giữ nguyên |
| src/configurator/YConfigurator.tsx | PICK_FEATS (dòng 245) | option | Ngăn kéo | giữ nguyên |
| src/configurator/YConfigurator.tsx | doorSubVariants (dòng 288) | option | cánh đơn | giữ nguyên |
| src/configurator/YConfigurator.tsx | doorSubVariants (dòng 289) | option | cánh đôi | giữ nguyên |
| src/configurator/YConfigurator.tsx | doorSubVariants (dòng 292) | option | cánh đôi | giữ nguyên |
| src/configurator/YConfigurator.tsx | doorSubVariants (dòng 292) | option | cánh đơn | giữ nguyên |
| src/configurator/YConfigurator.tsx | drawerSubVariants (dòng 297) | option | 2 ngăn | giữ nguyên |
| src/configurator/YConfigurator.tsx | drawerSubVariants (dòng 298) | option | 3 ngăn | giữ nguyên |
| src/configurator/YConfigurator.tsx | drawerSubVariants (dòng 301) | option | {dc} ngăn (vd "1 ngăn", "2 ngăn") | giữ nguyên |
| src/configurator/YConfigurator.tsx | editVariants (dòng 307) | option | mở | giữ nguyên |
| src/configurator/YConfigurator.tsx | editVariants (dòng 308) | option | mở có hậu | giữ nguyên |
| src/configurator/YConfigurator.tsx | ModulePicker — tile (dòng 329) | option | có hậu | giữ nguyên |
| src/configurator/YConfigurator.tsx | ModulePicker — tile (dòng 329) | option | mở | giữ nguyên |
| src/configurator/YConfigurator.tsx | ModulePicker — heading (dòng 335) | heading | Thêm ô mới | giữ nguyên |
| src/configurator/YConfigurator.tsx | ModulePicker — nút huỷ aria-label (dòng 336) | tooltip | Huỷ thêm ô | giữ nguyên |
| src/configurator/YConfigurator.tsx | ModulePicker — tile title (dòng 351) | tooltip | {label} cm · {sub} (vd "18×36 cm · cánh đơn") | giữ nguyên |
| src/configurator/YConfigurator.tsx | ModulePicker — chú thích (dòng 361) | body | Bấm 1 hình để thêm ô. | giữ nguyên |
| src/configurator/YConfigurator.tsx | commitComp — toast (dòng 428) | error | Không đặt được ô (đè ô khác hoặc lọt dưới sàn). | giữ nguyên |
| src/configurator/YConfigurator.tsx | EditorialHeader — kicker (dòng 578) | label | Tủ mô-đun · ngăn | giữ nguyên |
| src/configurator/YConfigurator.tsx | EditorialHeader — hint (dòng 580) | body | Chạm 1 ô để chỉnh · bấm "+" quanh ô để thêm ô mới. | giữ nguyên |
| src/configurator/YConfigurator.tsx | Ô đang chọn — heading (dòng 591) | heading | Ô đang chọn | giữ nguyên |
| src/configurator/YConfigurator.tsx | Ô đang chọn — rỗng (dòng 593) | body | Chạm vào 1 ô trên mô hình để chỉnh. Bấm dấu "+" quanh ô để thêm ô mới. | giữ nguyên |
| src/configurator/YConfigurator.tsx | Ô đang chọn — hướng dẫn (dòng 597) | body | Bấm hình để đổi KIỂU ô. Đổi KÍCH THƯỚC thì xoá rồi thêm bằng bộ hình "+". | giữ nguyên |
| src/configurator/YConfigurator.tsx | Kiểu ô — label (dòng 599) | label | Kiểu ô | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu khung ô — label (dòng 624) | label | Màu khung ô | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu khung ô — nút (dòng 626) | button | Mặc định | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu mặt — label (dòng 634) | label | Màu mặt ngăn kéo | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu mặt — label (dòng 634) | label | Màu cánh ô | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu cánh ô — nút (dòng 636) | button | Theo khung | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu nẹp ô — label (dòng 644) | label | Màu nẹp ô | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu nẹp ô — nút (dòng 646) | button | Theo nẹp chung | giữ nguyên |
| src/configurator/YConfigurator.tsx | Cảnh báo ô bay (dòng 664) | error | ⚠ Ô này đang "bay" — chưa có ô/sàn đỡ. | giữ nguyên |
| src/configurator/YConfigurator.tsx | Nút xoá ô (dòng 666) | button | 🗑 Xoá ô | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu — heading (dòng 674) | heading | Màu | giữ nguyên |
| src/configurator/YConfigurator.tsx | Segmented chế độ màu — aria-label (dòng 676) | tooltip | Chế độ màu | giữ nguyên |
| src/configurator/YConfigurator.tsx | Segmented — option (dòng 677) | option | Màu chung | giữ nguyên |
| src/configurator/YConfigurator.tsx | Segmented — option (dòng 677) | option | Riêng từng ô | giữ nguyên |
| src/configurator/YConfigurator.tsx | Mode riêng — chú thích (dòng 682) | body | Bấm 1 ô trên mô hình để chỉnh màu khung/cánh/nẹp riêng cho ô đó. | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu khung — heading (dòng 693) | heading | Màu khung | giữ nguyên |
| src/configurator/YConfigurator.tsx | Màu nẹp — heading (dòng 703) | heading | Màu nẹp | giữ nguyên |
| src/configurator/YConfigurator.tsx | Nút về trang chủ (mobile) aria-label (dòng 754) | tooltip | Về trang chủ | giữ nguyên |
| src/configurator/YConfigurator.tsx | FloatingIconButton — undo aria-label (dòng 764) | tooltip | Hoàn tác | giữ nguyên |
| src/configurator/YConfigurator.tsx | FloatingIconButton — undo title (dòng 764) | tooltip | Hoàn tác thay đổi gần nhất | giữ nguyên |
| src/configurator/YConfigurator.tsx | FloatingIconButton — ruler aria-label (dòng 765) | tooltip | Bật/tắt kích thước tổng | giữ nguyên |
| src/configurator/YConfigurator.tsx | FloatingIconButton — ruler title (dòng 765) | tooltip | Ẩn kích thước tổng | giữ nguyên |
| src/configurator/YConfigurator.tsx | FloatingIconButton — ruler title (dòng 765) | tooltip | Hiện kích thước tổng | giữ nguyên |
| src/configurator/YConfigurator.tsx | OrderBar — title (dòng 773) | button | Đặt hàng | giữ nguyên |
| src/configurator/YConfigurator.tsx | OrderBar — summary (dòng 774) | body | Mẫu: | giữ nguyên |
| src/configurator/YConfigurator.tsx | HintPill (dòng 779) | body | Chạm ô để chỉnh · bấm + để thêm ô | giữ nguyên |
| src/configurator/YConfigurator.tsx | Nút thêm ô đầu tiên (dòng 788) | button | Thêm ô đầu tiên | giữ nguyên |
| src/configurator/YConfigurator.tsx | WarningBox — title (dòng 792) | label | ⚠ Cảnh báo | giữ nguyên |

---

## 8. Dialog đặt hàng (khách) — `src/configurator/ui/index.tsx`

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/configurator/ui/index.tsx | EditorialHeader — link trang chủ (dòng 31) | label | ← Trang chủ | giữ nguyên |
| src/configurator/ui/index.tsx | OrderBar — giá (dòng 228) | label | Giá tham khảo | giữ nguyên |
| src/configurator/ui/index.tsx | OrderBar — nút mặc định (dòng 218, 233) | button | Đặt hàng | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — validate (dòng 257) | error | Vui lòng nhập tên và số điện thoại | **Cho mình xin tên và số điện thoại.** |
| src/configurator/ui/index.tsx | OrderDialog — lỗi gửi đơn (dòng 270) | error | Gửi đơn thất bại | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — lỗi chung (dòng 273) | error | Lỗi không xác định | **Có lỗi — thử lại giúp mình nhé.** |
| src/configurator/ui/index.tsx | OrderDialog — thành công heading (dòng 284) | heading | Đã gửi đơn! | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — thành công body (dòng 285-287) | body | Maumè đã nhận đơn. Chúng tôi sẽ liên hệ qua số {form.phone} trong 24h để xác nhận. | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — nút đóng (dòng 288) | button | Đóng | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — nút đóng (X) aria-label (dòng 294) | tooltip | Đóng | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — tóm tắt giá (dòng 298) | label | Giá tham khảo: | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — label họ tên (dòng 301) | label | Họ tên | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — placeholder tên (dòng 302) | placeholder | Nguyễn Văn A | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — label SĐT (dòng 303) | label | Số điện thoại | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — label email (dòng 305) | label | Email | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — label địa chỉ (dòng 307) | label | Địa chỉ giao hàng | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — placeholder địa chỉ (dòng 308) | placeholder | Số nhà, đường, quận, TP | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — label ghi chú (dòng 309) | label | Ghi chú | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — placeholder ghi chú (dòng 310) | placeholder | Deadline, yêu cầu đặc biệt… | **Ngày cần giao, yêu cầu đặc biệt…** |
| src/configurator/ui/index.tsx | OrderDialog — nút gửi (đang gửi) (dòng 315) | button | Đang gửi… | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — nút gửi (dòng 315) | button | Gửi đơn | giữ nguyên |
| src/configurator/ui/index.tsx | OrderDialog — ghi chú đồng ý (dòng 317) | body | Bằng cách gửi, bạn đồng ý maumè liên hệ qua SĐT để xác nhận đơn. | **Gửi đơn là bạn đồng ý cho maumè gọi qua SĐT để xác nhận.** |
| src/app/api/order/route.ts | Validate error response (dòng 28) | error | Thiếu tên hoặc số điện thoại | giữ nguyên |

---

## 9. Loading / fallback states

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/app/design/DesignClient.tsx | Configurator loading fallback (dòng 22) | body | Đang tải trình dựng 3D… | giữ nguyên |
| src/app/design/DesignClient.tsx | YConfigurator loading fallback (dòng 34) | body | Đang tải trình dựng 3D… | giữ nguyên |

---

## 10. Meta / SEO — `layout.tsx` + metadata các trang

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/app/layout.tsx | metadata.title.default (dòng 56) | meta | ngăn by màumè — Tủ kệ thiết kế 3D | giữ nguyên |
| src/app/layout.tsx | metadata.title.template (dòng 57) | meta | %s · ngăn by màumè | giữ nguyên |
| src/app/layout.tsx | metadata.description (dòng 59-60) | meta | Thiết kế tủ kệ theo ý bạn: chỉnh kích thước, ngăn, vật liệu — xem ngay mô hình 3D, giá hiện ngay, xưởng làm sẵn cho bạn. | giữ nguyên |
| src/app/layout.tsx | metadata.openGraph.title (dòng 62) | meta | ngăn by màumè — Tủ kệ thiết kế 3D | giữ nguyên |
| src/app/layout.tsx | metadata.openGraph.description (dòng 63-64) | meta | Tủ kệ tham số: tự chỉnh, xem 3D ngay, giá hiện ngay, xưởng làm sẵn. | giữ nguyên |
| src/app/layout.tsx | metadata.openGraph.siteName (dòng 65) | meta | ngăn by màumè | giữ nguyên |
| src/app/collection/page.tsx | metadata.title (dòng 22) | meta | Bộ sưu tập | giữ nguyên |
| src/app/collection/page.tsx | metadata.description (dòng 23) | meta | Tủ kệ module thiết kế sẵn theo loại: tủ TV, tủ trang trí, tủ sách, tủ tường, tủ ngăn kéo, tủ giày, tủ đầu giường. Chọn mẫu rồi chỉnh kích thước · màu · cấu hình theo ý bạn. | **Tủ kệ mô-đun thiết kế sẵn theo loại: tủ TV, tủ trang trí, tủ sách, tủ tường, tủ ngăn kéo, tủ giày, tủ đầu giường. Chọn mẫu rồi chỉnh kích thước · màu · cấu hình theo ý bạn.** |
| src/app/collection/[slug]/page.tsx | generateMetadata — fallback title (dòng 36) | meta | Không tìm thấy | giữ nguyên |
| src/app/collection/[slug]/page.tsx | generateMetadata — og.title (dòng 41) | meta | {preset.name} · ngăn by màumè | giữ nguyên |
| src/app/collection/[slug]/page.tsx | productSchema.brand.name (dòng 99) | meta | ngăn by màumè | giữ nguyên |

---

## 11. Tên màu & vật liệu (catalog) — hiển thị cho khách ở swatch/picker

> Tên màu/loại ván là **danh mục sản phẩm** (SKU), không phải câu văn. Pha loan-word kiểu
> "espresso/caramel/teal/booc-đô" là quy ước ngành nội thất, không thuộc phạm vi giọng văn → **giữ nguyên cả mục.**

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/lib/production-catalog.ts | boardTypes (dòng 195) | label | Ván MDF sơn màu | giữ nguyên |
| src/lib/production-catalog.ts | boardTypes (dòng 196) | label | Ván plywood veneer | giữ nguyên |
| src/lib/production-catalog.ts | boardTypes (dòng 199) | label | Plywood phủ melamine 2 mặt (lộ cạnh) | giữ nguyên |
| src/lib/production-catalog.ts | boardTypes (dòng 206) | label | MDF chống ẩm phủ melamine (An Cường) | giữ nguyên |
| src/lib/production-catalog.ts | boardTypes (dòng 213) | label | Ván dăm (MFC) Minh Long phủ melamine | giữ nguyên |
| src/lib/production-catalog.ts | colors (dòng 219-227) | option | MDF Vàng / MDF Cam / MDF Đỏ / MDF Nâu / MDF Xanh lá / MDF Xanh / MDF Xám nhạt / MDF Xám / MDF Đen | giữ nguyên |
| src/lib/production-catalog.ts | colors (dòng 228-230) | option | Veneer Sồi / Veneer Óc chó / Veneer Tần bì | giữ nguyên |
| src/lib/production-catalog.ts | colors (dòng 232-242) | option | PLY+ML Xanh rêu / Đỏ san hô / Xám ấm / Đen espresso / Xanh mint / Xanh dịu / Xanh teal đậm / Caramel / Olive / Xanh navy / Hồng phấn | giữ nguyên |
| src/lib/production-catalog.ts | colors (dòng 244-249) | option | PLY+AC Vàng nghệ / Đen tuyền / Trắng kem / Nâu xám / Xanh mực / Xanh thiên thanh | giữ nguyên |
| src/lib/production-catalog.ts | colors (dòng 252-257) | option | MDF+AC Vàng nghệ / Đen tuyền / Trắng kem / Nâu xám / Xanh mực / Xanh thiên thanh | giữ nguyên |
| src/lib/production-catalog.ts | colors (dòng 261-271) | option | MDF+ML Xanh rêu / Đỏ san hô / Xám ấm / Đen espresso / Xanh mint / Xanh dịu / Xanh teal đậm / Caramel / Olive / Xanh navy / Hồng phấn | giữ nguyên |
| src/lib/production-catalog.ts | colors (dòng 275-291) | option | MFC+ML Xanh rêu / Đỏ san hô / Xám ấm / Đen espresso / Xanh mint / Xanh dịu / Xanh teal đậm / Caramel / Olive / Xanh navy / Hồng phấn / Đen tuyền / Đỏ booc-đô / Trắng kem / Vàng kem 220 | giữ nguyên |
| src/lib/production-catalog.ts | colors (dòng 293-297) | option | MFC+ML Vân gỗ sáng / Vân gỗ đậm / Vân gỗ sồi / Vân gỗ óc chó | giữ nguyên |
| src/configurator/materials.ts | EDGE_BAND_COLORS (dòng 242-260) | option | Đồng màu / Đen / Trắng / Xanh rêu / Đỏ san hô / Xám ấm / Đen espresso / Xanh mint / Xanh dịu / Xanh teal đậm / Caramel / Olive / Xanh navy / Hồng phấn / Đen tuyền / Đỏ booc-đô / Trắng kem / Vàng kem 220 | giữ nguyên |

---

## 12. [ADMIN] Chỉ hiện ở chế độ admin (`isAdmin`) — KHÔNG phải copy hướng khách → giữ nguyên cả mục

> Gate `{isAdmin && …}` (Configurator.tsx dòng 2290, YConfigurator.tsx dòng 738). Nhãn công cụ nội bộ, ngoài
> phạm vi giọng khách. Giữ nguyên toàn bộ; chỉ liệt kê để tham khảo.

| File | Vị trí | Loại | Text hiện tại | Đề xuất |
|------|--------|------|----------------|---------|
| src/configurator/admin-detail-panels.tsx | PricePanel — heading (dòng 42) | heading (admin) | Giá | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 44) | label (admin) | Giá bán tạm tính | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 48) | label (admin) | Lãi gộp | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 49) | label (admin) | (chưa gồm vận chuyển) | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 58) | label (admin) | Đơn giá / m² mặt đứng | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 65) | body (admin) | Mặt đứng {…}m × {…}m = {…} m² | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 79) | label (admin) | Hệ số lãi (khung) | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 84) | label (admin) | Phụ kiện (lãi) | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 100) | label (admin) | · {line.detail} · giá vốn, không tính lãi | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 107) | label (admin) | Công mỗi đơn | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | PricePanel (dòng 112) | label (admin) | Tổng giá vốn | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | CutlistPanel — heading (dòng 131) | heading (admin) | Bảng cắt cho xưởng | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | CutlistPanel (dòng 134-136) | body (admin) | {n} tấm · {…} m² · {…} kg · không dán cạnh | giữ nguyên |
| src/configurator/admin-detail-panels.tsx | CutlistPanel — cột (dòng 141-147) | label (admin) | Tấm / Vật liệu / SL / Dài / Rộng / Dày / Cân | giữ nguyên |
| src/configurator/Configurator.tsx | SavePresetButton — alert (dòng 3326-3327) | body (admin) | Phase A: Đã lưu draft vào localStorage. Phase C sẽ wire tới maume API để push lên Cloudflare KV và sync với ke.maume.asia. | giữ nguyên |
| src/configurator/Configurator.tsx | SavePresetButton — nút saved (dòng 3355) | button (admin) | ✓ Đã lưu preset (xem trên /collection) | giữ nguyên |
| src/configurator/Configurator.tsx | SavePresetButton — nút error (dòng 3357) | button (admin) | ✕ Lỗi lưu — xem console | giữ nguyên |
| src/configurator/Configurator.tsx | SavePresetButton — nút saving (dòng 3359) | button (admin) | ⏳ Đang lưu... | giữ nguyên |
| src/configurator/Configurator.tsx | SavePresetButton — nút idle (dòng 3360) | button (admin) | 💾 Lưu thành preset (admin) | giữ nguyên |
| src/configurator/Configurator.tsx | SavePresetButton — helper (dòng 3363-3364) | body (admin) | Admin only. Cấu hình hiện tại sẽ được lưu thành preset trên ke.maume.asia cho khách xem ở /collection. | giữ nguyên |
| src/configurator/Configurator.tsx | NestingButton (dòng 3392) | button (admin) | ▦ Xem nesting (sơ đồ xếp tấm) | giữ nguyên |
| src/configurator/Configurator.tsx | NestingModal — số phần (dòng 3407) | body (admin) | {halves} nửa / {quarters} phần tư | giữ nguyên |
| src/configurator/Configurator.tsx | NestingModal — heading (dòng 3421) | heading (admin) | Sơ đồ xếp tấm (nesting) | giữ nguyên |
| src/configurator/Configurator.tsx | NestingModal — thống kê (dòng 3423-3425) | body (admin) | {n} khổ ván · tận dụng TB {pct} · ✂ cắt: {cutNote} · ⚠ {n} tấm không vừa khổ | giữ nguyên |
| src/configurator/Configurator.tsx | NestingModal — nút Đóng aria-label (dòng 3431) | tooltip (admin) | Đóng | giữ nguyên |
| src/configurator/Configurator.tsx | NestingModal — empty (dòng 3439) | body (admin) | Chưa có khổ ván trong catalog (hoặc tủ chưa có tấm để xếp). | giữ nguyên |
| src/configurator/Configurator.tsx | NestingModal — tấm không xếp (dòng 3449) | body (admin) | Tấm KHÔNG xếp được (lớn hơn mọi khổ ván): | giữ nguyên |
| src/configurator/Configurator.tsx | NestingBoardSvg — nhãn khổ (dòng 3471-3472) | body (admin) | Khổ #{n}: {materialId} · {thicknessMm}mm · {L}×{W}mm | giữ nguyên |
| src/configurator/Configurator.tsx | NestingBoardSvg — phần khổ (dòng 3475) | body (admin) | ✂✂ phần tư / ✂ nửa khổ | giữ nguyên |
| src/configurator/Configurator.tsx | NestingBoardSvg — số tấm (dòng 3478) | body (admin) | · {n} tấm · tận dụng {pct}% | giữ nguyên |
| src/configurator/Configurator.tsx | NestingBoardSvg — title tấm (dòng 3505-3506) | tooltip (admin) | {partLabel} — {L}×{W}mm (xoay 90°) | giữ nguyên |
| src/configurator/YConfigurator.tsx | Props onSavePreset doc (dòng 376) | body (admin) | Lưu cấu hình hiện tại thành preset. Có → hiện nút "Lưu preset". | giữ nguyên |
| src/configurator/YConfigurator.tsx | Loại tay nắm — heading (dòng 725) | heading (admin) | Loại tay nắm | giữ nguyên |
| src/configurator/ui/index.tsx | SavePresetButton (dòng 210) | button (admin) | ✓ Đã lưu | giữ nguyên |
| src/configurator/ui/index.tsx | SavePresetButton (dòng 210) | button (admin) | ✕ Lỗi lưu | giữ nguyên |
| src/configurator/ui/index.tsx | SavePresetButton (dòng 210) | button (admin) | ⏳ Đang lưu… | giữ nguyên |
| src/configurator/ui/index.tsx | SavePresetButton (dòng 210) | button (admin) | 💾 Lưu preset | giữ nguyên |
| src/configurator/pricing.ts | computePrice — dòng giá (dòng 228) | label (admin) | Dán cạnh {band.label} | giữ nguyên |
| src/configurator/pricing.ts | computePrice — dòng giá (dòng 250) | label (admin) | Dán cạnh đồng màu | giữ nguyên |
| src/configurator/pricing.ts | computePrice — dòng giá (dòng 297) | label (admin) | Hao hụt ván ({%}%) | giữ nguyên |
| src/configurator/pricing.ts | computePrice — dòng giá (dòng 308) | label (admin) | Nhân công (theo loại ô) · {n} ô | giữ nguyên |
| src/configurator/pricing.ts | computePrice — cảnh báo (dòng 310) | label (admin) | ⚠ Chưa điền công tủ y — Vào Admin · Giá & lãi để điền | giữ nguyên |
| src/configurator/pricing.ts | computePrice — dòng giá (dòng 324) | label (admin) | Hao hụt cắt ván | giữ nguyên |
| src/configurator/pricing.ts | computePrice — dòng giá (dòng 339) | label (admin) | Nhân công cắt ván ({n} tấm: …) | giữ nguyên |
| src/configurator/cutlist.ts | materialNote (dòng 21) | label (admin) | Cạnh lộ — không dán nẹp (xưởng giữ raw plywood) | giữ nguyên |
| src/lib/production-catalog.ts | hardware (dòng 300-364) | label (admin) | Bản lề giảm chấn / Tay nắm tròn (khoét lỗ Ø35) / Tay nắm strip đen (edge profile) / Tay nắm bar đen (căn giữa) / Ray âm EPC Plus 270–400mm (tủ sâu 300–450) / Chân tủ / Connector 2-in-1 (chốt Ø8 + PAT) / Chốt lò xo tấm hậu Ø5×25 | giữ nguyên |
| src/lib/production-catalog.ts | boards — khổ ván (dòng 388-397) | label (admin) | MDF sơn / Plywood veneer / Plywood melamine / MDF chống ẩm melamine / MFC melamine — 1220×2440, 9–18mm | giữ nguyên |

---

## Tóm tắt thay đổi (vì sao)

Toàn site có **16 dòng** đề xuất sửa; phần còn lại giữ nguyên vì đã đúng giọng.

### A. Vi phạm CẤM cứng (bắt buộc đổi)
| Vị trí | Cũ → Mới | Lý do |
|--------|----------|-------|
| CategoryList — heading (mục 2) | Khám phá theo loại tủ → **Chọn theo loại tủ** | "Khám phá" là từ mở đầu CẤM (mục 3 file giọng) |
| Footer — nav heading (mục 3) | Khám phá → **Xem nhanh** | Như trên |

### B. Việt hoá chữ chen tiếng Anh (giọng ngăn ưu tiên tiếng Việt cụ thể)
| Vị trí | Cũ → Mới |
|--------|----------|
| ValueProps — tiêu đề (mục 2) | 3D realtime → **Xem 3D ngay** |
| ValueProps — tiêu đề (mục 2) | cut-list xưởng → **bảng cắt xưởng** *(đồng bộ với body đã dùng "bảng cắt")* |
| HowItWorks — body bước 1 (mục 2) | …mở Configurator… → …**mở trình dựng**… *(đồng bộ với "trình dựng 3D" ở loading)* |
| Collection — intro (mục 4) | …click vào mẫu để mở Configurator… → …**bấm vào mẫu để mở trình dựng**… |
| Footer — mantra (mục 3) | Render 3D realtime → **Dựng 3D ngay** |
| Footer — mantra (mục 3) | …· Since 2026 → …· **Từ 2026** |
| Footer — nav (mục 3) | Spec gỗ & vật liệu → **Gỗ & vật liệu** |
| Footer — nav (mục 3) | Brand mẹ: màumè → **Thương hiệu mẹ: màumè** |
| Configurator — tooltip (mục 6) | …tách block lớn… → …**tách khối lớn**… |
| Order dialog — placeholder (mục 8) | Deadline, yêu cầu đặc biệt… → **Ngày cần giao, yêu cầu đặc biệt…** |
| Meta collection (mục 10) | Tủ kệ module… → **Tủ kệ mô-đun…** *(đồng bộ với filter UI "Mô-đun")* |

### C. Bỏ giọng dịch sượng ở dialog đặt hàng (mục 8) — viết như người làm nghề nói
| Cũ → Mới | Lý do |
|----------|-------|
| Vui lòng nhập tên và số điện thoại → **Cho mình xin tên và số điện thoại.** | "Vui lòng…" là kiểu dịch *please*; câu mới gần lời thợ nói |
| Lỗi không xác định → **Có lỗi — thử lại giúp mình nhé.** | "Lỗi không xác định" = *unknown error* dịch máy |
| Bằng cách gửi, bạn đồng ý maumè liên hệ qua SĐT để xác nhận đơn. → **Gửi đơn là bạn đồng ý cho maumè gọi qua SĐT để xác nhận.** | "Bằng cách gửi…" = *by submitting* dịch nguyên; câu mới ngắn & thuận |

### D. Giữ nguyên có chủ ý (không phải bỏ sót)
- **Thuật ngữ thương hiệu** `tham số hoá` (×2): đuôi *-hoá* thuộc nhóm "dùng dè", nhưng đây là tên tính năng
  lõi (parametric) chưa có từ thuần Việt gọn hơn. Để nguyên cho nhất quán; nếu muốn bỏ *-hoá* có thể cân nhắc
  "tự chỉnh tham số" — **cần bạn duyệt** vì đổi cả định danh thương hiệu.
- **Tag marquee** `cut-list xưởng`, `custom kích thước`: là chữ chạy trang trí, cố ý pha EN tạo nhịp; khác với
  tiêu đề ValueProps (đã Việt hoá). Để nguyên — nếu muốn đồng bộ tuyệt đối thì đổi `cut-list xưởng → bảng cắt
  xưởng`, `custom kích thước → đóng theo số đo`.
- **Tên màu/vật liệu** (mục 11) & **nhãn admin** (mục 12): ngoài phạm vi giọng văn khách.
- **Wordmark** `ngăn`, `\<Ngan/\>`, `by màumè`, `Mọi quyền được bảo lưu`: định danh/pháp lý quy ước — giữ.

### Ghi chú phạm vi
- File này **chỉ đề xuất**; chưa đổi 1 dòng code nào. Mỗi đề xuất cần bạn duyệt trước khi sửa vào component
  (theo `feedback_approval_before_code`).
- Tên preset (Compact/Studio/Loft/Tall/Wide) & mô tả mẫu là **dữ liệu KV**, không nằm trong code → muốn rà
  giọng cho chúng phải sửa ở Cloudflare KV, không phải ở repo này.
