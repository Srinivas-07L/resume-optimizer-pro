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

/**
 * Generate a strict ATS-friendly, single-column, text-searchable PDF.
 * Helvetica only, no tables/icons/columns/headers/footers.
 */
export function generateResumePdf(data: ResumeData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 54; // 0.75"
  const maxW = pageW - margin * 2;
  let y = margin;

  const lineGap = 4;
  const sectionGap = 14;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; lh?: number } = {},
  ) => {
    const size = opts.size ?? 10.5;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? [20, 20, 20]));
    const lines = doc.splitTextToSize(text, maxW);
    const lh = opts.lh ?? size * 1.35;
    for (const line of lines) {
      ensureSpace(lh);
      doc.text(line, margin, y);
      y += lh;
    }
  };

  const sectionHeader = (label: string) => {
    y += sectionGap - lineGap;
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(label.toUpperCase(), margin, y);
    y += 4;
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
  };

  // Header — Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 15, 15);
  ensureSpace(24);
  doc.text(data.name || "Name", margin, y);
  y += 22;

  // Contact line(s)
  const contactParts: string[] = [];
  if (data.contact?.location) contactParts.push(data.contact.location);
  if (data.contact?.phone) contactParts.push(data.contact.phone);
  if (data.contact?.email) contactParts.push(data.contact.email);
  if (data.contact?.linkedin) contactParts.push(data.contact.linkedin);
  if (data.contact?.website) contactParts.push(data.contact.website);
  if (contactParts.length) {
    writeText(contactParts.join("  |  "), { size: 10, color: [60, 60, 60] });
  }

  // Summary
  if (data.summary) {
    sectionHeader("Summary");
    writeText(data.summary, { size: 10.5 });
  }

  // Skills (plain comma-separated, single column, ATS-friendly)
  if (data.skills?.length) {
    sectionHeader("Skills");
    writeText(data.skills.join(", "), { size: 10.5 });
  }

  // Experience
  if (data.experience?.length) {
    sectionHeader("Experience");
    for (const job of data.experience) {
      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      const titleLine = `${job.title} — ${job.company}`;
      const titleLines = doc.splitTextToSize(titleLine, maxW);
      for (const l of titleLines) {
        ensureSpace(14);
        doc.text(l, margin, y);
        y += 14;
      }
      const meta = [job.location, job.dates].filter(Boolean).join("  |  ");
      if (meta) writeText(meta, { size: 10, color: [80, 80, 80] });
      y += 2;
      for (const b of job.bullets || []) {
        const bulletText = `•  ${b}`;
        const lines = doc.splitTextToSize(bulletText, maxW - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(25, 25, 25);
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(14);
          doc.text(lines[i], margin + (i === 0 ? 0 : 12), y);
          y += 14;
        }
      }
      y += 6;
    }
  }

  // Projects
  if (data.projects?.length) {
    sectionHeader("Projects");
    for (const p of data.projects) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      ensureSpace(14);
      doc.text(p.name, margin, y);
      y += 14;
      for (const b of p.bullets || []) {
        const bulletText = `•  ${b}`;
        const lines = doc.splitTextToSize(bulletText, maxW - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(14);
          doc.text(lines[i], margin + (i === 0 ? 0 : 12), y);
          y += 14;
        }
      }
      y += 4;
    }
  }

  // Education
  if (data.education?.length) {
    sectionHeader("Education");
    for (const ed of data.education) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      ensureSpace(14);
      doc.text(ed.degree, margin, y);
      y += 14;
      const meta = [ed.school, ed.dates].filter(Boolean).join("  |  ");
      if (meta) writeText(meta, { size: 10, color: [80, 80, 80] });
      if (ed.details) writeText(ed.details, { size: 10.5 });
      y += 4;
    }
  }

  // Certifications
  if (data.certifications?.length) {
    sectionHeader("Certifications");
    writeText(data.certifications.join(", "), { size: 10.5 });
  }

  return doc;
}

export function downloadResumePdf(data: ResumeData) {
  const doc = generateResumePdf(data);
  const safe = (s: string) => (s || "").replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "");
  const fileName = `${safe(data.name) || "Resume"}_Resume_${safe(data.company_name || "Tailored")}.pdf`;
  doc.save(fileName);
}
