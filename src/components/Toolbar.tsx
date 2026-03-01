/**
 * Toolbar component
 * Top bar: open PDF, zoom controls, tool selection, color picker,
 * save, export PDF, export MD, page navigation.
 */

import React, { useRef } from 'react';
import { useAnnotationStore, COLOR_PRESETS } from '../store/annotationStore';
import { downloadAnnotationsJson, importAnnotationsFromJson } from '../db/annotationDb';
import { downloadAnnotatedPdf, getPdfBytes } from '../engine/pdfExport';
import { downloadMarkdown } from '../engine/markdownEngine';

interface ToolbarProps {
  onFileOpen: (file: File) => void;
  onUrlOpen?: (url: string, name: string) => void;
  isDark: boolean;
  onThemeToggle: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onFileOpen, isDark, onThemeToggle }) => {
  const store = useAnnotationStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    scale, setScale,
    activeTool, setActiveTool,
    activeColor, setActiveColor,
    currentPage, totalPages, setCurrentPage,
    saveAll, saveStatus, isSaving,
    annotations, docName, pdfFile, pdfUrl,
    getDocumentAnnotations, isPanelOpen, togglePanel,
  } = store;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileOpen(file);
    e.target.value = '';
  };

  const handleSave = async () => { await saveAll(); };

  const handleExportJson = () => {
    const doc = getDocumentAnnotations();
    downloadAnnotationsJson(doc);
  };

  const handleExportPdf = async () => {
    const bytes = await getPdfBytes(pdfFile, pdfUrl);
    if (!bytes) { alert('No PDF loaded'); return; }
    await downloadAnnotatedPdf(bytes, annotations, docName || 'document');
  };

  const handleExportMarkdown = () => {
    const doc = getDocumentAnnotations();
    downloadMarkdown(doc);
  };

  const handleImportJson = async () => {
    const doc = await importAnnotationsFromJson();
    if (!doc) return;
    const { saveDocumentAnnotations } = await import('../db/annotationDb');
    await saveDocumentAnnotations(doc);
    await store.loadFromDb(doc.docId);
  };

  const zoomIn  = () => setScale(Math.min(scale + 0.25, 4));
  const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));
  const zoomReset = () => setScale(1.5);

  const saveLabel =
    saveStatus === 'saving' ? '⟳ Saving…' :
    saveStatus === 'saved'  ? '✓ Saved'   :
    saveStatus === 'error'  ? '✗ Error'   : '↑ Save';

  return (
    <div className="toolbar">

      {/* ── Brand ── */}
      <div className="toolbar-brand">
        <div className="brand-icon">📑</div>
        <span className="brand-name">PDF<span>Annotator</span></span>
      </div>

      {/* ── File open ── */}
      <div className="toolbar-group">
        <button className="tb-btn" title="Open PDF (Ctrl+O)" onClick={() => fileInputRef.current?.click()}>
          📂 Open
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      <div className="toolbar-divider" />

      {/* ── Tool segment control ── */}
      <div className="tool-segment">
        <button
          className={`tool-pill ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          title="Select (V)"
        >
          <span className="tool-pill-icon">◻</span> Select
        </button>
        <button
          className={`tool-pill ${activeTool === 'highlight' ? 'active' : ''}`}
          onClick={() => setActiveTool('highlight')}
          title="Highlight (H)"
        >
          <span className="tool-pill-icon">🖊</span> Highlight
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* ── Color swatches ── */}
      <div className="toolbar-group color-group">
        {COLOR_PRESETS.map(({ label, color }) => (
          <button
            key={label}
            className={`color-swatch ${JSON.stringify(activeColor) === JSON.stringify(color) ? 'active' : ''}`}
            title={label}
            style={{ backgroundColor: `rgb(${Math.round(color[0]*255)},${Math.round(color[1]*255)},${Math.round(color[2]*255)})` }}
            onClick={() => setActiveColor(color)}
          />
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* ── Zoom ── */}
      <div className="toolbar-group zoom-group">
        <button className="zoom-btn" onClick={zoomOut} title="Zoom out (−)" disabled={scale <= 0.5}>−</button>
        <button className="zoom-label" onClick={zoomReset} title="Reset zoom">
          {Math.round(scale * 100)}%
        </button>
        <button className="zoom-btn" onClick={zoomIn} title="Zoom in (+)" disabled={scale >= 4}>+</button>
      </div>

      <div className="toolbar-divider" />

      {/* ── Page nav ── */}
      <div className="toolbar-group page-nav">
        <button
          className="page-btn"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          title="Previous page"
        >‹</button>
        <span className="page-indicator">{currentPage} / {totalPages || '—'}</span>
        <button
          className="page-btn"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          title="Next page"
        >›</button>
      </div>

      <div className="toolbar-spacer" />

      {/* ── Right actions ── */}
      <div className="toolbar-group">

        {/* Save CTA */}
        <button
          className={`tb-btn save-btn ${saveStatus}`}
          onClick={handleSave}
          disabled={isSaving}
          title="Save annotations"
        >
          {saveLabel}
        </button>

        {/* Export dropdown */}
        <div className="export-menu-wrapper">
          <details className="export-menu">
            <summary className="tb-btn export-btn">Export ▾</summary>
            <div className="export-dropdown">
              <button onClick={handleExportJson}>📋 Annotations JSON</button>
              <button onClick={handleExportPdf}>📄 Annotated PDF</button>
              <button onClick={handleExportMarkdown}>📝 Markdown</button>
              <div className="export-divider" />
              <button onClick={handleImportJson}>📥 Import JSON</button>
            </div>
          </details>
        </div>

        {/* Notes panel toggle */}
        <button
          className={`tb-btn panel-toggle ${isPanelOpen ? 'active' : ''}`}
          onClick={togglePanel}
          title="Toggle Notes panel"
        >
          ≡ Notes
        </button>

        {/* Theme toggle */}
        <button
          className="theme-toggle"
          onClick={onThemeToggle}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>

      </div>
    </div>
  );
};
