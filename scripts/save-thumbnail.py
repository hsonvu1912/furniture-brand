"""save-thumbnail.py — decode base64 PNG từ Claude preview eval result vào file.
Usage: python3 save-thumbnail.py <result_file> <slug>
"""
import base64
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: save-thumbnail.py <result_file> <slug>", file=sys.stderr)
    sys.exit(1)

result_file = sys.argv[1]
slug = sys.argv[2]

data = Path(result_file).read_text().strip().strip('"')
out_path = Path(__file__).parent.parent / "public" / "presets" / f"{slug}.png"
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_bytes(base64.b64decode(data))
print(f"saved {out_path} ({out_path.stat().st_size} bytes)")
