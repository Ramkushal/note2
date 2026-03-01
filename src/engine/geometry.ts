/**
 * Annotation Geometry Engine
 * - Convert DOM selection → PDF QuadPoints + Rect
 * - Compute bounding rects in PDF coordinate space
 */

// ─── Coordinate Conversion ────────────────────────────────────────────────────

/** Convert a DOM point (px from top-left of canvas) to PDF user-space coords */
export function domToPdfPoint(
  domX: number,
  domY: number,
  viewport: { width: number; height: number; scale: number }
): [number, number] {
  return [domX / viewport.scale, (viewport.height - domY) / viewport.scale];
}

/** Convert a PDF point back to DOM (canvas) coordinates */
export function pdfToDomPoint(
  pdfX: number,
  pdfY: number,
  viewport: { width: number; height: number; scale: number }
): [number, number] {
  return [pdfX * viewport.scale, viewport.height - pdfY * viewport.scale];
}

// ─── QuadPoint Helpers ────────────────────────────────────────────────────────

/**
 * Build QuadPoints array from DOM selection rects.
 * PDF spec: 8 numbers per quad — UL, UR, LL, LR in PDF coordinate space.
 */
export function buildQuadPoints(
  rects: DOMRect[],
  canvasRect: DOMRect,
  viewport: { width: number; height: number; scale: number }
): number[] {
  const quads: number[] = [];
  for (const r of rects) {
    const relLeft   = r.left   - canvasRect.left;
    const relTop    = r.top    - canvasRect.top;
    const relRight  = r.right  - canvasRect.left;
    const relBottom = r.bottom - canvasRect.top;

    const [x1, y1Top] = domToPdfPoint(relLeft,  relTop,    viewport);
    const [x2, y1Bot] = domToPdfPoint(relRight, relBottom, viewport);

    const yTop = Math.max(y1Top, y1Bot);
    const yBot = Math.min(y1Top, y1Bot);

    quads.push(x1, yTop, x2, yTop, x1, yBot, x2, yBot);
  }
  return quads;
}

/**
 * Compute bounding rect [x1,y1,x2,y2] in PDF space from a QuadPoints array.
 */
export function quadPointsToRect(quadPoints: number[]): [number, number, number, number] {
  if (quadPoints.length < 8) return [0, 0, 0, 0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < quadPoints.length; i += 2) {
    const x = quadPoints[i], y = quadPoints[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
