from PIL import Image
import numpy as np

def process_favicon(input_path, output_path):
    print(f"Processing {input_path}...")
    img = Image.open(input_path).convert("RGBA")
    
    # Convert Image to numpy array
    data = np.array(img)
    
    # Define white threshold (e.g., pixels strictly brighter than 240)
    # R>240 and G>240 and B>240
    r, g, b, a = data.T
    white_areas = (r > 240) & (g > 240) & (b > 240)
    
    # Set alpha to 0 for white areas
    data[..., 3][white_areas.T] = 0
    
    # Create new image from modified data
    img_transparent = Image.fromarray(data)
    
    # Crop to content (remove transparent borders) to make it "bigger"
    bbox = img_transparent.getbbox()
    if bbox:
        img_cropped = img_transparent.crop(bbox)
        print(f"Cropped to {bbox}")
    else:
        img_cropped = img_transparent
        print("No content found to crop")
        
    # Resize to standard favicon sizes if needed, but for now just saving the high res optimized/cropped version
    # keeping it square might be good for favicons?
    # Usually favicons are square. Let's make it square by adding transparent padding if needed, 
    # but the user said "make it bigger", so cropping to edges is best for "visual size".
    # Browsers will scale it down.
    
    # However, if it's not square, it might look squashed in some browsers? 
    # Usually browsers fit it in a square.
    # Let's make it square canvas, centering the cropped image.
    
    w, h = img_cropped.size
    max_dim = max(w, h)
    
    # Create a new square transparent image
    square_img = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
    
    # Paste centered
    offset_x = (max_dim - w) // 2
    offset_y = (max_dim - h) // 2
    square_img.paste(img_cropped, (offset_x, offset_y))
    
    square_img.save(output_path)
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    process_favicon(
        r"C:\Users\ihsan\Desktop\review\apps\web\public\favicon.png",
        r"C:\Users\ihsan\Desktop\review\apps\web\public\favicon.png"
    )
