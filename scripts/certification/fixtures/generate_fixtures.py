#!/usr/bin/env python3
"""Generate the document, image and media fixtures used by the ingestion,
video/audio and graceful-failure certification suites.

Fixtures are written to /tmp/courtaccess-fixtures and are deliberately varied:
clean text-layer PDFs, scanned-page images needing OCR, deliberately degraded
scans, encrypted PDFs, truncated/corrupt files and unsupported formats.
"""

import os
import subprocess
import zipfile
import random

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from docx import Document
from pypdf import PdfReader, PdfWriter

OUT = "/tmp/courtaccess-fixtures"
os.makedirs(OUT, exist_ok=True)
random.seed(20260805)

W, H = LETTER


def _font(size=20):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Realistic litigation document bodies
# ---------------------------------------------------------------------------

DOCS = {
    "police_report": [
        "OAKLAND POLICE DEPARTMENT — INCIDENT REPORT",
        "Report Number: 26-114872    Date: 03/14/2026    Time: 22:47 hours",
        "Reporting Officer: Sgt. M. Delgado, Badge 4417",
        "",
        "NARRATIVE:",
        "On 03/14/2026 at approximately 2247 hours I was dispatched to 1450 Foothill",
        "Boulevard regarding a report of an armed disturbance. Upon arrival I observed",
        "the suspect, later identified as DOE, JOHN (DOB 04/02/1991), standing near the",
        "northeast corner of the parking lot. Suspect was wearing a dark hooded",
        "sweatshirt and blue jeans.",
        "",
        "I gave verbal commands to show his hands. Suspect complied after the third",
        "command. A search incident to arrest produced a folding knife with a 3.5 inch",
        "blade from the right front pocket. The knife was booked as Item 3 under",
        "property receipt 26-114872-03.",
        "",
        "Witness STEVENS, MARIA stated she observed the suspect arguing with an",
        "unidentified male approximately five minutes before officers arrived. Witness",
        "stated no physical contact occurred.",
        "",
        "Body worn camera was activated at 2248 hours and deactivated at 2331 hours.",
    ],
    "prelim_transcript": [
        "SUPERIOR COURT OF CALIFORNIA, COUNTY OF ALAMEDA",
        "PEOPLE OF THE STATE OF CALIFORNIA v. JOHN DOE",
        "Case No. 26-CR-004417 — PRELIMINARY HEARING",
        "March 28, 2026 — Hon. R. Alvarez, Judge Presiding",
        "",
        "  1  THE COURT: We are on the record in the matter of People versus Doe.",
        "  2  MR. HARLAN: Deputy District Attorney Paul Harlan for the People.",
        "  3  MS. OKONKWO: Deputy Public Defender Amara Okonkwo for Mr. Doe.",
        "  4  THE COURT: The People may call their first witness.",
        "  5  MR. HARLAN: The People call Sergeant Delgado.",
        "  6  THE CLERK: Please raise your right hand.",
        "  7  Q. Sergeant, directing your attention to March 14th, 2026, were you",
        "  8     on duty that evening?",
        "  9  A. Yes, I was working a swing shift, 1500 to 2300 hours.",
        " 10  Q. And what time did you arrive at 1450 Foothill Boulevard?",
        " 11  A. Approximately 2247 hours.",
        " 12  Q. What did you observe upon arrival?",
        " 13  A. I observed the defendant standing near the northeast corner of the",
        " 14     parking lot. He appeared agitated.",
        " 15  MS. OKONKWO: Objection, calls for a conclusion.",
        " 16  THE COURT: Overruled. The witness may answer.",
        " 17  Q. Did you recover any items from the defendant?",
        " 18  A. Yes, a folding knife from his right front pocket.",
    ],
    "medical_report": [
        "HIGHLAND GENERAL HOSPITAL — EMERGENCY DEPARTMENT RECORD",
        "Patient: DOE, JOHN        MRN: 8841207        DOB: 04/02/1991",
        "Date of Service: 03/15/2026    Attending: Dr. L. Marchetti, MD",
        "",
        "CHIEF COMPLAINT: Laceration to left forearm.",
        "",
        "HISTORY OF PRESENT ILLNESS: Patient presents with a 4 cm laceration to the",
        "volar aspect of the left forearm sustained approximately 6 hours prior to",
        "arrival. Patient reports the injury occurred during an altercation.",
        "",
        "PHYSICAL EXAMINATION: Vital signs stable. BP 128/82, HR 88, T 37.1 C.",
        "Left forearm with 4 cm linear laceration, edges well approximated, no active",
        "bleeding. Neurovascularly intact distally. Full range of motion preserved.",
        "",
        "ASSESSMENT AND PLAN: Simple laceration repaired with 6 interrupted 4-0 nylon",
        "sutures under local anesthesia. Tetanus prophylaxis administered. Patient",
        "discharged in stable condition with wound care instructions.",
    ],
    "lab_report": [
        "ALAMEDA COUNTY CRIME LABORATORY — FORENSIC BIOLOGY REPORT",
        "Laboratory Case Number: L-26-00918",
        "Agency Case Number: 26-114872",
        "Date of Report: 04/02/2026    Analyst: K. Rhee, Criminalist II",
        "",
        "ITEMS EXAMINED:",
        "Item 3   Folding knife, black handle, recovered from suspect",
        "Item 7   Reference buccal swab from DOE, JOHN",
        "",
        "RESULTS:",
        "A presumptive test for the presence of blood was performed on Item 3. The",
        "test yielded a negative result. No further DNA analysis was conducted on",
        "Item 3.",
        "",
        "A DNA profile was developed from Item 7 and has been uploaded to the local",
        "DNA index system.",
        "",
        "CONCLUSIONS: No biological material of probative value was identified on",
        "Item 3. This report supersedes the preliminary notes dated 03/22/2026.",
    ],
    "search_warrant": [
        "SEARCH WARRANT AND AFFIDAVIT",
        "County of Alameda — Warrant Number SW-26-0331",
        "",
        "AFFIDAVIT IN SUPPORT OF SEARCH WARRANT",
        "",
        "I, Detective A. Ferreira, Badge 2208, being duly sworn, depose and state:",
        "",
        "1. I am a peace officer employed by the Oakland Police Department and have",
        "   been so employed for eleven years.",
        "",
        "2. Based on the investigation described herein there is probable cause to",
        "   believe that evidence of a violation of Penal Code section 245(a)(1) will",
        "   be found at the premises described in Attachment A.",
        "",
        "3. On March 14, 2026, officers responded to a reported disturbance at 1450",
        "   Foothill Boulevard and detained the suspect.",
        "",
        "PROPERTY TO BE SEIZED: Cellular telephones, digital storage media, clothing",
        "matching the description in the incident report, and any edged weapons.",
        "",
        "SEARCH WARRANT RETURN: Executed 03/18/2026 at 0715 hours. Items seized are",
        "itemized on the attached property receipt.",
    ],
    "dispatch_log": [
        "OAKLAND POLICE DEPARTMENT — CAD / DISPATCH LOG",
        "Incident 26-114872",
        "",
        "22:44:12   CALL RECEIVED     Caller reports subjects arguing, possible weapon",
        "22:44:58   CALL CLASSIFIED   Priority 1 — 245 in progress",
        "22:45:20   UNIT ASSIGNED     3L41 (Delgado) dispatched",
        "22:45:26   UNIT ASSIGNED     3L47 (Okafor) dispatched as cover",
        "22:47:03   UNIT ON SCENE     3L41 arrived 1450 Foothill Blvd",
        "22:47:41   UNIT ON SCENE     3L47 arrived",
        "22:48:02   BWC ACTIVATED     3L41 body worn camera activated",
        "22:52:19   SUBJECT DETAINED  One subject detained without incident",
        "23:05:44   TRANSPORT         Subject transported to North County Jail",
        "23:31:10   BWC DEACTIVATED   3L41 body worn camera deactivated",
        "23:58:02   INCIDENT CLOSED   Report to follow",
    ],
    "expert_report": [
        "EXPERT WITNESS REPORT — USE OF FORCE ANALYSIS",
        "Prepared by: Dr. Helena Voss, Ph.D., Forensic Criminology",
        "Retained by: Office of the Public Defender, County of Alameda",
        "Date: 05/11/2026",
        "",
        "SCOPE OF ENGAGEMENT: I was retained to evaluate whether the force applied",
        "during the March 14, 2026 detention was consistent with generally accepted",
        "law enforcement practices and with the agency's own written policy.",
        "",
        "MATERIALS REVIEWED: Incident report 26-114872; body worn camera footage",
        "(43 minutes); CAD dispatch log; preliminary hearing transcript dated",
        "March 28, 2026; agency Use of Force policy 300 series.",
        "",
        "OPINION 1: The initial detention was supported by reasonable suspicion based",
        "on the dispatch information and the officer's direct observations.",
        "",
        "OPINION 2: The body worn camera activation at 2248 hours occurred after the",
        "initial contact, which is inconsistent with agency policy 300.4 requiring",
        "activation prior to arrival on priority calls.",
    ],
}


def wrap_pages(lines, per_page=34):
    return [lines[i : i + per_page] for i in range(0, len(lines), per_page)] or [[]]


# ---------------------------------------------------------------------------
# PDFs with a real text layer
# ---------------------------------------------------------------------------

def make_text_pdf(path, lines, pages=1, title="Document"):
    c = canvas.Canvas(path, pagesize=LETTER)
    c.setTitle(title)
    c.setAuthor("CourtAccess Certification Fixture")
    c.setSubject("Litigation discovery fixture")
    for p in range(pages):
        y = H - 72
        c.setFont("Helvetica", 10)
        for line in lines:
            c.drawString(60, y, line[:110])
            y -= 14
            if y < 90:
                break
        c.setFont("Helvetica", 8)
        c.drawString(60, 50, f"Page {p + 1} of {pages}")
        c.showPage()
    c.save()


def make_long_pdf(path, pages):
    """A large multi-page PDF with page-unique markers for traceability tests."""
    c = canvas.Canvas(path, pagesize=LETTER)
    c.setTitle(f"{pages}-page discovery production")
    body = DOCS["police_report"]
    for p in range(1, pages + 1):
        c.setFont("Helvetica-Bold", 11)
        c.drawString(60, H - 60, f"DISCOVERY PRODUCTION — BATES CA-{p:06d}")
        c.setFont("Helvetica", 9)
        y = H - 84
        for line in body:
            c.drawString(60, y, line[:110])
            y -= 12
        c.setFont("Helvetica", 8)
        c.drawString(60, 50, f"Page {p} of {pages} | UNIQUE-MARKER-{p:06d}")
        c.showPage()
    c.save()


# ---------------------------------------------------------------------------
# Scanned-page images (no text layer — must go through OCR)
# ---------------------------------------------------------------------------

def render_scan(lines, size=(1700, 2200), font_size=30, quality="clean"):
    img = Image.new("L", size, 255)
    d = ImageDraw.Draw(img)
    f = _font(font_size)
    y = 110
    for line in lines:
        d.text((110, y), line[:88], fill=25, font=f)
        y += int(font_size * 1.65)
        if y > size[1] - 120:
            break

    if quality == "clean":
        return img.convert("RGB")

    if quality == "poor":
        # Heavy blur, low contrast and speckle — emulates a bad fax/scan.
        img = img.rotate(1.1, resample=Image.BICUBIC, fillcolor=255)
        img = img.filter(ImageFilter.GaussianBlur(2.6))
        px = img.load()
        for _ in range(int(size[0] * size[1] * 0.05)):
            x = random.randrange(size[0])
            yy = random.randrange(size[1])
            px[x, yy] = random.randrange(90, 190)
        img = img.point(lambda v: int(150 + (v - 150) * 0.32))
        return img.convert("RGB")

    if quality == "blank":
        return Image.new("RGB", size, (252, 252, 252))

    return img.convert("RGB")


# ---------------------------------------------------------------------------
# Build everything
# ---------------------------------------------------------------------------

manifest = []


def record(name, kind, expectation, note=""):
    manifest.append({"file": name, "kind": kind, "expectation": expectation, "note": note})


# --- Clean text-layer PDFs, one per discovery document type -----------------
pdf_types = {
    "police-report.pdf": ("police_report", 3),
    "supplemental-police-report.pdf": ("police_report", 2),
    "preliminary-hearing-transcript.pdf": ("prelim_transcript", 4),
    "trial-transcript.pdf": ("prelim_transcript", 6),
    "medical-report.pdf": ("medical_report", 2),
    "hospital-records.pdf": ("medical_report", 3),
    "psychological-evaluation.pdf": ("medical_report", 2),
    "laboratory-report.pdf": ("lab_report", 2),
    "dna-report.pdf": ("lab_report", 2),
    "ballistics-report.pdf": ("lab_report", 1),
    "crime-scene-report.pdf": ("police_report", 2),
    "investigator-report.pdf": ("expert_report", 2),
    "search-warrant.pdf": ("search_warrant", 3),
    "search-warrant-affidavit.pdf": ("search_warrant", 2),
    "search-warrant-return.pdf": ("search_warrant", 1),
    "property-receipt.pdf": ("dispatch_log", 1),
    "evidence-log.pdf": ("dispatch_log", 1),
    "chain-of-custody.pdf": ("dispatch_log", 1),
    "dispatch-log.pdf": ("dispatch_log", 1),
    "cad-report.pdf": ("dispatch_log", 1),
    "financial-records.pdf": ("dispatch_log", 2),
    "phone-records.pdf": ("dispatch_log", 2),
    "cell-tower-records.pdf": ("dispatch_log", 2),
    "digital-forensic-report.pdf": ("expert_report", 2),
    "court-filing.pdf": ("search_warrant", 2),
    "expert-report.pdf": ("expert_report", 3),
    "discovery-production.pdf": ("police_report", 5),
}
for fname, (key, pages) in pdf_types.items():
    make_text_pdf(os.path.join(OUT, fname), DOCS[key], pages, fname)
    record(fname, "pdf-text-layer", "extract-text")

# --- Plain text / DOCX ------------------------------------------------------
with open(os.path.join(OUT, "emails.txt"), "w") as fh:
    fh.write(
        "From: m.delgado@oaklandpd.example.gov\n"
        "To: a.ferreira@oaklandpd.example.gov\n"
        "Date: Sat, 15 Mar 2026 08:12:44 -0700\n"
        "Subject: RE: 26-114872 follow up\n\n"
        "Al — the BWC upload for 3L41 finished overnight. Runtime is 43 minutes.\n"
        "The knife went to the lab Friday under L-26-00918. No blood on presumptive.\n\n"
        "-- Mike\n"
    )
record("emails.txt", "txt", "extract-text")

with open(os.path.join(OUT, "text-messages.txt"), "w") as fh:
    fh.write(
        "[2026-03-14 22:31] +1-510-555-0142: where you at\n"
        "[2026-03-14 22:33] +1-510-555-0188: foothill lot, dude is still here\n"
        "[2026-03-14 22:39] +1-510-555-0142: dont do anything stupid\n"
        "[2026-03-14 22:41] +1-510-555-0188: im leaving now\n"
    )
record("text-messages.txt", "txt", "extract-text")

with open(os.path.join(OUT, "social-media-export.txt"), "w") as fh:
    fh.write(
        "platform,post_id,timestamp,author,content\n"
        "instagram,4471,2026-03-14T21:58:00Z,jdoe91,at the lot waiting\n"
        "instagram,4472,2026-03-15T00:14:00Z,jdoe91,long night\n"
    )
record("social-media-export.txt", "txt", "extract-text")

for name, key in (
    ("court-filing.docx", "search_warrant"),
    ("expert-report.docx", "expert_report"),
    ("investigator-report.docx", "police_report"),
):
    d = Document()
    d.add_heading(name.replace(".docx", "").replace("-", " ").title(), level=1)
    for line in DOCS[key]:
        d.add_paragraph(line)
    d.save(os.path.join(OUT, name))
    record(name, "docx", "extract-text")

# --- Scanned images requiring OCR -------------------------------------------
render_scan(DOCS["police_report"]).save(os.path.join(OUT, "scanned-police-report.png"))
record("scanned-police-report.png", "image-scan", "ocr-text")

render_scan(DOCS["medical_report"]).save(
    os.path.join(OUT, "scanned-medical-report.jpg"), quality=92
)
record("scanned-medical-report.jpg", "image-scan", "ocr-text")

render_scan(DOCS["lab_report"]).save(os.path.join(OUT, "scanned-lab-report.tiff"), format="TIFF")
record("scanned-lab-report.tiff", "image-scan", "ocr-text")

render_scan(DOCS["dispatch_log"], quality="poor").save(
    os.path.join(OUT, "poor-quality-scan.png")
)
record("poor-quality-scan.png", "image-scan-degraded", "low-confidence-warning",
       "heavily blurred, speckled, low contrast")

render_scan([], quality="blank").save(os.path.join(OUT, "blank-page-scan.png"))
record("blank-page-scan.png", "image-scan-blank", "no-text-explained")

# Crime scene photo — a photograph, not a document, so no text to extract.
photo = Image.new("RGB", (1600, 1200), (58, 64, 70))
pd_ = ImageDraw.Draw(photo)
pd_.rectangle([300, 500, 1300, 900], fill=(96, 88, 78))
pd_.ellipse([700, 620, 900, 780], fill=(140, 40, 35))
photo.save(os.path.join(OUT, "crime-scene-photo.jpeg"), quality=88)
record("crime-scene-photo.jpeg", "photo", "no-text-explained")

# --- ZIP discovery production -----------------------------------------------
with zipfile.ZipFile(os.path.join(OUT, "discovery-production.zip"), "w") as z:
    for n in ("police-report.pdf", "dispatch-log.pdf", "emails.txt"):
        z.write(os.path.join(OUT, n), n)
record("discovery-production.zip", "zip", "container-handled")

# --- Large PDF for stress ----------------------------------------------------
make_long_pdf(os.path.join(OUT, "large-2000-page.pdf"), 2000)
record("large-2000-page.pdf", "pdf-large", "extract-text", "2000 pages")

# --- Failure-mode fixtures ---------------------------------------------------
# Password protected PDF
reader = PdfReader(os.path.join(OUT, "police-report.pdf"))
writer = PdfWriter()
for pg in reader.pages:
    writer.add_page(pg)
writer.encrypt("CorrectHorseBattery9")
with open(os.path.join(OUT, "encrypted.pdf"), "wb") as fh:
    writer.write(fh)
record("encrypted.pdf", "pdf-encrypted", "explain-password-protected")

# Truncated PDF — valid header, body cut off mid-object
with open(os.path.join(OUT, "police-report.pdf"), "rb") as fh:
    full = fh.read()
with open(os.path.join(OUT, "truncated.pdf"), "wb") as fh:
    fh.write(full[: len(full) // 3])
record("truncated.pdf", "pdf-truncated", "explain-corrupt")

# Not a PDF at all despite the extension
with open(os.path.join(OUT, "not-really-a.pdf"), "wb") as fh:
    fh.write(b"This file claims to be a PDF but has no %PDF header at all.\n" * 20)
record("not-really-a.pdf", "pdf-invalid", "explain-corrupt")

# Corrupt image
with open(os.path.join(OUT, "corrupt-image.png"), "wb") as fh:
    fh.write(b"\x89PNG\r\n\x1a\n" + os.urandom(4096))
record("corrupt-image.png", "image-corrupt", "explain-corrupt")

# Zero-byte upload
open(os.path.join(OUT, "empty-file.pdf"), "wb").close()
record("empty-file.pdf", "empty", "explain-empty")

# Unsupported format
with open(os.path.join(OUT, "unsupported.xyz"), "wb") as fh:
    fh.write(os.urandom(2048))
record("unsupported.xyz", "unsupported", "explain-unsupported")

with open(os.path.join(OUT, "executable.exe"), "wb") as fh:
    fh.write(b"MZ\x90\x00" + os.urandom(4096))
record("executable.exe", "unsupported-dangerous", "reject")

# --- Media fixtures via ffmpeg ----------------------------------------------
def ff(args, out):
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *args, out],
        check=True,
    )


SPEECH_SRC = os.path.join(OUT, "_tone.wav")
ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=12"], SPEECH_SRC)

video_formats = {
    "bodycam.mp4": ["-c:v", "libx264", "-pix_fmt", "yuv420p"],
    "dashcam.mov": ["-c:v", "libx264", "-pix_fmt", "yuv420p"],
    "interview.avi": ["-c:v", "mpeg4"],
    "surveillance.mkv": ["-c:v", "libx264", "-pix_fmt", "yuv420p"],
    "witness-video.m4v": ["-c:v", "libx264", "-pix_fmt", "yuv420p"],
}
for name, codec in video_formats.items():
    ff(
        [
            "-f", "lavfi", "-i", "testsrc=size=640x480:rate=15:duration=6",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
            *codec, "-c:a", "aac" if not name.endswith(".avi") else "mp3",
            "-shortest",
        ],
        os.path.join(OUT, name),
    )
    record(name, "video", "accepted-queued")

audio_formats = {
    "interview.mp3": ["-c:a", "libmp3lame"],
    "jail-call.wav": ["-c:a", "pcm_s16le"],
    "dispatch.aac": ["-c:a", "aac"],
    "voicemail.m4a": ["-c:a", "aac"],
    "witness-statement.flac": ["-c:a", "flac"],
}
for name, codec in audio_formats.items():
    ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=8", *codec], os.path.join(OUT, name))
    record(name, "audio", "accepted-queued")

# Silent video — no detectable speech for transcription
ff(
    [
        "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=5",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
    ],
    os.path.join(OUT, "silent-bodycam.mp4"),
)
record("silent-bodycam.mp4", "video-silent", "explain-no-speech")

# Very dark video — poor lighting
ff(
    [
        "-f", "lavfi", "-i", "color=c=black:size=320x240:rate=10:duration=5",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
    ],
    os.path.join(OUT, "poor-lighting.mp4"),
)
record("poor-lighting.mp4", "video-dark", "accepted-queued")

# Rotated video — display matrix set to 90 degrees
ff(
    [
        "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=5",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-metadata:s:v:0", "rotate=90",
    ],
    os.path.join(OUT, "rotated.mp4"),
)
record("rotated.mp4", "video-rotated", "accepted-queued")

# Corrupt / truncated video
with open(os.path.join(OUT, "bodycam.mp4"), "rb") as fh:
    vid = fh.read()
with open(os.path.join(OUT, "corrupt-video.mp4"), "wb") as fh:
    fh.write(vid[: len(vid) // 4])
record("corrupt-video.mp4", "video-corrupt", "explain-corrupt")

with open(os.path.join(OUT, "broken-metadata.mp4"), "wb") as fh:
    fh.write(b"\x00" * 64 + vid[64:])
record("broken-metadata.mp4", "video-broken-header", "explain-corrupt")

os.remove(SPEECH_SRC)

# --- Manifest ---------------------------------------------------------------
import json

with open(os.path.join(OUT, "MANIFEST.json"), "w") as fh:
    json.dump(manifest, fh, indent=2)

total = sum(
    os.path.getsize(os.path.join(OUT, f))
    for f in os.listdir(OUT)
    if os.path.isfile(os.path.join(OUT, f))
)
print(f"generated {len(manifest)} fixtures in {OUT} ({total / 1e6:.1f} MB)")
