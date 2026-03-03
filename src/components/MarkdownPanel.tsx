/**
 * MarkdownPanel — Enterprise Edition
 *
 * Two top-level tabs:
 *   - Annotations: existing page-card UI (unchanged)
 *   - Notes: react-markdown view / raw textarea edit / split mode
 *
 * Notes tab sub-modes: 'view' | 'edit' | 'split' (default)
 * Bidirectional link: clicking a highlight heading → scrollToAnnotation()
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAnnotationStore } from '../store/annotationStore';
import { useNotesStore } from '../store/notesStore';
import { splitAutoBlock } from '../engine/markdownEngine';
import type { Annotation } from '../types/annotation';
import type { NotesPanelMode } from '../types/annotation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rgbToCss(color: [number, number, number], alpha = 1): string {
  return `rgba(${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)},${alpha})`;
}

function sortByPosition(anns: Annotation[]): Annotation[] {
  return [...anns].sort((a, b) => {
    const yDiff = b.rect[3] - a.rect[3];
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.rect[0] - b.rect[0];
  });
}

// ─── AnnRow ───────────────────────────────────────────────────────────────────

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

  const dotColor = rgbToCss(ann.color);
  const dotBg = rgbToCss(ann.color, 0.2);
  const save = () => { updateAnnotation(ann.id, { contents: comment }); setEditing(false); };

  return (
    <div className={`ann-row ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(ann.id)}>
      <span className="ann-row-idx" style={{ background: dotBg, color: dotColor }}>{index}</span>

      <div className="ann-row-body">
        {ann.extractedText && <span className="ann-row-mark">{ann.extractedText}</span>}

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

      <button
        className="ann-item-delete"
        onClick={e => { e.stopPropagation(); deleteAnnotation(ann.id); }}
        title="Delete"
      >✕</button>
    </div>
  );
};

// ─── PageCard ─────────────────────────────────────────────────────────────────

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
      <div className="page-card-header">
        <button className="ann-page-link" onClick={() => onJumpPage(page)} title={`Scroll to page ${page}`}>
          Page {page}<span className="ann-page-arrow">↗</span>
        </button>
        <span className="page-card-count">{anns.length} note{anns.length !== 1 ? 's' : ''}</span>
        {hasUnsaved && <span className="ann-unsaved-dot" title="Unsaved changes">●</span>}
      </div>
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

// ─── NotesTabContent ──────────────────────────────────────────────────────────

const NotesTabContent: React.FC = () => {
  const { markdown, mode, isSaving, isDirty, setMarkdown, setMode, exportMd } = useNotesStore();
  const { scrollToAnnotation, saveAll, annotations } = useAnnotationStore();

  // Sorted annotation IDs — same order buildAutoSection renders blockquotes
  const sortedIds = useMemo(() =>
    [...annotations]
      .sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        const yDiff = b.rect[3] - a.rect[3];
        if (Math.abs(yDiff) > 4) return yDiff;
        return a.rect[0] - b.rect[0];
      })
      .map(a => a.id),
    [annotations]
  );

  // Debounced textarea → store sync
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleEdit = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setMarkdown(val), 300);
  }, [setMarkdown]);

  // Local textarea value — syncs from store when markdown changes
  const [localMd, setLocalMd] = useState(markdown);
  useEffect(() => { setLocalMd(markdown); }, [markdown]);

  const handleSave = useCallback(async () => { await saveAll(); }, [saveAll]);

  // Split around AUTO block so we render highlights with a custom blockquote
  const [beforeAuto, autoContent, afterAuto] = useMemo(
    () => splitAutoBlock(markdown),
    [markdown]
  );

  // Counter ref reset each render — nth blockquote in auto section = sortedIds[n]
  const bqCounter = useRef(0);
  const HighlightBlockquote = useCallback(
    ({ children }: React.PropsWithChildren) => {
      const idx = bqCounter.current++;
      const id = sortedIds[idx];
      return (
        <blockquote
          className="notes-hl-quote"
          onClick={id ? () => scrollToAnnotation(id) : undefined}
          title={id ? 'Click to jump to this highlight in the PDF' : undefined}
        >
          {children}
        </blockquote>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedIds, scrollToAnnotation]
  );

  const modes: { key: NotesPanelMode; label: string }[] = [
    { key: 'view', label: '👁 View' },
    { key: 'split', label: '⊟ Split' },
    { key: 'edit', label: '✏️ Edit' },
  ];

  const renderNotes = () => {
    bqCounter.current = 0;
    return (
      <>
        <ReactMarkdown>{beforeAuto}</ReactMarkdown>
        <ReactMarkdown components={{ blockquote: HighlightBlockquote }}>
          {autoContent}
        </ReactMarkdown>
        <ReactMarkdown>{afterAuto}</ReactMarkdown>
      </>
    );
  };

  return (
    <div className="notes-tab-content">
      {/* Mode bar */}
      <div className="notes-mode-bar">
        <div className="notes-mode-btns">
          {modes.map(m => (
            <button
              key={m.key}
              className={`notes-mode-btn ${mode === m.key ? 'active' : ''}`}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="notes-mode-actions">
          <button
            className={`notes-save-btn ${isDirty ? 'dirty' : ''}`}
            onClick={handleSave}
            disabled={isSaving}
            title="Save notes + annotations"
          >
            {isSaving ? '⏳' : '💾'} Save
          </button>
          <button className="notes-export-btn" onClick={exportMd} title="Export as .md file">
            ↓ .md
          </button>
        </div>
      </div>

      {/* Panel body */}
      <div className={`notes-body notes-body--${mode}`}>
        {(mode === 'view' || mode === 'split') && (
          <div className="notes-rendered">
            {renderNotes()}
          </div>
        )}
        {(mode === 'edit' || mode === 'split') && (
          <textarea
            className="notes-editor"
            value={localMd}
            onChange={e => {
              setLocalMd(e.target.value);
              handleEdit(e.target.value);
            }}
            spellCheck={false}
            placeholder="Write your notes here…"
          />
        )}
      </div>
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const MarkdownPanel: React.FC = () => {
  const {
    annotations, isPanelOpen, togglePanel,
    selectedAnnotationId, selectAnnotation, scrollToAnnotation,
  } = useAnnotationStore();
  const { activeTab, setActiveTab, isDirty } = useNotesStore();

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
    const first = annotations.find(a => a.page === page);
    if (first) scrollToAnnotation(first.id);
  };

  return (
    <div className="markdown-panel">
      {/* Top-level tab bar */}
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === 'annotations' ? 'active' : ''}`}
          onClick={() => setActiveTab('annotations')}
        >
          🖊 Annotations
          {annotations.length > 0 && (
            <span className="panel-tab-badge">{annotations.length}</span>
          )}
        </button>
        <button
          className={`panel-tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          📝 Notes
          {isDirty && <span className="panel-tab-dot" title="Unsaved changes">●</span>}
        </button>

        {/* Close panel button */}
        <button
          className="panel-close-btn"
          onClick={togglePanel}
          title="Close panel"
          aria-label="Close notes panel"
        >
          ✕
        </button>
      </div>

      {/* Annotations tab */}
      {activeTab === 'annotations' && (
        <>
          <div className="panel-header">
            <span className="panel-count">
              {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
              {pageGroups.length > 0 && ` · ${pageGroups.length} page${pageGroups.length !== 1 ? 's' : ''}`}
            </span>
          </div>

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

          <div className="panel-stats">
            {annotations.some(a => !a.saved) && (
              <span className="unsaved-label">● Unsaved changes</span>
            )}
          </div>
        </>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && <NotesTabContent />}
    </div>
  );
};
