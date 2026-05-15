# HANDOFF — trạng thái dự án

> Mỗi session cập nhật file này TRƯỚC KHI kết thúc. Session sau đọc để bắt nhịp.

## ✅ Session 1 — Engine nền (XONG)

Đã build:
- Project **Next.js 16.2.6** (App Router, `src/`, Tailwind 4, TypeScript) + **Three.js 0.184** / **react-three-fiber 9.6.1** / **drei 10.7.7**.
- `src/configurator/types.ts` — **HỢP ĐỒNG DNA, ĐÃ KHÓA**: `Parameter`, `Part`, `Hardware`, `ParamValues`, `BuildResult`, `PriceConfig`, `ProductDNA`.
- `src/configurator/materials.ts` — 8 catalog vật liệu (gốc: furniture-designer) + `resolveMaterial()` + `listMaterials()`.
- `src/configurator/renderer.tsx` — `PartMesh` (Part→hộp 3D), `SceneLighting` (ambient + hemisphere + 2 directional), `Ground`.
- `src/configurator/Configurator.tsx` — khung Canvas R3F (camera, `OrbitControls`, shadow PCFShadowMap).
- `src/app/page.tsx` — trang demo render 1 tủ kệ mini cứng (**TẠM THỜI** — S2 thay).
- `ROADMAP.md`, `HANDOFF.md`.

Trạng thái: dev server chạy tốt (port 3462), render 1 tủ kệ 3D có vật liệu + ánh sáng + bóng đổ mềm, xoay được bằng chuột. `tsc --noEmit` pass. Không có lỗi runtime.

## ▶️ Tiếp theo — Session 2: Sản phẩm đầu tiên (tủ kệ)

**Spec sản phẩm đầu — ĐÃ CHỐT với founder (2026-05-16):**
- Vật liệu: **plywood 18mm**, phủ màu trơn (sơn) 2 mặt.
- **KHÔNG dán cạnh** — để lộ cạnh plywood → mọi `Part` set `edgeBanding` tất cả `false`.
- Là **1 hệ tủ kệ LINH HOẠT**: một `dna.ts` duy nhất customize được thành nhiều loại kệ/tủ qua tham số (rộng / cao / sâu, số tầng, số cột, có/không cánh, có/không ngăn kéo, màu). KHÔNG phải 1 thiết kế cố định → `parameters` phải giàu, `build()` phải xử lý nhiều cấu hình.

Việc cần làm:
- Thêm catalog vật liệu **"plywood phủ màu trơn"** vào `materials.ts` (màu trơn: trắng, đen, xám, các màu pastel...) — mở rộng thư viện chung, được phép.
- Viết `products/tu-ke/dna.ts` — `ProductDNA` thật theo spec trên: `parameters` + `build()` sinh `Part[]` + `Hardware[]`. Tham khảo `tylko-demo/index.html` dòng 535+ (`generateFurniture`) cho logic khung / kệ / lưng / cột.
- Viết `src/configurator/pricing.ts` (parts + hardware → giá VND) + `src/configurator/cutlist.ts` (parts + hardware → bảng cắt; bỏ cột dán cạnh vì sản phẩm không dán cạnh).
- Nâng cấp `Configurator.tsx`: nhận `ProductDNA`, render thanh trượt từ `parameters`, gọi `build()` khi tham số đổi, hiện giá + bảng cut-list live.
- Thay `src/app/page.tsx` (demo) bằng trang dùng `products/tu-ke/dna.ts`.
- ✅ Done khi: kéo mọi slider → 3D + giá + cut-list cập nhật đúng.

## ⚠️ Quyết định & lưu ý

- **Part type (đã khóa):** `size:[x,y,z]` + `position` (tâm hộp) cho 3D — hộp THẲNG TRỤC, KHÔNG có `rotation`. Cộng `length_mm/width_mm/thickness_mm` + `grain` + `edgeBanding` cho cut-list. `build()` set cả hai; validator (S3) sẽ kiểm tra khớp.
- **Engine bất biến:** không sửa `src/configurator/` khi làm sản phẩm.
- **Configurator render client-only:** trang nhúng configurator dùng `'use client'` + `next/dynamic(..., { ssr: false })` (Three.js cần API trình duyệt). Đã xác nhận hợp lệ với Next 16.
- **Shadow map:** three 0.184 bỏ `PCFSoftShadowMap` → `Configurator.tsx` truyền `shadows={{ enabled, type: PCFShadowMap }}`.
- **Console noise đã biết (VÔ HẠI):** `THREE.Clock has been deprecated` (~16 dòng mỗi lần tải) — do react-three-fiber 9.6.1 dùng API `THREE.Clock` cũ. KHÔNG phải lỗi, render vẫn đúng, không tích lũy vô hạn. Sẽ hết khi R3F cập nhật. Không cần xử lý.
- Next.js scaffold có `AGENTS.md` ở root: nhắc đọc `node_modules/next/dist/docs/` vì Next 16 có breaking changes so với kiến thức cũ.

## Cách verify hiện trạng

`preview_start` config **"furniture-brand"** (hoặc `pnpm dev`) → mở http://localhost:3462 → thấy 1 tủ kệ 3D (khung sồi, kệ óc chó) xoay được bằng chuột.
