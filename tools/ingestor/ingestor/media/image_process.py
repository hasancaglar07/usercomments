from io import BytesIO
from typing import Optional

from PIL import Image, ImageDraw, ImageFont


def process_image(
    image_bytes: bytes,
    crop_right_pct: float,
    max_width: int,
    webp_quality: int,
    watermark_text: Optional[str] = "userreview.net",
) -> Optional[bytes]:
    if not image_bytes:
        return None
    with Image.open(BytesIO(image_bytes)) as img:
        img = img.convert("RGB")
        width, height = img.size
        new_width = int(width * (1 - crop_right_pct))
        if new_width < 1:
            new_width = width
        img = img.crop((0, 0, new_width, height))

        if max_width and new_width > max_width:
            ratio = max_width / float(new_width)
            new_height = int(height * ratio)
            img = img.resize((max_width, new_height), Image.LANCZOS)
        
        # Add watermark
        if watermark_text:
            draw = ImageDraw.Draw(img)
            # Try to load a font, fallback to default
            try:
                font = ImageFont.truetype("arial.ttf", 24)
            except Exception:
                font = ImageFont.load_default()
            
            w, h = img.size
            # Simple text watermark at bottom-right
            margin = 10
            draw.text((w - 150 - margin, h - 30 - margin), watermark_text, fill=(255, 255, 255, 128), font=font)

        output = BytesIO()
        img.save(output, format="WEBP", quality=webp_quality, method=6)
        return output.getvalue()
