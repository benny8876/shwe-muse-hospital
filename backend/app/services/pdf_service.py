"""Shared PDF-generation helpers for the app's "Export PDF" buttons, mirroring
the existing openpyxl-based "Export Excel" endpoints (see app/api/v1/counters.py,
accounting.py, inventory.py) — same data, same branch/period filters, just a
printable table layout instead of a spreadsheet.
"""
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BRAND_COLOR = colors.HexColor("#005293")
STRIPE_COLOR = colors.HexColor("#f5f7fa")
GRID_COLOR = colors.HexColor("#cccccc")


def new_pdf_document(buf: BytesIO, *, landscape_mode: bool = False) -> SimpleDocTemplate:
    page_size = landscape(A4) if landscape_mode else A4
    return SimpleDocTemplate(
        buf,
        pagesize=page_size,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        title="Shwe Muse Hospital",
    )


def header_elements(title: str, meta: list[tuple[str, str]]) -> list:
    styles = getSampleStyleSheet()
    elements = [Paragraph("Shwe Muse Hospital", styles["Heading2"]), Paragraph(title, styles["Heading3"])]
    for label, value in meta:
        elements.append(Paragraph(f"<b>{label}:</b> {value}", styles["Normal"]))
    elements.append(Spacer(1, 8))
    return elements


def styled_table(columns: list[str], rows: list[list], *, col_widths: list[float] | None = None) -> Table:
    data = [columns] + [[str(c) if c is not None else "" for c in row] for row in rows]
    table = Table(data, repeatRows=1, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, GRID_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, STRIPE_COLOR]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def build_table_pdf(
    *,
    title: str,
    meta: list[tuple[str, str]],
    columns: list[str],
    rows: list[list],
    landscape_mode: bool = False,
    col_widths: list[float] | None = None,
) -> BytesIO:
    """One title + metadata block + a single data table — the common case
    (stock levels, bill history, expense history)."""
    buf = BytesIO()
    doc = new_pdf_document(buf, landscape_mode=landscape_mode)
    elements = header_elements(title, meta)
    elements.append(styled_table(columns, rows, col_widths=col_widths))
    doc.build(elements)
    buf.seek(0)
    return buf
