/**
 * MarkdownPanel component
 * Groups annotations by page into one card per page.
 * Within each page, annotations are sorted top-to-bottom, left-to-right
 * (matching their visual order in the PDF).
 * Clicking the page badge scrolls the PDF to that page.
 */

import React, { useMemo, useState } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { downloadMarkdown } from '../engine/markdownEngine';
import type { Annotation } from '../types/annotation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rgbToCss(color: [number, number, number], alpha = 1): string {
  return `rgba(${Math.round(color[0]*255)},${Math.round(color[1]*255)},${Math.round(color[2]*255)},${alpha})`;
}

/**
 * Sort annotations within a page top-to-bottom, left-to-right.
 * rect = [x1, y1, x2, y2] in PDF user space (Y origin = bottom-left).
 * Higher y2 = higher on the page → sort descending.
 */
function sortByPosition(anns: Annotation[]): Annotation[] {
  return [...anns].sort((a, b) => {
    const yDiff = b.rect[3] - a.rect[3]; // descending y2
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.rect[0] - b.rect[0];        // ascending x1 for same line
  });
}

// ─── Single annotation row inside a page card ─────────────────────────────────

interface AnnRowProps {
  ann: Annotation;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const AnnRow: React.FC<AnnRowProps> = ({ ann, index, isSelected, onSelect }) => {
  const { updateAnnotation, deleteAnnotation } = useAnnotationStore();
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(ann.contents);

  const dotColor  = rgbToCss(ann.color);
  const dotBg     = rgbToCss(ann.color, 0.2);

  const save = () => { updateAnnotation(ann.id, { contents: comment }); setEditing(false); };

  return (
    <div
      className={`ann-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(ann.id)}
    >
      {/* index bubble */}
      <span className="ann-row-idx" style={{ background: dotBg, color: dotColor }}>
        {index}
      </span>

      <div className="ann-row-body">
        {/* highlighted text */}
        {ann.extractedText && (
          <span className="ann-row-mark">
            {ann.extractedText}
          </span>
        )}

        {/* comment */}
        {editing ? (
          <div className="ann-comment-editor" onClick={e => e.stopPropagation()}>
            <textarea
              className="ann-comment-input"
              value={comment}
              autoFocus
              rows={2}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) save(); }}
            />
            <div className="ann-comment-actions">
              <button className="ann-save-btn" onClick={save}>Save</button>
              <button className="ann-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`ann-row-note ${!ann.contents ? 'empty' : ''}`}
            onClick={e => { e.stopPropagation(); setEditing(true); }}
            title="Click to edit note"
          >
            {ann.contents || <em>Add a note…</em>}
          </div>
        )}
      </div>

      {/* delete */}
      <button
        className="ann-item-delete"
        onClick={e => { e.stopPropagation(); deleteAnnotation(ann.id); }}
        title="Delete"
      >
        ✕
      </button>
    </div>
  );
};

// ─── One card per page ────────────────────────────────────────────────────────

interface PageCardProps {
  page: number;
  anns: Annotation[];
  selectedId: string | null;
  onJumpPage: (page: number) => void;
  onSelect: (id: string) => void;
}

const PageCard: React.FC<PageCardProps> = ({ page, anns, selectedId, onJumpPage, onSelect }) => {
  const hasUnsaved = anns.some(a => !a.saved);
  const sorted = sortByPosition(anns);

  return (
    <div className="page-card">
      {/* card header */}
      <div className="page-card-header">
        <button
          className="ann-page-link"
          onClick={() => onJumpPage(page)}
          title={`Scroll to page ${page}`}
        >
          Page {page}
          <span className="ann-page-arrow">↗</span>
        </button>
        <span className="page-card-count">{anns.length} note{anns.length !== 1 ? 's' : ''}</span>
        {hasUnsaved && <span className="ann-unsaved-dot" title="Unsaved changes">●</span>}
      </div>

      {/* annotation rows */}
      <div className="page-card-rows">
        {sorted.map((ann, i) => (
          <AnnRow
            key={ann.id}
            ann={ann}
            index={i + 1}
            isSelected={selectedId === ann.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Panel ────────────────────────────────────────────────────────────────────

export const MarkdownPanel: React.FC = () => {
  const {
    annotations, isPanelOpen, getDocumentAnnotations,
    selectedAnnotationId, selectAnnotation, scrollToAnnotation,
  } = useAnnotationStore();

  // Group by page, sorted page-ascending
  const pageGroups = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const ann of annotations) {
      if (!map.has(ann.page)) map.set(ann.page, []);
      map.get(ann.page)!.push(ann);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [annotations]);

  if (!isPanelOpen) return null;

  const handleJumpPage = (page: number) => {
    // find first annotation on that page and use scrollToAnnotation
    const first = annotations.find(a => a.page === page);
    if (first) scrollToAnnotation(first.id);
  };

  return (
    <div className="markdown-panel">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">📝 Notes</span>
        <span className="panel-count">
          {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          {pageGroups.length > 0 && ` · ${pageGroups.length} page${pageGroups.length !== 1 ? 's' : ''}`}
        </span>
        <button
          className="panel-download"
          onClick={() => downloadMarkdown(getDocumentAnnotations())}
          title="Download .md"
        >
          ↓ .md
        </button>
      </div>

      {/* Body */}
      {annotations.length === 0 ? (
        <div className="panel-empty">
          <div className="empty-icon">🖊</div>
          <p>No annotations yet.</p>
          <p className="empty-hint">
            Select <strong>Highlight</strong> tool and drag over text to create one.
          </p>
        </div>
      ) : (
        <div className="panel-body">
          <div className="page-cards-list">
            {pageGroups.map(([page, anns]) => (
              <PageCard
                key={page}
                page={page}
                anns={anns}
                selectedId={selectedAnnotationId}
                onJumpPage={handleJumpPage}
                onSelect={selectAnnotation}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="panel-stats">
        {annotations.some(a => !a.saved) && (
          <span className="unsaved-label">● Unsaved changes</span>
        )}
      </div>
    </div>
  );
};
