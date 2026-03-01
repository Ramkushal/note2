/**
 * PdfViewer component
 * Orchestrates multi-page rendering with virtualization via IntersectionObserver.
 * Handles drag-and-drop PDF loading.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePdfLoader } from '../hooks/usePdfLoader';
import { useAnnotationStore } from '../store/annotationStore';
import { PdfPage } from './PdfPage';

interface PdfViewerProps {
  file: File | null;
  url: string | null;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, url }) => {
  const { pdfDoc, numPages, loading, error } = usePdfLoader(file, url);
  const { scale, setTotalPages, setCurrentPage, scrollTrigger } = useAnnotationStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));

  // Inform store of total pages
  useEffect(() => {
    if (numPages) setTotalPages(numPages);
  }, [numPages, setTotalPages]);

  // IntersectionObserver for page virtualization
  useEffect(() => {
    if (!numPages) return;
    pageRefs.current = pageRefs.current.slice(0, numPages);

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages(prev => {
          const next = new Set(prev);
          for (const entry of entries) {
            const page = parseInt((entry.target as HTMLElement).dataset.page ?? '0', 10);
            if (!page) continue;
            if (entry.isIntersecting) {
              next.add(page);
              // Preload neighbors
              if (page > 1) next.add(page - 1);
              if (page < numPages) next.add(page + 1);
            }
          }
          return next;
        });

        // Track current page (topmost visible)
        const visible = entries
          .filter(e => e.isIntersecting)
          .map(e => parseInt((e.target as HTMLElement).dataset.page ?? '0', 10))
          .filter(Boolean)
          .sort((a, b) => a - b);
        if (visible.length > 0) setCurrentPage(visible[0]);
      },
      { root: containerRef.current, threshold: 0.1 }
    );

    pageRefs.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [numPages, setCurrentPage]);

  const scrollToPage = useCallback((pageNum: number) => {
    const el = pageRefs.current[pageNum - 1];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Watch scrollTrigger from store (fired by MarkdownPanel item clicks)
  useEffect(() => {
    if (!scrollTrigger) return;
    scrollToPage(scrollTrigger.page);
  }, [scrollTrigger, scrollToPage]);

  if (!file && !url) {
    return (
      <div className="pdf-drop-zone">
        <div className="drop-zone-inner">
          <div className="drop-icon">📄</div>
          <p className="drop-title">Drop a PDF here</p>
          <p className="drop-sub">or use the Open button in the toolbar</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pdf-loading-state">
        <div className="spinner-large" />
        <p>Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-error-state">
        <div className="error-icon">⚠️</div>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container" ref={containerRef}>
      {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
        <div
          key={pageNum}
          ref={el => { pageRefs.current[pageNum - 1] = el; }}
          data-page={pageNum}
          className="pdf-page-scroll-anchor"
        >
          <PdfPage
            pdfDoc={pdfDoc}
            pageNumber={pageNum}
            scale={scale}
            isVisible={visiblePages.has(pageNum)}
          />
        </div>
      ))}
    </div>
  );
};
