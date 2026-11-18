import type { ScanResult, Severity, Verdict } from '@server/types';
import type { jsPDF } from 'jspdf';
import { baseFilename, reportSummaryText } from './exports';
import { VERDICT_LABEL } from './format';

type RGB = [number, number, number];

const C = {
  sand: [244, 234, 221] as RGB,
  cream: [251, 246, 237] as RGB,
  brown: [107, 75, 51] as RGB,
  darkBrown: [59, 42, 31] as RGB,
  teal: [15, 76, 72] as RGB,
  mint: [143, 216, 203] as RGB,
  line: [214, 199, 181] as RGB,
  white: [255, 255, 255] as RGB,
  muted: [120, 100, 82] as RGB,
};

const VERDICT_COLOR: Record<Verdict, RGB> = {
  safe: [47, 125, 91],
  caution: [201, 138, 46],
  suspicious: [196, 98, 46],
  dangerous: [180, 71, 47],
};

const SEVERITY_COLOR: Record<Severity, RGB> = {
  critical: [180, 71, 47],
  high: [196, 98, 46],
  medium: [201, 138, 46],
  low: [107, 124, 120],
  info: [120, 100, 82],
};

export async function exportPdf(result: ScanResult): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const verdictColor = VERDICT_COLOR[result.verdict];

  doc.setFillColor(...C.brown);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(...C.mint);
  doc.rect(0, 34, pageWidth, 1.6, 'F');
  drawHat(doc, margin, 9, 1.1);

  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('BlueHats Scanner', margin + 24, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(238, 226, 210);
  doc.text('Explainable phishing & brand-impersonation report', margin + 24, 22.5);
  doc.setFontSize(8);
  doc.text(`bluehats-scanner.vercel.app`, margin + 24, 27.5);

  doc.setFontSize(8);
  doc.setTextColor(238, 226, 210);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - margin, 16, { align: 'right' });
  doc.text(`Scan ${result.id.slice(0, 8)}`, pageWidth - margin, 21, { align: 'right' });
  doc.text(`v1.0.0`, pageWidth - margin, 26, { align: 'right' });

  let y = 44;
  doc.setFillColor(...mix(verdictColor, C.white, 0.86));
  doc.roundedRect(margin, y, contentWidth, 54, 5, 5, 'F');
  doc.setFillColor(...verdictColor);
  doc.roundedRect(margin, y, 4, 54, 2, 2, 'F');

  doc.setFillColor(...verdictColor);
  doc.circle(margin + 26, y + 24, 14.5, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(String(result.score), margin + 26, y + 23, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text('RISK / 100', margin + 26, y + 29, { align: 'center' });

  doc.setTextColor(...verdictColor);
  doc.setFontSize(15);
  doc.text(VERDICT_LABEL[result.verdict], margin + 48, y + 12);
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(`Confidence ${result.confidence}% · ${result.demo ? 'controlled demo fixture' : 'live scan'}`, margin + 48, y + 18);

  doc.setTextColor(...C.darkBrown);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const summaryLines = doc.splitTextToSize(result.summary, contentWidth - 56);
  doc.text(summaryLines.slice(0, 5), margin + 48, y + 25);
  y += 60;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.brown);
  doc.text('Scanned target', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.darkBrown);
  const urlLines = doc.splitTextToSize(result.inputUrl, contentWidth);
  doc.text(urlLines.slice(0, 3), margin, y);
  y += urlLines.slice(0, 3).length * 4 + 2;
  doc.setTextColor(...C.muted);
  doc.setFontSize(7.8);
  doc.text(
    `Host ${result.host} · scanned ${new Date(result.scannedAt).toLocaleString()} · ${(result.durationMs / 1000).toFixed(2)}s · ${result.indicators.length} indicators`,
    margin,
    y,
  );
  y += 8;

  if (result.demo) {
    doc.setFillColor(...C.sand);
    doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
    doc.setTextColor(...C.brown);
    doc.setFontSize(7.6);
    const demoLines = doc.splitTextToSize(`Demo: ${result.demo.note}`, contentWidth - 8);
    doc.text(demoLines.slice(0, 2), margin + 4, y + 5);
    y += 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C.teal);
  doc.text('Evidence by family', margin, y);
  y += 6;
  const columns = 2;
  const gap = 8;
  const barWidth = (contentWidth - gap) / columns;
  result.categories.forEach((category, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (barWidth + gap);
    const rowY = y + row * 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...C.darkBrown);
    doc.text(category.label, x, rowY);
    doc.setTextColor(...C.muted);
    doc.text(String(category.score), x + barWidth - 6, rowY);
    doc.setFillColor(...C.line);
    doc.roundedRect(x, rowY + 1.8, barWidth - 8, 2.2, 1, 1, 'F');
    if (category.score > 0) {
      doc.setFillColor(...(category.score >= 50 ? ([180, 71, 47] as RGB) : category.score >= 25 ? ([201, 138, 46] as RGB) : C.teal));
      doc.roundedRect(x, rowY + 1.8, Math.max(2, ((barWidth - 8) * Math.min(100, category.score)) / 100), 2.2, 1, 1, 'F');
    }
  });
  y += Math.ceil(result.categories.length / columns) * 11 + 3;

  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C.teal);
  doc.text('Signals and evidence', margin, y);
  y += 4;

  if (result.indicators.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Signal', 'Severity', 'Weight', 'Why it matters']],
      body: result.indicators.map((indicator) => [
        indicator.title,
        indicator.severity,
        String(indicator.weight),
        `${indicator.explanation}${indicator.evidence ? `\nEvidence: ${indicator.evidence}` : ''}${indicator.source ? ` · ${indicator.source}` : ''}`,
      ]),
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.4,
        cellPadding: 2.4,
        textColor: C.darkBrown,
        lineColor: C.line,
        lineWidth: 0.15,
        valign: 'top',
      },
      headStyles: { fillColor: C.brown, textColor: C.white, fontSize: 7.6, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 242, 233] },
      columnStyles: {
        0: { cellWidth: 48, fontStyle: 'bold' },
        1: { cellWidth: 19, fontStyle: 'bold' },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const severity = String(data.cell.raw).toLowerCase() as Severity;
          if (SEVERITY_COLOR[severity]) data.cell.styles.textColor = SEVERITY_COLOR[severity];
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.darkBrown);
    doc.text('No risk indicators fired on this scan.', margin, y + 4);
    y += 10;
  }

  if (y > 245) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C.teal);
  doc.text('Reassuring signals', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.darkBrown);
  if (result.trustSignals.length) {
    for (const signal of result.trustSignals.slice(0, 6)) {
      const lines = doc.splitTextToSize(`• ${signal.title} — ${signal.explanation}`, contentWidth - 2);
      if (y + lines.length * 4 > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, margin, y);
      y += lines.length * 4 + 1;
    }
  } else {
    doc.setTextColor(...C.muted);
    doc.text('No trust signals were recorded.', margin, y);
    y += 5;
  }
  y += 4;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C.teal);
  doc.text('Sources & freshness', margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Source', 'Status', 'Detail', 'Freshness']],
    body: result.reputation.sources.map((source) => [source.name, source.status.replace('_', ' '), source.detail, source.freshness ?? '—']),
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, textColor: C.darkBrown, lineColor: C.line, lineWidth: 0.15, valign: 'top' },
    headStyles: { fillColor: C.brown, textColor: C.white, fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 24 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 34 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C.teal);
  doc.text('Limitations', margin, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(...C.muted);
  for (const limitation of result.limitations) {
    const lines = doc.splitTextToSize(`• ${limitation}`, contentWidth - 2);
    if (y + lines.length * 3.5 > 272) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * 3.5 + 0.6;
  }

  y += 3;
  if (y > 262) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(...C.sand);
  doc.roundedRect(margin, y, contentWidth, 14, 3, 3, 'F');
  doc.setFontSize(7.4);
  doc.setTextColor(...C.brown);
  const disclaimer = doc.splitTextToSize(
    'This report is a heuristic assessment produced by BlueHats Scanner. It is not legal proof that a site is malicious or safe. Never enter credentials based only on a scan result.',
    contentWidth - 8,
  );
  doc.text(disclaimer.slice(0, 3), margin + 4, y + 5);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.line(margin, 285, pageWidth - margin, 285);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('BlueHats Scanner · heuristic assessment, not proof of safety', margin, 289);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, 289, { align: 'right' });
  }

  doc.save(`${baseFilename(result, 'report')}.pdf`);
}

function drawHat(doc: jsPDF, x: number, y: number, scale: number): void {
  doc.setFillColor(...C.mint);
  doc.ellipse(x + 10 * scale, y + 15 * scale, 10 * scale, 3.2 * scale, 'F');
  doc.setFillColor(232, 218, 198);
  doc.roundedRect(x + 2.6 * scale, y + 2 * scale, 14.8 * scale, 11 * scale, 3 * scale, 3 * scale, 'F');
  doc.setFillColor(...C.teal);
  doc.rect(x + 2.6 * scale, y + 9.4 * scale, 14.8 * scale, 3.2 * scale, 'F');
  doc.setFillColor(...C.mint);
  doc.roundedRect(x + 6.4 * scale, y + 5.2 * scale, 7.2 * scale, 2.4 * scale, 1 * scale, 1 * scale, 'F');
}

function mix(a: RGB, b: RGB, ratio: number): RGB {
  return [
    Math.round(a[0] * (1 - ratio) + b[0] * ratio),
    Math.round(a[1] * (1 - ratio) + b[1] * ratio),
    Math.round(a[2] * (1 - ratio) + b[2] * ratio),
  ];
}

export { reportSummaryText };
