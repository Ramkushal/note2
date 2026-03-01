/**
 * PDF Export Engine
 * Injects annotations into a PDF using pdf-lib
 * Produces a standards-compliant PDF with /Subtype /Highlight and QuadPoints
 */

import { PDFDocument, PDFPage, PDFDict, PDFName, PDFArray, PDFNumber, PDFString } from 'pdf-lib';
import type { Annotation } from '../types/annotation';

/**
 * Inject a Highlight annotation into a PDF page using pdf-lib low-level API.
 * This produces proper /Subtype /Highlight with QuadPoints as required by PDF spec.
 */
function injectHighlight(page: PDFPage, annotation: Annotation): void {
  const pdfDoc = page.doc;
  const { rect, quadPoints, color, contents, author, createdAt } = annotation;

  // Build annotation dict
  const annot = pdfDoc.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Highlight'),
    Rect: PDFArray.withContext(pdfDoc.context),
    QuadPoints: PDFArray.withContext(pdfDoc.context),
    C: PDFArray.withContext(pdfDoc.context),
    T: PDFString.of(author),
    Contents: PDFString.of(contents || ''),
    CA: PDFNumber.of(0.5), // opacity
    CreationDate: PDFString.of(createdAt),
    M: PDFString.of(createdAt),
    F: PDFNumber.of(4), // Print flag
  }) as PDFDict;

  // Set Rect
  const rectArray = annot.get(PDFName.of('Rect')) as PDFArray;
  rectArray.push(PDFNumber.of(rect[0]));
  rectArray.push(PDFNumber.of(rect[1]));
  rectArray.push(PDFNumber.of(rect[2]));
  rectArray.push(PDFNumber.of(rect[3]));

  // Set QuadPoints
  const qpArray = annot.get(PDFName.of('QuadPoints')) as PDFArray;
  for (const qp of quadPoints) {
    qpArray.push(PDFNumber.of(qp));
  }

  // Set Color (RGB)
  const cArray = annot.get(PDFName.of('C')) as PDFArray;
  cArray.push(PDFNumber.of(color[0]));
  cArray.push(PDFNumber.of(color[1]));
  cArray.push(PDFNumber.of(color[2]));

  // Register and attach to page
  const annotRef = pdfDoc.context.register(annot);

  let annotsArray = page.node.get(PDFName.of('Annots')) as PDFArray | undefined;
  if (!annotsArray) {
    annotsArray = pdfDoc.context.obj([]) as PDFArray;
    page.node.set(PDFName.of('Annots'), annotsArray);
  }
  annotsArray.push(annotRef);
}

// ─── Main Export Function ─────────────────────────────────────────────────────

export async function exportAnnotatedPdf(
  sourceBytes: Uint8Array,
  annotations: Annotation[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();

  // Group annotations by page
  const byPage = new Map<number, Annotation[]>();
  for (const ann of annotations) {
    if (!byPage.has(ann.page)) byPage.set(ann.page, []);
    byPage.get(ann.page)!.push(ann);
  }

  for (const [pageNum, anns] of byPage) {
    const pageIndex = pageNum - 1; // 0-indexed
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    for (const ann of anns) {
      if (ann.type === 'Highlight') {
        injectHighlight(page, ann);
      }
    }
  }

  return pdfDoc.save();
}

/**
 * Download exported PDF to user's machine.
 */
export async function downloadAnnotatedPdf(
  sourceBytes: Uint8Array,
  annotations: Annotation[],
  filename: string
): Promise<void> {
  const exported = await exportAnnotatedPdf(sourceBytes, annotations);
  const blob = new Blob([new Uint8Array(exported.buffer as ArrayBuffer)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace('.pdf', '') + '.annotated.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Get source PDF bytes from a File object or URL.
 */
export async function getPdfBytes(file: File | null, url: string | null): Promise<Uint8Array | null> {
  if (file) {
    return new Uint8Array(await file.arrayBuffer());
  }
  if (url) {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  return null;
}
