// In-place cover letter PDF editor.
// Strategy: load the original PDF with pdf-lib, then for each edit:
//   1. Locate the "find" text on a page using pdfjs-dist (gives bounding box).
//   2. Cover the original glyphs with a white rectangle.
//   3. Draw the "replace" text in Helvetica at the same position & size.
// This preserves margins, layout, header, and the rest of the document exactly.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface Edit {
  find: string;
  replace: string;
  reason?: string;
}

interface Match {
  pageIndex: number;
  x: number; // PDF coords (origin bottom-left)
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

/**
 * Find every occurrence of `needle` in the PDF and return its bounding box.
 * Uses pdfjs text items; concatenates items per line and locates substring.
 */
async function findOccurrences(
  pdfBytes: Uint8Array,
  needle: string,
): Promise<Match[]> {
  const matches: Match[] = [];
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() });
  const doc = await loadingTask.promise;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const content = await page.getTextContent();

    // Group items into lines by Y coordinate
    type Item = { str: string; x: number; y: number; w: number; h: number; fs: number };
    const items: Item[] = (content.items as any[]).map((it) => {
      const tr = it.transform; // [a,b,c,d,e,f]
      const fs = Math.hypot(tr[2], tr[3]) || Math.hypot(tr[0], tr[1]) || 11;
      return {
        str: it.str,
        x: tr[4],
        y: tr[5],
        w: it.width || 0,
        h: it.height || fs,
        fs,
      };
    });

    // bucket by rounded y
    const lines = new Map<number, Item[]>();
    for (const it of items) {
      const key = Math.round(it.y);
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key)!.push(it);
    }

    for (const [, lineItems] of lines) {
      lineItems.sort((a, b) => a.x - b.x);
      const lineStr = lineItems.map((i) => i.str).join("");
      const idx = lineStr.indexOf(needle);
      if (idx === -1) continue;

      // Walk items to find x-position of idx and (idx+needle.length)
      let cursor = 0;
      let startX: number | null = null;
      let endX: number | null = null;
      let fs = lineItems[0]?.fs ?? 11;
      for (const it of lineItems) {
        const next = cursor + it.str.length;
        if (startX === null && idx >= cursor && idx <= next) {
          const within = idx - cursor;
          const ratio = it.str.length === 0 ? 0 : within / it.str.length;
          startX = it.x + it.w * ratio;
          fs = it.fs;
        }
        const endIdx = idx + needle.length;
        if (startX !== null && endX === null && endIdx >= cursor && endIdx <= next) {
          const within = endIdx - cursor;
          const ratio = it.str.length === 0 ? 0 : within / it.str.length;
          endX = it.x + it.w * ratio;
          break;
        }
        cursor = next;
      }
      if (startX === null) continue;
      if (endX === null) {
        const last = lineItems[lineItems.length - 1];
        endX = last.x + last.w;
      }
      const width = Math.max(2, endX - startX);
      const height = fs * 1.15;
      // pdfjs y is from top in viewport coords? Actually transform y is PDF coords (bottom-left origin).
      matches.push({
        pageIndex: p - 1,
        x: startX,
        y: lineItems[0].y,
        width,
        height,
        fontSize: fs,
      });
    }
  }

  return matches;
}

/**
 * Apply edits in-place to the original PDF and return the modified bytes.
 */
export async function applyEditsToPdf(
  originalBytes: Uint8Array,
  edits: Edit[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const edit of edits) {
    if (!edit.find || edit.find === edit.replace) continue;
    let matches: Match[] = [];
    try {
      matches = await findOccurrences(originalBytes, edit.find);
    } catch (e) {
      console.warn("Locate failed for", edit.find, e);
      continue;
    }
    for (const m of matches) {
      const page = pages[m.pageIndex];
      if (!page) continue;
      // White-out original (a touch of vertical padding so descenders are covered)
      const padTop = m.fontSize * 0.25;
      const padBottom = m.fontSize * 0.18;
      page.drawRectangle({
        x: m.x - 0.5,
        y: m.y - padBottom,
        width: m.width + 1,
        height: m.fontSize + padTop + padBottom,
        color: rgb(1, 1, 1),
      });
      // Draw replacement text. Shrink font if replacement is wider than slot.
      let size = m.fontSize;
      let textWidth = helv.widthOfTextAtSize(edit.replace, size);
      const slot = m.width;
      while (textWidth > slot && size > 6) {
        size -= 0.25;
        textWidth = helv.widthOfTextAtSize(edit.replace, size);
      }
      page.drawText(edit.replace, {
        x: m.x,
        y: m.y,
        size,
        font: helv,
        color: rgb(0.08, 0.08, 0.08),
      });
    }
  }

  return await pdfDoc.save();
}

export function downloadEditedLetter(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
