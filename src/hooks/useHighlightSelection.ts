/**
 * useHighlightSelection hook
 * Registers a mouseup listener on the text layer.
 *
 * Uses a single combined ref for all mutable values so the listener is only
 * re-registered when `pdfPage` changes (i.e. when the text layer is actually
 * in the DOM), not on every render.
 */

import { useEffect, useRef } from 'react';
import { buildQuadPoints, quadPointsToRect } from '../engine/geometry';

interface UseHighlightSelectionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  textLayerRef: React.RefObject<HTMLDivElement | null>;
  viewport: { width: number; height: number; scale: number } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfPage: any | null;
  enabled: boolean;
  onHighlight: (params: {
    quadPoints: number[];
    rect: [number, number, number, number];
    extractedText: string;
  }) => void;
}

export function useHighlightSelection({
  canvasRef,
  textLayerRef,
  viewport,
  pdfPage,
  enabled,
  onHighlight,
}: UseHighlightSelectionOptions) {
  // Single combined ref — always current, prevents stale closures
  const latest = useRef({ enabled, viewport, onHighlight });
  latest.current = { enabled, viewport, onHighlight };

  useEffect(() => {
    // pdfPage becomes non-null exactly when the text layer is in the DOM.
    // This guarantees textLayerRef.current is valid before we attach.
    if (!pdfPage) return;
    const el = textLayerRef.current;
    if (!el) return;

    const handler = () => {
      const { enabled, viewport, onHighlight } = latest.current;
      if (!enabled || !viewport || !canvasRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;

      const extractedText = selection.toString().trim();
      if (!extractedText) return;

      const range = selection.getRangeAt(0);
      const validRects = Array.from(range.getClientRects()).filter(r => r.width > 1 && r.height > 1);
      if (validRects.length === 0) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const quadPoints = buildQuadPoints(validRects, canvasRect, viewport);
      if (quadPoints.length === 0) return;

      selection.removeAllRanges();
      onHighlight({ quadPoints, rect: quadPointsToRect(quadPoints), extractedText });
    };

    el.addEventListener('mouseup', handler);
    return () => el.removeEventListener('mouseup', handler);
  // Re-register only when the page loads (text layer becomes available).
  // enabled/viewport/onHighlight changes are handled via latest.current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPage]);
}
