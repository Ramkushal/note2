/**
 * PdfPage component
 * Renders a single PDF page:
 *  - Canvas (static PDF rendering via pdfjs-dist v5)
 *  - Text layer (manually positioned spans for selection)
 *  - Annotation overlay (dynamic React layer)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AnnotationOverlay } from './AnnotationOverlay';
import { useHighlightSelection } from '../hooks/useHighlightSelection';
import { useAnnotationStore } from '../store/annotationStore';
import type { Annotation } from '../types/annotation';

// Set up worker (done once at module level)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfPageProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc: any;
  pageNumber: number;
  scale: number;
  isVisible: boolean;
}

// ─── Manual text layer builder ─────────────────────────────────────────────
//
// Each PDF text item has a transform [a, b, c, d, tx, ty] (affine matrix).
// We convert it to a CSS matrix and position the span at the glyph baseline.
// This is the same approach pdfjs-dist used before removing renderTextLayer.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTextLayer(container: HTMLDivElement, textContent: any, viewport: any) {
  container.innerHTML = '';

  const items = textContent.items as Array<{
    str: string;
    transform: number[];   // [a, b, c, d, tx, ty] PDF user space
    width: number;         // advance width in PDF user space units
    height: number;
    fontName: string;
  }>;

  const s = viewport.scale;
  const vh = viewport.height; // canvas height in CSS px

  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;

    const [a, b, c, d, tx, ty] = item.transform;

    // Font size = magnitude of the [a,b] column (x-axis scale of the matrix)
    const fontHeight = Math.hypot(a, b);
    if (fontHeight < 0.5) continue; // skip invisible text

    // DOM baseline position: flip Y (PDF origin = bottom-left)
    const domX = tx * s;
    const domY = vh - ty * s;

    // target rendered width in DOM pixels
    const targetWidth = item.width * s;

    // The span naturally renders at some width; we use a scaleX transform
    // after setting font-size so the text spans the correct width.
    // We'll use font-size = fontHeight*s and rely on transform for width.
    const fontSize = fontHeight * s;

    // CSS matrix: scale / rotate from PDF transform, already in screen space
    // We normalise the matrix by fontHeight so font-size does the scaling,
    // then apply the remaining shear / rotation.
    const ma =  a / fontHeight;
    const mb = -b / fontHeight; // flip Y for CSS
    const mc =  c / fontHeight;
    const md = -d / fontHeight; // flip Y for CSS

    const span = document.createElement('span');
    span.textContent = item.str;
    span.style.cssText = [
      'position:absolute',
      `left:${domX}px`,
      `top:${domY}px`,
      `font-size:${fontSize}px`,
      'font-family:sans-serif',
      'color:transparent',
      'white-space:pre',
      'cursor:text',
      'user-select:text',
      '-webkit-user-select:text',
      'transform-origin:0% 0%',
      // matrix(a,b,c,d,tx,ty) — tx/ty are 0 because we use left/top
      `transform:matrix(${ma},${mb},${mc},${md},0,0)`,
    ].join(';');

    // After appending, stretch to match PDF advance width
    container.appendChild(span);
    if (item.width > 0) {
      const naturalW = span.getBoundingClientRect().width;
      if (naturalW > 0) {
        const scaleX = targetWidth / naturalW;
        span.style.transform =
          `matrix(${ma * scaleX},${mb},${mc * scaleX},${md},0,0)`;
      }
    }
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export const PdfPage: React.FC<PdfPageProps> = ({ pdfDoc, pageNumber, scale, isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfPage, setPdfPage] = useState<any>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number; scale: number } | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);

  const { annotations, activeTool, activeColor, addAnnotation } = useAnnotationStore();

  // Filter annotations for this page
  const pageAnnotations: Annotation[] = annotations.filter(a => a.page === pageNumber);

  // Load page
  useEffect(() => {
    if (!pdfDoc || !isVisible) return;
    pdfDoc.getPage(pageNumber).then((page: any) => {
      setPdfPage(page);
    });
  }, [pdfDoc, pageNumber, isVisible]);

  // Render canvas + text layer
  useEffect(() => {
    if (!pdfPage || !canvasRef.current || !textLayerRef.current) return;

    const vp = pdfPage.getViewport({ scale });
    setViewport({ width: vp.width, height: vp.height, scale });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = vp.width;
    canvas.height = vp.height;

    // Cancel any in-progress render
    renderTaskRef.current?.cancel();
    setIsRendering(true);

    const renderTask = pdfPage.render({ canvasContext: ctx, viewport: vp });
    renderTaskRef.current = renderTask;

    renderTask.promise
      .then(async () => {
        setIsRendering(false);
        if (!textLayerRef.current) return;

        const textLayer = textLayerRef.current;
        textLayer.style.width = `${vp.width}px`;
        textLayer.style.height = `${vp.height}px`;

        const textContent = await pdfPage.getTextContent();
        buildTextLayer(textLayer, textContent, vp);
      })
      .catch((err: any) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Render error', err);
        }
        setIsRendering(false);
      });

    return () => {
      renderTaskRef.current?.cancel();
    };
  }, [pdfPage, scale]);

  // Highlight selection handler
  const handleHighlight = useCallback(
    ({ quadPoints, rect, extractedText }: {
      quadPoints: number[];
      rect: [number, number, number, number];
      extractedText: string;
    }) => {
      if (activeTool !== 'highlight') return;
      addAnnotation({
        page: pageNumber,
        type: 'Highlight',
        quadPoints,
        rect,
        color: activeColor,
        contents: '',
        extractedText,
      });
    },
    [activeTool, activeColor, addAnnotation, pageNumber]
  );

  useHighlightSelection({
    canvasRef,
    textLayerRef,
    viewport,
    pdfPage,
    enabled: activeTool === 'highlight',
    onHighlight: handleHighlight,
  });

  if (!isVisible) {
    return (
      <div
        className="pdf-page-placeholder"
        style={{
          height: viewport ? viewport.height : 842,
          width: viewport ? viewport.width : 595,
        }}
      />
    );
  }

  return (
    <div className="pdf-page-wrapper" data-page={pageNumber}>
      <div className="pdf-page-number-badge">Page {pageNumber}</div>
      <div className="pdf-page-inner" style={{ position: 'relative', display: 'inline-block' }}>
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div
          ref={textLayerRef}
          className={`pdf-text-layer ${activeTool === 'highlight' ? 'highlight-mode' : ''}`}
          style={{ position: 'absolute', top: 0, left: 0, overflow: 'hidden' }}
        />
        {viewport && (
          <AnnotationOverlay
            annotations={pageAnnotations}
            viewport={viewport}
            pageNumber={pageNumber}
          />
        )}
        {isRendering && (
          <div className="pdf-page-loading">
            <div className="page-spinner" />
          </div>
        )}
      </div>
    </div>
  );
};
