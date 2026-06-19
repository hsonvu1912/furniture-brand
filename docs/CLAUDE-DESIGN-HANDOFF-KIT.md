# KÊ × Claude Design — Handoff Kit

> Bộ tài liệu để redesign UI + branding cho **ke.maume.asia** bằng **claude.ai/design**,
> rồi đẩy ngược về repo `furniture-brand` qua Claude Code.
>
> **Hướng đã chốt:** Khám phá 3–4 concept rồi chọn · **Phạm vi:** marketing pages + vỏ trang `/design` (CHỪA canvas 3D + logic).
> Soạn ngày 2026-05-31.

---

## 0. Dùng kit này thế nào (3 bước)

1. **Mở** https://claude.ai/design → New design. (Cần gói Pro/Max/Team/Enterprise.)
2. **Dán** lần lượt: khối **§1 BRAND BRIEF** → rồi khối **§2 KICKOFF PROMPT**. Để Claude Design dựng 4 concept.
3. Chọn 1 concept → dùng **§3** để đào sâu & nhân ra các trang → khi ưng, tạo **handoff bundle** (xem **§6**) và đưa lại cho Claude Code.

> Mẹo: mỗi khối nằm trong ô code bên dưới — bấm nút copy ở góc ô là lấy nguyên văn.

---

## 1. BRAND BRIEF — (dán khối này vào Claude Design đầu tiên)

```
# BRAND BRIEF — KÊ. by màumè

## Thương hiệu
KÊ. by màumè là thương hiệu nội thất parametric Việt Nam (sub-brand của Màu Mè), ra mắt 2026.
Khách kéo slider trên web → thấy chiếc kệ/tủ 3D thay đổi real-time → ra giá + bản cắt (cut-list)
gửi thẳng cho xưởng mộc. Tinh thần: "Không gian nào cũng khác nhau, nên không chiếc tủ nào nên
giống nhau." Bán điểm: tùy chỉnh đến từng milimet, dựng hình 3D tức thì, sản xuất tại Việt Nam,
sai số bằng 0.

## Sản phẩm
- Hệ kệ/tủ plywood 18mm phủ màu trơn 2 mặt (không dán cạnh), cũng có MDF/melamine.
- 5 mẫu khởi điểm khách có thể custom tiếp:
  • Compact — ₫3.79M — studio < 30m²
  • Studio  — ₫7.14M — phòng khách 30–50m²
  • Loft    — ₫14.69M — phòng ngủ master / phòng thay đồ
  • Tall    — ₫5.03M — hốc gầm cầu thang
  • Wide    — ₫7.02M — kệ TV 2.4m
- Lọc theo không gian: phòng khách, phòng nhỏ, phòng ngủ, gầm cầu thang, kệ TV.

## Khách hàng
Người trẻ đô thị VN (25–40), ở căn hộ/nhà phố diện tích vừa–nhỏ, thích đồ custom vừa khít không
gian, gu hiện đại, quen mua online, nhạy cảm với thẩm mỹ và giá hợp lý.

## Tính cách thương hiệu (voice)
Tự tin & chính xác (ngôn ngữ kỹ thuật "đo đến từng mm") nhưng ấm áp, đời thường, có gu —
đồ cho ngôi nhà thật, không phô trương. Song ngữ: nội dung chính tiếng Việt.

## Hiện trạng thiết kế (để biết cái gì đang có — có thể giữ hoặc thay)
- Nền cream ấm #F7F6F2 · Accent (kiêm màu chữ mặc định) cam-đỏ #F74C25 · Mực #1A1A1A · Kẻ #E3DFD2
- Font: Cabinet Grotesk (tiêu đề) + Be Vietnam Pro (thân, tiếng Việt)
- Chữ ký: gradient pastel 5 màu — hiện chỉ dùng cho logo + dải marquee chạy
- Phong cách: editorial, typography khổng lồ (lấy cảm hứng regrocery.co)

## Ràng buộc kỹ thuật (BẮT BUỘC)
- Web thật build bằng Next.js + Tailwind v4 (design token là CSS variables) + react-three-fiber.
- KHÔNG đụng vào canvas 3D real-time và logic tính giá/cut-list ở trang /design.
  Chỉ được redesign phần GIAO DIỆN/VỎ bao quanh (header, bố cục, panel điều khiển, nút, ô giá).
- Output cuối phải dịch được sang: design token (CSS variables) + component Tailwind. Tránh hiệu ứng
  không thể hiện thực bằng web tĩnh.
```

---

## 2. KICKOFF PROMPT — (dán tiếp, để dựng 4 concept)

```
Hãy redesign UI + branding cho KÊ dựa trên brand brief ở trên.

Trước tiên, dùng công cụ WEB CAPTURE để chụp/hút giao diện hiện tại từ ke.maume.asia
(trang chủ, /collection, và /design) làm điểm xuất phát — mình muốn giữ cấu trúc thông tin,
chỉ làm mới phong cách.

Mình muốn xem 4 CONCEPT ĐỐI LẬP cho trang chủ trước (mỗi concept là 1 art-direction riêng:
bảng màu + cặp font + cách dùng ảnh + tinh thần layout). Gợi ý 4 hướng để bạn triển khai:

1. SCANDINAVIAN MINIMAL+ : nhiều khoảng trắng, gỗ tự nhiên, typography thanh mảnh, tối giản
   cao cấp. Nâng cấp tinh thần hiện tại nhưng tinh khiết hơn.
2. ẤM THỦ CÔNG (WARM CRAFT) : tông đất/giấy kraft, texture gỗ plywood, cảm giác xưởng mộc Việt,
   gần gũi, thủ công, đáng tin.
3. HI-TECH PARAMETRIC : đậm chất kỹ thuật — lưới grid, mono/technical font, đường nét bản vẽ,
   nhấn mạnh "chính xác đến mm", có thể dark mode. Tôn vinh chính cái configurator.
4. EDITORIAL BOLD : typography khổng lồ, 1 màu accent mạnh, layout kiểu tạp chí, gây ấn tượng
   ngay (kế thừa DNA hiện tại nhưng đẩy xa hơn).

Với mỗi concept, cho mình: hero, 1 section "5 mẫu", 1 section "cách hoạt động" (kéo slider → 3D
→ giá), và footer. Trình bày 4 concept cạnh nhau để mình so sánh. Chưa cần làm các trang khác.
```

---

## 3. SAU KHI CHỌN CONCEPT — prompt đào sâu & nhân ra các trang

Chọn xong 1 trong 4, dán lần lượt (sửa `[X]` thành tên concept anh chọn):

```
Mình chọn concept [X]. Hãy:
1) Hoàn thiện trang chủ theo concept này (đủ mọi section).
2) Chốt DESIGN SYSTEM: bảng màu (hex), cặp font + thang cỡ chữ, spacing scale, bo góc, style nút,
   style card, style input. Xuất ra dạng danh sách design token (CSS variables) để dev áp được.
3) Áp concept này sang các trang còn lại, mỗi trang 1 màn:
   - /collection  (lưới 5 mẫu + thanh lọc theo không gian)
   - /collection/[slug]  (chi tiết 1 mẫu: gallery, mô tả, giá, nút "Tùy chỉnh mẫu này")
   - Contact
   - Header + Footer dùng chung
4) VỎ trang /design: chỉ redesign phần khung quanh khu 3D — thanh panel điều khiển (slider/nút),
   ô hiển thị giá, nút "Đặt làm", bố cục desktop & mobile. ĐỂ TRỐNG vùng canvas 3D (đánh dấu
   placeholder "3D viewport — giữ nguyên"), không thiết kế lại nội dung 3D.
5) Kiểm tra responsive mobile cho tất cả.
```

Mẹo chỉnh trực quan trong Claude Design: **comment inline** lên từng khối · **sửa text trực tiếp** · kéo **adjustment knobs** (spacing/màu/layout). Ưng 1 thay đổi → bảo *"apply across the full design"*.

---

## 4. WEB-CAPTURE CHECKLIST (chụp gì từ ke.maume.asia)

Claude Design có nút web-capture sẵn — hút lần lượt:

- [ ] Trang chủ — full (hero → footer)
- [ ] `/collection` — lưới sản phẩm + thanh lọc
- [ ] `/collection/[slug]` — 1 trang chi tiết bất kỳ
- [ ] `/design` — chụp để Claude Design thấy bố cục panel + vùng 3D (chỉ để tham chiếu vỏ)
- [ ] Header & Footer
- [ ] Logo KÊ + dải marquee gradient (nếu muốn giữ làm chữ ký)

> Muốn em chụp sẵn bộ "ảnh before" (desktop + mobile) để đính kèm brief / so sánh after? Bảo em.

---

## 5. GUARDRAILS — tuyệt đối giữ (nhắc lại cho chắc)

| ✅ Được redesign | ⛔ KHÔNG đụng |
|---|---|
| Bảng màu, font, spacing, token | Logic configurator 3D (`src/configurator/`) |
| Mọi marketing page + component | Engine react-three-fiber / scene 3D |
| Header, Footer, nút, card, input | Tính giá `pricing.ts`, cut-list `cutlist.ts` |
| **Vỏ** trang /design (panel, ô giá, nút) | Data flow Google Sheets, API `/api/order` |
| Logo / marquee (tùy chọn) | Vùng canvas 3D bên trong trang /design |

---

## 6. HANDOFF về Claude Code (bước cuối, làm trong session Claude Code này)

1. Trong Claude Design, khi đã ưng: tạo **handoff bundle** (hoặc export HTML + danh sách design token).
2. Quay lại Claude Code, nói: *"Áp design mới từ Claude Design vào repo furniture-brand"* và dán/đính bundle.
3. Claude Code sẽ:
   - Cập nhật `src/app/globals.css` (design token mới) trước.
   - Sửa giao diện từng component, **không** chạm logic/3D/data flow.
   - Build **local** → anh xem preview → **duyệt rồi mới deploy** Cloudflare.
   - Giữ SEO + không làm vỡ UI hiện có (theo bộ rule đã thống nhất).
```
Lệnh dành cho Claude Code (mẫu):
"Đọc docs/CLAUDE-DESIGN-HANDOFF-KIT.md. Áp handoff bundle đính kèm vào furniture-brand
theo đúng GUARDRAILS §5. Chỉ sửa token + component UI, build local cho tôi xem trước."
```
