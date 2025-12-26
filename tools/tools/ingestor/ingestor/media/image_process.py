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
            
            # --- Watermark 1: Original Center Watermark ---
            # Font size: roughly 1/12th of width
            font_size_center = max(20, int(img.width / 12))
            try:
                font_center = ImageFont.truetype("arial.ttf", font_size_center)
            except Exception:
                font_center = ImageFont.load_default()

            w, h = img.size
            try:
                bbox_c = draw.textbbox((0, 0), watermark_text, font=font_center)
                tw_c, th_c = bbox_c[2] - bbox_c[0], bbox_c[3] - bbox_c[1]
            except AttributeError:
                tw_c, th_c = draw.textsize(watermark_text, font=font_center)

            xc = (w - tw_c) // 2
            yc = (h - th_c) // 2

            # Semi-transparent white (alpha level 70 is subtle)
            draw.text((xc, yc), watermark_text, fill=(255, 255, 255, 70), font=font_center)


            # --- Watermark 2: Additional Bottom-Right Corner (White BG) ---
            # Font size: smaller, roughly 1/25th of width
            font_size_corner = max(14, int(img.width / 25))
            try:
                font_corner = ImageFont.truetype("arial.ttf", font_size_corner)
            except Exception:
                font_corner = ImageFont.load_default()

            try:
                bbox_cr = draw.textbbox((0, 0), watermark_text, font=font_corner)
                tw_cr, th_cr = bbox_cr[2] - bbox_cr[0], bbox_cr[3] - bbox_cr[1]
            except AttributeError:
                tw_cr, th_cr = draw.textsize(watermark_text, font=font_corner)

            # Position: Bottom Right with margin
            margin_x = 20
            margin_y = 20
            x = w - tw_cr - margin_x
            y = h - th_cr - margin_y

            # Ensure it fits
            if x < 0: x = 10
            if y < 0: y = 10

            # Background box (White with 80% opacity)
            padding = 10
            bg_left = x - padding
            bg_top = y - padding
            bg_right = x + tw_cr + padding
            bg_bottom = y + th_cr + padding

            draw.rectangle(
                [(bg_left, bg_top), (bg_right, bg_bottom)],
                fill=(255, 255, 255, 200) # White background
            )

            # Draw Text (Dark Grey/Black for contrast)
            draw.text((x, y), watermark_text, fill=(30, 30, 30, 255), font=font_corner)
            
            img = Image.alpha_composite(img, overlay)
            img = img.convert("RGB")

        output = BytesIO()
        img.save(output, format="WEBP", quality=webp_quality, method=6)
        return output.getvalue()
