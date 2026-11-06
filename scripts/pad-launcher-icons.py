from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "android/app/src/main/res/drawable-nodpi/vito_logo.png"
logo = Image.open(source).convert("RGBA")

sizes = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

for density, size in sizes.items():
    canvas = Image.new("RGBA", (size, size), "white")
    logo_size = round(size * 0.56)
    resized = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    left = (size - logo_size) // 2
    top = (size - logo_size) // 2
    canvas.alpha_composite(resized, (left, top))
    for name in ("ic_launcher.png", "ic_launcher_round.png"):
        output = root / f"android/app/src/main/res/mipmap-{density}/{name}"
        canvas.save(output, optimize=True)
