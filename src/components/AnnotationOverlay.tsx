/**
 * AnnotationOverlay component
 * Renders highlight rectangles over the PDF canvas.
 * Clicking a highlight selects it in the panel — no tooltip popup.
 */

import React from 'react';
import type { Annotation } from '../types/annotation';
import { pdfToDomPoint } from '../engine/geometry';
import { useAnnotationStore } from '../store/annotationStore';

interface AnnotationOverlayProps {
  annotations: Annotation[];
  viewport: { width: number; height: number; scale: number };
  pageNumber: number;
}

function rgbaToCss(color: [number, number, number], alpha: number): string {
  return `rgba(${Math.round(color[0]*255)},${Math.round(color[1]*255)},${Math.round(color[2]*255)},${alpha})`;
}

function quadToDomRect(quad: number[], viewport: { width: number; height: number; scale: number }) {
  const [domX1, domY1] = pdfToDomPoint(quad[0], quad[1], viewport); // UL
  const [domX2, domY2] = pdfToDomPoint(quad[2], quad[5], viewport); // UR x, LL y
  return {
    left:   Math.min(domX1, domX2),
    top:    Math.min(domY1, domY2),
    width:  Math.abs(domX2 - domX1),
    height: Math.abs(domY2 - domY1),
  };
}

function splitQuads(quadPoints: number[]): number[][] {
  const quads: number[][] = [];
  for (let i = 0; i + 7 < quadPoints.length; i += 8)
    quads.push(quadPoints.slice(i, i + 8));
  return quads;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({ annotations, viewport }) => {
  const { selectedAnnotationId, selectAnnotation } = useAnnotationStore();

  return (
    <div
      className="annotation-overlay"
      style={{ width: viewport.width, height: viewport.height }}
      onClick={() => selectAnnotation(null)}
    >
      {annotations.map(ann => {
        const isSelected = selectedAnnotationId === ann.id;
        return splitQuads(ann.quadPoints).map((quad, qi) => {
          const dr = quadToDomRect(quad, viewport);
          return (
            <div
              key={`${ann.id}-${qi}`}
              className={`highlight-rect ${isSelected ? 'selected' : ''}`}
              style={{
                left:            dr.left,
                top:             dr.top,
                width:           dr.width,
                height:          dr.height,
                backgroundColor: rgbaToCss(ann.color, isSelected ? 0.55 : 0.35),
                borderBottom:    `2px solid ${rgbaToCss(ann.color, 0.85)}`,
              }}
              onClick={e => { e.stopPropagation(); selectAnnotation(ann.id); }}
              title={ann.extractedText || ann.contents}
            />
          );
        });
      })}
    </div>
  );
};
