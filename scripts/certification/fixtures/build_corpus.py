#!/usr/bin/env python3
"""Build a mixed-discovery folder hierarchy that mimics how a producing party
actually delivers a criminal case: nested folders, unhelpful filenames, a ZIP
inside the delivery, duplicates, and a few unreadable files.

This is a synthetic stand-in used to exercise the certification framework. It
is not, and must not be mistaken for, real discovery.
"""

import json
import os
import shutil
import zipfile

SRC = "/tmp/courtaccess-fixtures"
OUT = "/tmp/courtaccess-certification-corpus/SYNTHETIC-001"

LAYOUT = {
    "01 Police Reports": [
        ("police-report.pdf", "Doc0001.pdf"),
        ("supplemental-police-report.pdf", "Doc0002.pdf"),
        ("crime-scene-report.pdf", "Doc0003.pdf"),
    ],
    "02 Court/Transcripts": [
        ("preliminary-hearing-transcript.pdf", "RT 03-28-2026.pdf"),
        ("trial-transcript.pdf", "RT 05-11-2026.pdf"),
    ],
    "02 Court/Filings": [
        ("court-filing.pdf", "Motion.pdf"),
        ("search-warrant.pdf", "SW-26-0331.pdf"),
        ("search-warrant-affidavit.pdf", "SW-26-0331 Affidavit.pdf"),
        ("search-warrant-return.pdf", "SW-26-0331 Return.pdf"),
    ],
    "03 Lab and Medical": [
        ("laboratory-report.pdf", "L-26-00918.pdf"),
        ("dna-report.pdf", "DNA Analysis.pdf"),
        ("medical-report.pdf", "Highland ED.pdf"),
        ("psychological-evaluation.pdf", "Eval.pdf"),
    ],
    "04 Dispatch": [
        ("dispatch-log.pdf", "CAD.pdf"),
        ("cad-report.pdf", "CAD Detail.pdf"),
    ],
    "05 Media": [
        ("bodycam.mp4", "3L41_BWC.mp4"),
        ("dashcam.mov", "Unit 3L47 dash.mov"),
        ("jail-call.wav", "Call 0417.wav"),
        ("crime-scene-photo.jpeg", "IMG_0042.jpeg"),
        ("scanned-police-report.png", "Scan001.png"),
    ],
    "06 Expert": [
        ("expert-report.pdf", "Voss Report.pdf"),
    ],
    "07 Problem Files": [
        ("encrypted.pdf", "Protected.pdf"),
        ("truncated.pdf", "Partial.pdf"),
        ("corrupt-image.png", "Damaged.png"),
        ("empty-file.pdf", "Empty.pdf"),
        ("missing-pages-production.pdf", "Short Production.pdf"),
        ("handwritten-statement.png", "Witness Statement.png"),
    ],
}

# A duplicate of a report, delivered twice in different folders — routine.
DUPLICATES = [("police-report.pdf", "08 Duplicates/Doc0001 (copy).pdf")]

# A ZIP nested inside the delivery.
ZIP_CONTENTS = ["emails.txt", "text-messages.txt", "financial-records.pdf"]


def build():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    placed = 0
    for folder, items in LAYOUT.items():
        target = os.path.join(OUT, folder)
        os.makedirs(target, exist_ok=True)
        for src_name, dest_name in items:
            src = os.path.join(SRC, src_name)
            if not os.path.exists(src):
                print(f"  missing fixture, skipped: {src_name}")
                continue
            shutil.copy2(src, os.path.join(target, dest_name))
            placed += 1

    for src_name, rel in DUPLICATES:
        src = os.path.join(SRC, src_name)
        dest = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(src, dest)
        placed += 1

    zip_path = os.path.join(OUT, "09 Digital", "Production 3.zip")
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)
    with zipfile.ZipFile(zip_path, "w") as z:
        for name in ZIP_CONTENTS:
            src = os.path.join(SRC, name)
            if os.path.exists(src):
                z.write(src, f"Digital Evidence/{name}")
    placed += 1

    manifest = {
        "root": OUT,
        "filesPlaced": placed,
        "expectedDuplicates": len(DUPLICATES),
        "zipMembers": len(ZIP_CONTENTS),
        "note": "Synthetic corpus for exercising the certification framework. Not real discovery.",
    }
    with open(os.path.join("/tmp/courtaccess-certification-corpus", "SYNTHETIC-001.manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    print(f"corpus built at {OUT}")
    print(f"  {placed} files across {len(LAYOUT) + 2} folders, 1 nested ZIP with {len(ZIP_CONTENTS)} members")


if __name__ == "__main__":
    build()
