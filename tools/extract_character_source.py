"""Extract the immutable character archive text baseline from the source DOCX."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import zipfile
from pathlib import Path

import fitz
from docx import Document


ROOT = Path(__file__).resolve().parents[1]
DOCX_SOURCE = ROOT / "角色档案.docx"
PDF_SOURCE = ROOT / "角色档案.pdf"
OUTPUT = ROOT / "tests" / "fixtures" / "character-source.json"


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value))


def main() -> None:
    document = Document(DOCX_SOURCE)
    paragraphs = [
        {"index": index, "text": paragraph.text}
        for index, paragraph in enumerate(document.paragraphs)
        if paragraph.text.strip()
    ]
    pdf = fitz.open(PDF_SOURCE)
    pdf_text = normalize_text("\n".join(page.get_text() for page in pdf))
    comparable = [
        paragraph["text"]
        for paragraph in paragraphs
        if len(normalize_text(paragraph["text"])) >= 12
        and not set(normalize_text(paragraph["text"])) <= set("—-")
    ]
    matched = sum(normalize_text(text) in pdf_text for text in comparable)
    with zipfile.ZipFile(DOCX_SOURCE) as package:
        media = {
            entry.filename: hashlib.sha256(package.read(entry)).hexdigest()
            for entry in package.infolist()
            if entry.filename.startswith("word/media/")
        }

    payload = {
        "source": DOCX_SOURCE.name,
        "docxSha256": hashlib.sha256(DOCX_SOURCE.read_bytes()).hexdigest(),
        "pdfSource": PDF_SOURCE.name,
        "pdfSha256": hashlib.sha256(PDF_SOURCE.read_bytes()).hexdigest(),
        "pdfPages": len(pdf),
        "pdfComparableParagraphs": len(comparable),
        "pdfMatchedParagraphs": matched,
        "pdfParagraphCoverage": matched / len(comparable) if comparable else 1,
        "media": media,
        "paragraphs": paragraphs,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {len(paragraphs)} non-empty paragraphs to {OUTPUT}")


if __name__ == "__main__":
    main()
