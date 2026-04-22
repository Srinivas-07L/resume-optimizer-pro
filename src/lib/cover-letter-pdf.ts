import { jsPDF } from "jspdf";

export interface CoverLetterData {
  applicant_name?: string;
  company_name?: string;
  date?: string;
  recipient_block?: string;
  salutation: string;
  paragraphs: string[];
  sign_off: string;
  signature_name?: string;
}

/**
 * ATS-friendly cover letter PDF.
 * Single column, Helvetica (Arial-equivalent web-safe), no tables/columns.
 */
export function generateCoverLetterPdf(data: CoverLetterData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 72; // 1"
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeBlock = (text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) => {
    if (!text) return;
    const size = opts.size ?? 11;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(20, 20, 20);
    const lh = size * 1.5;
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      ensureSpace(lh);
      doc.text(line, margin, y);
      y += lh;
    }
    if (opts.gap) y += opts.gap;
  };

  if (data.applicant_name) writeBlock(data.applicant_name, { bold: true, size: 12, gap: 4 });
  if (data.date) writeBlock(data.date, { gap: 12 });
  if (data.recipient_block) writeBlock(data.recipient_block, { gap: 12 });

  writeBlock(data.salutation, { gap: 10 });

  for (const p of data.paragraphs) {
    writeBlock(p, { gap: 12 });
  }

  writeBlock(data.sign_off, { gap: 28 });
  if (data.signature_name) writeBlock(data.signature_name, { bold: true });

  return doc;
}

export function downloadCoverLetterPdf(data: CoverLetterData) {
  const doc = generateCoverLetterPdf(data);
  const safe = (s: string) => (s || "").replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "");
  const fileName = `${safe(data.applicant_name || "Cover") || "Cover"}_CoverLetter_${safe(data.company_name || "Tailored")}.pdf`;
  doc.save(fileName);
}
