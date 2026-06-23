"""
Render all pages of the PDF to individual PNGs + assemble a 2x3 montage.
Uses PyMuPDF (fitz).
"""
import fitz  # PyMuPDF
import os
from PIL import Image

PDF_PATH   = r"D:\event-ai\presentation\EVENT-AI-Investor-RU.pdf"
OUT_DIR    = r"D:\event-ai\presentation\verify_pages"
MONTAGE    = r"D:\event-ai\presentation\verify_montage.png"

os.makedirs(OUT_DIR, exist_ok=True)

doc = fitz.open(PDF_PATH)
page_paths = []

for i, page in enumerate(doc):
    mat = fitz.Matrix(2.0, 2.0)   # 2x scale => ~2560x1440 per page
    pix = page.get_pixmap(matrix=mat, alpha=False)
    path = os.path.join(OUT_DIR, f"slide_{i+1:02d}.png")
    pix.save(path)
    page_paths.append(path)
    print(f"  Rendered slide {i+1}: {path}")

doc.close()

# Build 2x3 montage
imgs = [Image.open(p) for p in page_paths]
thumb_w, thumb_h = 960, 540
thumbs = [img.resize((thumb_w, thumb_h), Image.LANCZOS) for img in imgs]

cols, rows = 3, 2
montage_w = cols * thumb_w + (cols + 1) * 10
montage_h = rows * thumb_h + (rows + 1) * 10

montage = Image.new("RGB", (montage_w, montage_h), (20, 20, 30))
for idx, thumb in enumerate(thumbs):
    row = idx // cols
    col = idx % cols
    x = 10 + col * (thumb_w + 10)
    y = 10 + row * (thumb_h + 10)
    montage.paste(thumb, (x, y))

montage.save(MONTAGE)
print(f"\nMontage saved: {MONTAGE}")
print(f"Total slides: {len(page_paths)}")
