#!/usr/bin/env python3
"""Additional failure-mode fixtures for Program 144, Phase 11.

Program 143 covered unreadable, encrypted, corrupt, blank and low-quality
material. These cover the three conditions it did not: a page rotated in the
scanner, a production that is missing pages, and handwriting OCR cannot read.
"""

import json
import os
import random

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = "/tmp/courtaccess-fixtures"
os.makedirs(OUT, exist_ok=True)
random.seed(20260806)
W, H = LETTER


def _font(size=30):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


BODY = [
    "OAKLAND POLICE DEPARTMENT — SUPPLEMENTAL REPORT",
    "Report Number: 26-114872",
    "",
    "On 03/14/2026 I responded to 1450 Foothill Boulevard and contacted the",
    "reporting party, who stated she observed two subjects near the rear gate",
    "approximately ten minutes before officers arrived.",
    "",
    "The reporting party declined to provide a recorded statement.",
]

# ---------------------------------------------------------------------------
# 1. A page rotated 90 degrees in the scanner
# ---------------------------------------------------------------------------

def make_rotated_scan():
    img = Image.new("L", (1700, 2200), 255)
    d = ImageDraw.Draw(img)
    f = _font(34)
    y = 140
    for line in BODY:
        d.text((120, y), line, fill=20, font=f)
        y += 60
    # Rotate the whole page as a flatbed scanner would if fed sideways.
    rotated = img.rotate(90, expand=True)
    rotated.convert("RGB").save(os.path.join(OUT, "rotated-page-scan.png"))
    return "rotated-page-scan.png"


# ---------------------------------------------------------------------------
# 2. A production that is missing pages
#
# The footer declares a ten-page document; only four pages are present, and
# the Bates numbers jump. Partial productions are common and consequential.
# ---------------------------------------------------------------------------

def make_missing_pages():
    path = os.path.join(OUT, "missing-pages-production.pdf")
    c = canvas.Canvas(path, pagesize=LETTER)
    c.setTitle("Discovery production with pages withheld")
    present = [1, 2, 7, 10]
    for pg in present:
        y = H - 72
        c.setFont("Helvetica-Bold", 11)
        c.drawString(60, y, f"DISCOVERY PRODUCTION — BATES CA-{pg:06d}")
        y -= 26
        c.setFont("Helvetica", 10)
        for line in BODY:
            c.drawString(60, y, line)
            y -= 15
        c.setFont("Helvetica", 8)
        c.drawString(60, 50, f"Page {pg} of 10")
        c.showPage()
    c.save()
    return "missing-pages-production.pdf", present, 10


# ---------------------------------------------------------------------------
# 3. Handwriting OCR cannot read
# ---------------------------------------------------------------------------

def make_handwriting():
    img = Image.new("L", (1700, 1100), 252)
    d = ImageDraw.Draw(img)
    # Cursive-like strokes: continuous wandering polylines, no letterforms an
    # OCR engine can resolve.
    for row in range(6):
        y0 = 160 + row * 150
        x = 130
        pts = []
        while x < 1550:
            pts.append((x, y0 + random.randint(-26, 26)))
            x += random.randint(8, 18)
        d.line(pts, fill=35, width=4, joint="curve")
        for _ in range(14):
            cx = random.randint(150, 1500)
            d.arc([cx, y0 - 30, cx + 40, y0 + 30], 0, 300, fill=35, width=4)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    img.convert("RGB").save(os.path.join(OUT, "handwritten-statement.png"))
    return "handwritten-statement.png"


rotated = make_rotated_scan()
missing, present_pages, declared_pages = make_missing_pages()
handwriting = make_handwriting()

manifest = {
    "rotated": {"file": rotated, "expectation": "explain-rotated-or-unreadable"},
    "missingPages": {
        "file": missing,
        "presentPages": present_pages,
        "declaredPages": declared_pages,
        "expectation": "explain-missing-pages",
    },
    "handwriting": {"file": handwriting, "expectation": "explain-illegible"},
}
with open(os.path.join(OUT, "FAILURE_MANIFEST.json"), "w") as fh:
    json.dump(manifest, fh, indent=2)

print(f"generated 3 Phase 11 fixtures in {OUT}")
for k, v in manifest.items():
    print(f"  {k:14} {v['file']}")
