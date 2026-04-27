"""One-shot encoder: dedupe + crop + WebP for Starburst PNG sequence."""
from PIL import Image, ImageChops
import os, glob, sys, json

sys.stdout.reconfigure(encoding="utf-8")
SRC_DIR = "Assets/Starburst PNG Sequence"
OUT_DIR = "Assets/Starburst PNG Sequence WebP"
BBOX = (33, 456, 1021, 1524)  # union bbox of all source frames - shared sprite center
DOWNSCALE = 0.5  # output frame is 50% of bbox dimensions; setDisplaySize compensates at runtime

src = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
if not src:
    raise SystemExit(f"No source PNGs in {SRC_DIR}")

os.makedirs(OUT_DIR, exist_ok=True)
for f in glob.glob(os.path.join(OUT_DIR, "*.webp")):
    os.remove(f)

prev = None
kept = []
for i, p in enumerate(src):
    im = Image.open(p).convert("RGBA")
    idx = i + 1
    if idx == 1:
        prev = im
        continue
    if prev is not None and ImageChops.difference(im, prev).getbbox() is None:
        prev = im
        continue
    kept.append((p, idx, im))
    prev = im

total = 0
src_indices = []
size = None
for out_i, (p, src_idx, im) in enumerate(kept):
    cropped = im.crop(BBOX)
    if DOWNSCALE != 1.0:
        nw = max(1, int(round(cropped.width * DOWNSCALE)))
        nh = max(1, int(round(cropped.height * DOWNSCALE)))
        cropped = cropped.resize((nw, nh), Image.LANCZOS)
    out_path = os.path.join(OUT_DIR, f"sb_{out_i:02d}.webp")
    cropped.save(out_path, "WEBP", quality=75, method=6)
    total += os.path.getsize(out_path)
    src_indices.append(src_idx)
    size = cropped.size

print(f"Unique frames kept: {len(kept)} / {len(src)}")
print(f"Frame size: {size}")
print(f"Total WebP size: {total/1024:.1f} KB")
print(f"Source frame indices (1-based, original 30fps timeline):")
print(json.dumps(src_indices))
