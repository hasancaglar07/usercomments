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
        
        # Filter out tiny images (avatars/icons usually < 200px)
        if width < 250 and height < 250:
            return None

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
            # Change to UserReview.net if it was the default lowercase
            if watermark_text == "userreview.net":
                watermark_text = "UserReview.net"
                
            img = img.convert("RGBA")
            overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
            draw = ImageDraw.Draw(overlay)
            
            # Dynamic font size based on width (roughly 1/12th of width)
            font_size = max(20, int(img.width / 12))
            try:
                # Common on Windows
                font = ImageFont.truetype("arial.ttf", font_size)
            except Exception:
                # Fallback to default if arial is not found
                font = ImageFont.load_default()
            
            # Center coordinates
            w, h = img.size
            try:
                # Modern Pillow (v9.2.0+)
                bbox = draw.textbbox((0, 0), watermark_text, font=font)
                tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            except AttributeError:
                # Compatibility for older Pillow
                tw, th = draw.textsize(watermark_text, font=font)
                
            x = (w - tw) // 2
            y = (h - th) // 2
            
            # Semi-transparent white (alpha level 60-80 is subtle but readable)
            draw.text((x, y), watermark_text, fill=(255, 255, 255, 70), font=font)
            
            img = Image.alpha_composite(img, overlay)
            img = img.convert("RGB")

        output = BytesIO()
        img.save(output, format="WEBP", quality=webp_quality, method=6)
        return output.getvalue()
