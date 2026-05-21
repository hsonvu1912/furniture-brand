"""composite-thumbnails.py — biến raw transparent PNG (Three.js screenshot mode)
thành thumbnail product-grade với:
  - Crop tight bounding box (loại bỏ whitespace)
  - Background cream #FDFBF7 (đồng bộ page bg KÊ)
  - Drop shadow Gaussian blur dưới tủ (grounded feel)
  - Resize fit 4:5 aspect ratio canvas (1200×1500)
  - Place center-bottom (60% từ top) cho composition đẹp

Usage: python3 composite-thumbnails.py
Input:  public/presets/<slug>_raw.png  (1600×2000 RGBA)
Output: public/presets/<slug>.png       (1200×1500 RGB)
"""

from PIL import Image, ImageFilter
from pathlib import Path

ROOT = Path(__file__).parent.parent
RAW_DIR = ROOT / "public" / "presets"

SLUGS = ["compact", "studio", "loft", "tall", "wide"]
CANVAS_W, CANVAS_H = 1200, 1500  # 4:5 aspect ratio
BG_COLOR = (253, 251, 247)  # #FDFBF7 cream
SHADOW_COLOR = (0, 0, 0, 60)  # rgba soft black
SHADOW_BLUR_RADIUS = 25
PADDING_RATIO_W = 0.78  # tủ chiếm tối đa 78% width canvas
PADDING_RATIO_H = 0.85  # 85% height
VERTICAL_ANCHOR = 0.62  # 62% từ top — tủ "grounded" hơn center


def create_thumbnail(slug: str) -> bool:
    raw_path = RAW_DIR / f"{slug}_raw.png"
    if not raw_path.exists():
        print(f"  [skip] {slug}: raw không tồn tại")
        return False

    raw = Image.open(raw_path).convert("RGBA")
    bbox = raw.getbbox()
    if not bbox:
        print(f"  [skip] {slug}: ảnh trống")
        return False

    cropped = raw.crop(bbox)
    cw, ch = cropped.size

    # Fit vào canvas với padding
    max_w = int(CANVAS_W * PADDING_RATIO_W)
    max_h = int(CANVAS_H * PADDING_RATIO_H)
    ratio = min(max_w / cw, max_h / ch)
    new_w, new_h = max(1, int(cw * ratio)), max(1, int(ch * ratio))
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Tạo canvas nền cream
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), BG_COLOR + (255,))

    # Vị trí đặt — center horizontal, anchor vertical
    x = (CANVAS_W - new_w) // 2
    y = int(CANVAS_H * VERTICAL_ANCHOR) - new_h
    y = max(int(CANVAS_H * 0.05), y)  # không vượt mép trên

    # Drop shadow — sao chép alpha channel làm shadow đậm hơn, blur, offset xuống
    alpha = resized.split()[-1]
    shadow_silhouette = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    shadow_silhouette.paste(
        Image.new("RGBA", resized.size, SHADOW_COLOR),
        (x + 8, y + int(new_h * 0.92)),  # offset xuống đáy tủ
        alpha,
    )
    shadow_blurred = shadow_silhouette.filter(ImageFilter.GaussianBlur(SHADOW_BLUR_RADIUS))

    # Composite shadow → tủ
    canvas = Image.alpha_composite(canvas, shadow_blurred)
    canvas.alpha_composite(resized, (x, y))

    # Convert RGBA → RGB (loại alpha channel, save smaller)
    final = Image.new("RGB", canvas.size, BG_COLOR)
    final.paste(canvas.convert("RGB"), (0, 0), canvas.split()[-1])

    out_path = RAW_DIR / f"{slug}.png"
    final.save(out_path, "PNG", optimize=True)
    size_kb = out_path.stat().st_size // 1024
    print(f"  [ok] {slug}.png → {CANVAS_W}×{CANVAS_H} · {size_kb}KB")
    return True


def main():
    print(f"Composite {len(SLUGS)} thumbnail từ raw transparent PNG:\n")
    ok_count = 0
    for slug in SLUGS:
        if create_thumbnail(slug):
            ok_count += 1
    print(f"\n✓ {ok_count}/{len(SLUGS)} done")


if __name__ == "__main__":
    main()
