from pathlib import Path
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def main() -> None:
    root = Path(__file__).resolve().parent
    md_path = root / 'Test_Report.md'
    pdf_path = root / 'Test_Report.pdf'

    text = md_path.read_text(encoding='utf-8')

    styles = getSampleStyleSheet()
    normal = styles['BodyText']
    heading = styles['Heading2']
    title = styles['Title']

    story = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 0.12 * inch))
            continue

        escaped = (
            stripped.replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
        )

        if stripped.startswith('# '):
            story.append(Paragraph(escaped[2:].strip(), title))
        elif stripped.startswith('## '):
            story.append(Spacer(1, 0.08 * inch))
            story.append(Paragraph(escaped[3:].strip(), heading))
        elif stripped.startswith('- '):
            story.append(Paragraph(f'• {escaped[2:].strip()}', normal))
        else:
            story.append(Paragraph(escaped, normal))

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=LETTER,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
    )
    doc.build(story)
    print(f'Wrote {pdf_path}')


if __name__ == '__main__':
    main()
