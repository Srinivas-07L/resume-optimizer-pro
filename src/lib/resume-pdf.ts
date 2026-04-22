import { jsPDF } from "jspdf";

export interface ResumeData {
  name: string;
  contact?: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    dates: string;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    dates?: string;
    details?: string;
  }>;
  projects?: Array<{ name: string; bullets: string[] }>;
  certifications?: string[];
  company_name?: string;
}

interface RenderOpts {
  baseSize: number; // body font pt
  lhMul: number; // line-height multiplier
  margin: number; // pt
  trimTail: number; // # trailing bullets to drop from each experience entry
}

/**
 * Internal renderer. Returns the doc + the page count it produced.
 */
function renderResume(data: ResumeData, opts: RenderOpts): { doc: jsPDF; pages: number } {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = opts.margin;
  const maxW = pageW - margin * 2;
  let y = margin;

  const body = opts.baseSize;
  const lh = body * opts.lhMul;
  const sectionGap = Math.max(8, body * 1.1);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeText = (
    text: string,
    o: { size?: number; bold?: boolean; color?: [number, number, number] } = {},
  ) => {
    const size = o.size ?? body;
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(o.color ?? [20, 20, 20]));
    const lines = doc.splitTextToSize(text, maxW);
    const localLh = size * opts.lhMul;
    for (const line of lines) {
      ensureSpace(localLh);
      doc.text(line, margin, y);
      y += localLh;
    }
  };

  const sectionHeader = (label: string) => {
    y += sectionGap - 4;
    ensureSpace(body * 2.4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(body + 1.5);
    doc.setTextColor(20, 20, 20);
    doc.text(label.toUpperCase(), margin, y);
    y += 4;
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += body * 0.9;
  };

  // Header — Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.max(16, body + 9));
  doc.setTextColor(15, 15, 15);
  ensureSpace(body * 2);
  doc.text(data.name || "Name", margin, y);
  y += body * 1.9;

  const contactParts: string[] = [];
  if (data.contact?.location) contactParts.push(data.contact.location);
  if (data.contact?.phone) contactParts.push(data.contact.phone);
  if (data.contact?.email) contactParts.push(data.contact.email);
  if (data.contact?.linkedin) contactParts.push(data.contact.linkedin);
  if (data.contact?.website) contactParts.push(data.contact.website);
  if (contactParts.length) {
    writeText(contactParts.join("  |  "), { size: body - 0.5, color: [60, 60, 60] });
  }

  if (data.summary) {
    sectionHeader("Summary");
    writeText(data.summary);
  }

  if (data.skills?.length) {
    sectionHeader("Skills");
    writeText(data.skills.join(", "));
  }

  if (data.experience?.length) {
    sectionHeader("Experience");
    for (const job of data.experience) {
      ensureSpace(body * 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(body + 0.5);
      doc.setTextColor(20, 20, 20);
      const titleLine = `${job.title} — ${job.company}`;
      const titleLines = doc.splitTextToSize(titleLine, maxW);
      for (const l of titleLines) {
        ensureSpace(lh);
        doc.text(l, margin, y);
        y += lh;
      }
      const meta = [job.location, job.dates].filter(Boolean).join("  |  ");
      if (meta) writeText(meta, { size: body - 0.5, color: [80, 80, 80] });
      const bullets = job.bullets || [];
      // ruthless trim: drop last N bullets per role (but always keep at least 1)
      const keep = Math.max(1, bullets.length - opts.trimTail);
      for (const b of bullets.slice(0, keep)) {
        const bulletText = `•  ${b}`;
        const lines = doc.splitTextToSize(bulletText, maxW - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(body);
        doc.setTextColor(25, 25, 25);
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(lh);
          doc.text(lines[i], margin + (i === 0 ? 0 : 12), y);
          y += lh;
        }
      }
      y += body * 0.4;
    }
  }

  if (data.projects?.length) {
    sectionHeader("Projects");
    for (const p of data.projects) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(body + 0.5);
      ensureSpace(lh);
      doc.text(p.name, margin, y);
      y += lh;
      for (const b of p.bullets || []) {
        const bulletText = `•  ${b}`;
        const lines = doc.splitTextToSize(bulletText, maxW - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(body);
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(lh);
          doc.text(lines[i], margin + (i === 0 ? 0 : 12), y);
          y += lh;
        }
      }
      y += body * 0.3;
    }
  }

  if (data.education?.length) {
    sectionHeader("Education");
    for (const ed of data.education) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(body + 0.5);
      ensureSpace(lh);
      doc.text(ed.degree, margin, y);
      y += lh;
      const meta = [ed.school, ed.dates].filter(Boolean).join("  |  ");
      if (meta) writeText(meta, { size: body - 0.5, color: [80, 80, 80] });
      if (ed.details) writeText(ed.details);
      y += body * 0.3;
    }
  }

  if (data.certifications?.length) {
    sectionHeader("Certifications");
    writeText(data.certifications.join(", "));
  }

  return { doc, pages: doc.getNumberOfPages() };
}

/**
 * Generate ATS-friendly single-column PDF.
 * If forceOnePage = true, iteratively shrink font, tighten line-height,
 * and trim trailing bullets until the doc fits on a single A4/letter page.
 */
export function generateResumePdf(data: ResumeData, forceOnePage = false): jsPDF {
  if (!forceOnePage) {
    return renderResume(data, { baseSize: 10.5, lhMul: 1.35, margin: 54, trimTail: 0 }).doc;
  }

  // Cascade of progressively tighter settings, then progressive trimming.
  const cascade: RenderOpts[] = [
    { baseSize: 10.5, lhMul: 1.25, margin: 50, trimTail: 0 },
    { baseSize: 10, lhMul: 1.2, margin: 48, trimTail: 0 },
    { baseSize: 10, lhMul: 1.15, margin: 45, trimTail: 0 },
    { baseSize: 9.5, lhMul: 1.15, margin: 45, trimTail: 0 },
    { baseSize: 9.5, lhMul: 1.1, margin: 42, trimTail: 1 },
    { baseSize: 9, lhMul: 1.1, margin: 40, trimTail: 1 },
    { baseSize: 9, lhMul: 1.1, margin: 40, trimTail: 2 },
    { baseSize: 9, lhMul: 1.1, margin: 40, trimTail: 3 },
  ];

  let last = renderResume(data, cascade[0]);
  for (const opts of cascade) {
    const r = renderResume(data, opts);
    last = r;
    if (r.pages <= 1) return r.doc;
  }
  return last.doc;
}

export function downloadResumePdf(data: ResumeData, forceOnePage = false) {
  const doc = generateResumePdf(data, forceOnePage);
  const safe = (s: string) => (s || "").replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "");
  const fileName = `${safe(data.name) || "Resume"}_Resume_${safe(data.company_name || "Tailored")}.pdf`;
  doc.save(fileName);
}
