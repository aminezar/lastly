"""Make the two fictional sample documents for the Lastly demo case.

    python3 scripts/make-sample-documents.py

Writes public/samples/death-certificate-jean-dupont.{pdf,png} and
public/samples/notary-act-jean-dupont.{pdf,png}. Both are fictional specimens (no
real person, authority or notary) whose facts match the seeded Legacy Mandate in
data/seed-estate.json: Jean Dupont, died 20 October 2026, executor Marie Dupont.
The PDFs are image-only, like a scan, so the AI has to read the page itself (there
is no text layer to copy). Upload them in the portal to film the "Read by AI" path.
Needs reportlab, Pillow and pdftoppm (poppler).
"""

import subprocess
import tempfile
from pathlib import Path

from PIL import Image
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parent.parent / "public" / "samples"
INK = HexColor("#1d2433")
MUTED = HexColor("#5b6475")
RULE = HexColor("#9aa3b2")
W, H = A4
M = 56  # page margin


def specimen(c: canvas.Canvas) -> None:
    c.saveState()
    c.setFillColor(Color(0.75, 0.1, 0.1, alpha=0.08))
    c.setFont("Helvetica-Bold", 64)
    c.translate(W / 2, H / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, "SPECIMEN · FICTIONAL")
    c.restoreState()
    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED)
    c.drawCentredString(W / 2, 28, "Fictional specimen made for the Lastly hackathon demo. Not an official document. No real person, authority or notary.")


def seal(c: canvas.Canvas, x: float, y: float, top: str, bottom: str) -> None:
    c.saveState()
    c.setStrokeColor(HexColor("#2b4a8b"))
    c.setFillColor(HexColor("#2b4a8b"))
    c.setLineWidth(1.4)
    c.circle(x, y, 34)
    c.setLineWidth(0.6)
    c.circle(x, y, 28)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawCentredString(x, y + 6, top)
    c.drawCentredString(x, y - 2, "SPECIMEN")
    c.setFont("Helvetica", 6)
    c.drawCentredString(x, y - 11, bottom)
    c.restoreState()


def header(c: canvas.Canvas, top_left: list[str], ref: str, title_nl_fr: str, title_en: str) -> float:
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9.5)
    y = H - M
    for i, line in enumerate(top_left):
        c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 9.5 if i == 0 else 8.5)
        c.drawString(M, y - i * 12, line)
    c.setFont("Helvetica", 8.5)
    c.drawRightString(W - M, y, ref)
    y -= 12 * len(top_left) + 22
    c.setStrokeColor(INK)
    c.setLineWidth(1.2)
    c.line(M, y, W - M, y)
    y -= 34
    c.setFont("Times-Bold", 19)
    c.drawCentredString(W / 2, y, title_nl_fr)
    y -= 18
    c.setFont("Times-Italic", 12)
    c.setFillColor(MUTED)
    c.drawCentredString(W / 2, y, title_en)
    y -= 16
    c.setLineWidth(0.5)
    c.line(M, y, W - M, y)
    return y - 30


def field_rows(c: canvas.Canvas, y: float, rows: list[tuple[str, str]]) -> float:
    label_w = 205
    for label, value in rows:
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        c.drawString(M, y, label)
        c.setFont("Times-Roman", 12)
        c.setFillColor(INK)
        c.drawString(M + label_w, y, value)
        c.setStrokeColor(RULE)
        c.setLineWidth(0.3)
        c.setDash(1, 2)
        c.line(M + label_w, y - 4, W - M, y - 4)
        c.setDash()
        y -= 27
    return y


def paragraph(c: canvas.Canvas, y: float, lines: list[str], size: float = 11.5, lead: float = 16) -> float:
    c.setFont("Times-Roman", size)
    c.setFillColor(INK)
    for line in lines:
        c.drawString(M, y, line)
        y -= lead
    return y


def death_certificate(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Death certificate — Jean Dupont (fictional specimen)")
    c.setAuthor("Lastly demo")
    specimen(c)
    y = header(
        c,
        ["Civil Registry · Burgerlijke Stand · État civil", "Brussels-Capital Region (fictional specimen)", "Register of deaths 2026"],
        "Act no. 2026/D/04187",
        "AKTE VAN OVERLIJDEN · ACTE DE DÉCÈS",
        "Death certificate (extract)",
    )
    y = field_rows(
        c,
        y,
        [
            ("Deceased / Overledene / Défunt", "Jean Dupont"),
            ("Date of birth / Geboortedatum", "14 March 1949"),
            ("Place of birth / Geboorteplaats", "Liège, Belgium"),
            ("Date of death / Datum van overlijden", "20 October 2026"),
            ("Place of death / Plaats van overlijden", "Brussels, Belgium"),
            ("Marital status / Burgerlijke staat", "Widower"),
            ("Declared by / Aangegeven door", "Marie Dupont, daughter"),
        ],
    )
    y -= 10
    y = paragraph(
        c,
        y,
        [
            "The undersigned civil registrar certifies that the above is a true extract of the death",
            "register kept for the year 2026, drawn up on the declaration of the person named above.",
        ],
    )
    y -= 50
    c.setFont("Helvetica", 8.5)
    c.setFillColor(MUTED)
    c.drawString(M, y, "Issued at Brussels on 23 October 2026")
    c.drawString(M, y - 40, "The civil registrar (fictional)")
    c.setStrokeColor(INK)
    c.line(M, y - 26, M + 180, y - 26)
    seal(c, W - M - 60, y - 14, "CIVIL REGISTRY", "BRUSSELS")
    c.showPage()
    c.save()


def notary_act(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Notary act of heredity — estate of Jean Dupont (fictional specimen)")
    c.setAuthor("Lastly demo")
    specimen(c)
    y = header(
        c,
        ["Notary Claire Lambert (fictional)", "Rue de l'Exemple 12, 1000 Brussels (fictional)", "Repertorium no. 2026/1129"],
        "File HER-2026-0418",
        "AKTE VAN ERFOPVOLGING · ACTE D'HÉRÉDITÉ",
        "Notary act of heredity",
    )
    y = paragraph(
        c,
        y,
        [
            "Before me, Claire Lambert, notary in Brussels (fictional), appeared the heirs named below,",
            "who asked me to record the devolution of the estate described in this act.",
        ],
    )
    y -= 14
    y = field_rows(
        c,
        y,
        [
            ("Estate of / Nalatenschap van", "Jean Dupont"),
            ("Deceased on / Overleden op", "20 October 2026, Brussels"),
            ("Executor / Exécuteur testamentaire", "Marie Dupont (daughter)"),
            ("Executor appointed under", "Legacy Mandate signed 3 May 2025"),
        ],
    )
    y -= 6
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(INK)
    c.drawString(M, y, "HEIRS / ERFGENAMEN / HÉRITIERS")
    y -= 20
    y = field_rows(c, y, [("Marie Dupont, daughter", "50%"), ("Luc Dupont, son", "50%")])
    y -= 8
    y = paragraph(
        c,
        y,
        [
            "The executor named above may settle the accounts, subscriptions and payments of the",
            "estate, collect any refunds owed to it and pay out the balance to the heirs in the shares",
            "set out above.",
        ],
    )
    y -= 46
    c.setFont("Helvetica", 8.5)
    c.setFillColor(MUTED)
    c.drawString(M, y, "Executed at Brussels on 6 November 2026")
    c.drawString(M, y - 40, "Claire Lambert, notary (fictional)")
    c.setStrokeColor(INK)
    c.line(M, y - 26, M + 180, y - 26)
    seal(c, W - M - 60, y - 14, "NOTARY", "BRUSSELS")
    c.showPage()
    c.save()


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, draw in (("death-certificate-jean-dupont", death_certificate), ("notary-act-jean-dupont", notary_act)):
            vector = Path(tmp) / f"{name}.pdf"
            draw(vector)
            # Rasterise like a scan: an off-white page, a slight skew, no text layer.
            subprocess.run(["pdftoppm", "-png", "-r", "150", "-singlefile", str(vector), str(Path(tmp) / name)], check=True)
            page = Image.open(Path(tmp) / f"{name}.png").convert("RGB")
            paper = Image.new("RGB", page.size, (250, 248, 242))
            page = Image.blend(page, paper, 0.06).rotate(-0.4, resample=Image.BICUBIC, expand=False, fillcolor=(250, 248, 242))
            page.save(OUT / f"{name}.png", optimize=True)
            page.save(OUT / f"{name}.pdf", "PDF", resolution=150)
    print(f"Wrote 2 scanned-style PDFs and PNGs to {OUT}")
