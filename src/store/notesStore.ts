/**
 * notesStore — Markdown Notes State
 *
 * Separate from annotationStore.
 * Uses full auto-block rebuild on every annotation change
 * (no anchor tags in markdown — bidirectional linking is render-time only).
 */

import { create } from 'zustand';
import type { Annotation, DocumentNotes, NotesPanelMode } from '../types/annotation';
import { saveDocumentNotes, loadDocumentNotes } from '../db/annotationDb';
import {
    buildInitialMarkdown,
    buildAutoSection,
    injectAutoBlock,
    downloadMarkdown,
} from '../engine/markdownEngine';

// ─── State Shape ─────────────────────────────────────────────────────────────

interface NotesState {
    docId: string;
    docName: string;
    version: number;

    markdown: string;
    mode: NotesPanelMode;         // 'split' default
    isSaving: boolean;
    isDirty: boolean;
    activeTab: 'annotations' | 'notes';

    // Actions
    initNotes: (docId: string, docName: string, annotations: Annotation[]) => Promise<void>;
    rebuildAutoBlock: (annotations: Annotation[]) => void;
    setMarkdown: (md: string) => void;
    setMode: (mode: NotesPanelMode) => void;
    setActiveTab: (tab: NotesState['activeTab']) => void;
    saveNotes: () => Promise<void>;
    exportMd: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useNotesStore = create<NotesState>((set, get) => ({
    docId: '',
    docName: '',
    version: 1,
    markdown: '',
    mode: 'split',
    isSaving: false,
    isDirty: false,
    activeTab: 'annotations',

    // ── Init: called when a new PDF is loaded ─────────────────────────────────
    initNotes: async (docId, docName, annotations) => {
        const saved = await loadDocumentNotes(docId);

        if (saved) {
            // Restore persisted notes, then sync auto block with current annotations
            const md = injectAutoBlock(saved.markdown, buildAutoSection(annotations));
            set({ docId, docName, version: saved.version, markdown: md, isDirty: false });
        } else {
            // First time — build scaffold + auto section from existing annotations
            let md = buildInitialMarkdown(docName);
            if (annotations.length > 0) {
                md = injectAutoBlock(md, buildAutoSection(annotations));
            }
            set({ docId, docName, version: 1, markdown: md, isDirty: false });
        }
    },

    // ── Full rebuild of auto block — used on add / update / delete ────────────
    rebuildAutoBlock: (annotations) => {
        const { markdown } = get();
        const newMd = injectAutoBlock(markdown, buildAutoSection(annotations));
        set({ markdown: newMd, isDirty: true });
    },

    // ── Free editing ──────────────────────────────────────────────────────────
    setMarkdown: (md) => set({ markdown: md, isDirty: true }),

    setMode: (mode) => set({ mode }),

    setActiveTab: (tab) => set({ activeTab: tab }),

    // ── Persist to IndexedDB ──────────────────────────────────────────────────
    saveNotes: async () => {
        const { docId, version, markdown } = get();
        if (!docId) return;
        set({ isSaving: true });
        try {
            const notes: DocumentNotes = {
                docId,
                version: version + 1,
                markdown,
                linkedHighlights: [],   // no longer used — kept for DB schema compat
                savedAt: new Date().toISOString(),
            };
            await saveDocumentNotes(notes);
            set({ version: version + 1, isSaving: false, isDirty: false });
        } catch (e) {
            console.error('Notes save failed', e);
            set({ isSaving: false });
        }
    },

    // ── Export as .md file ────────────────────────────────────────────────────
    exportMd: () => {
        const { docName, markdown } = get();
        downloadMarkdown(docName || 'document', markdown);
    },
}));
