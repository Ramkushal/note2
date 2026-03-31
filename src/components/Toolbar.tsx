/**
 * Toolbar component — app-level top bar
 * Controls: open PDF, save, export, panel toggles, theme.
 * PDF-specific controls (tools, zoom, page nav) live in ViewerToolbar.
 */

import React, { useRef } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { useNotesStore } from '../store/notesStore';
import { downloadAnnotationsJson, importAnnotationsFromJson } from '../db/annotationDb';
import { downloadAnnotatedPdf, getPdfBytes } from '../engine/pdfExport';
import { downloadMarkdown } from '../engine/markdownEngine';

interface ToolbarProps {
  onFileOpen: (file: File) => void;
  onUrlOpen?: (url: string, name: string) => void;
  isDark: boolean;
  onThemeToggle: () => void;
  isViewerOpen: boolean;
  onViewerToggle: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onFileOpen, isDark, onThemeToggle, isViewerOpen, onViewerToggle }) => {
  const store = useAnnotationStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
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
    const { markdown } = useNotesStore.getState();
    downloadMarkdown(docName || 'document', markdown);
  };

  const handleImportJson = async () => {
    const doc = await importAnnotationsFromJson();
    if (!doc) return;
    const { saveDocumentAnnotations } = await import('../db/annotationDb');
    await saveDocumentAnnotations(doc);
    await store.loadFromDb(doc.docId);
  };

  const saveLabel =
    saveStatus === 'saving' ? '⟳ Saving…' :
      saveStatus === 'saved' ? '✓ Saved' :
        saveStatus === 'error' ? '✗ Error' : '↑ Save';

  return (
    <div className="toolbar">

      {/* ── Brand ── */}
      <div className="toolbar-brand">
        <img src="./logo.png" alt="A'note logo" className="brand-logo" />
        <span className="brand-name">A'note</span>
      </div>

      {/* ── File open ── */}
      <div className="toolbar-group">
        <button className="tb-btn" title="Open PDF (Ctrl+O)" onClick={() => fileInputRef.current?.click()}>
          📂 Open
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
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

        <div className="toolbar-divider" />

        {/* PDF viewer toggle */}
        <button
          className={`tb-btn panel-toggle ${isViewerOpen ? 'active' : ''}`}
          onClick={onViewerToggle}
          title="Toggle PDF viewer"
        >
          📄 PDF
        </button>

        {/* Notes panel toggle */}
        <button
          className={`tb-btn panel-toggle ${isPanelOpen ? 'active' : ''}`}
          onClick={togglePanel}
          title="Toggle Notes panel"
        >
          ≡ Notes
        </button>

        <div className="toolbar-divider" />

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
