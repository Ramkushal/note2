import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Annotation, AppUser, AuditEntry, DocumentAnnotations } from '../types/annotation';
import { saveDocumentAnnotations, loadDocumentAnnotations, addAuditEntry, makeDocId } from '../db/annotationDb';

// ─── State Shape ────────────────────────────────────────────────────────────

interface AnnotationState {
  // Document
  docName: string;
  docId: string;
  docVersion: number;
  pdfFile: File | null;
  pdfUrl: string | null;

  // User
  currentUser: AppUser;

  // Annotations
  annotations: Annotation[];
  selectedAnnotationId: string | null;

  // UI
  currentPage: number;
  totalPages: number;
  scale: number;
  activeTool: 'select' | 'highlight' | 'underline' | 'note';
  activeColor: [number, number, number];
  isPanelOpen: boolean;
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  // Scroll-to-annotation trigger (set by MarkdownPanel, consumed by PdfViewer)
  scrollTrigger: { annotationId: string; page: number; ts: number } | null;

  // Actions
  setPdfFile: (file: File) => Promise<void>;
  setPdfUrl: (url: string, name: string) => Promise<void>;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setScale: (scale: number) => void;
  setActiveTool: (tool: AnnotationState['activeTool']) => void;
  setActiveColor: (color: [number, number, number]) => void;
  togglePanel: () => void;
  setCurrentUser: (user: AppUser) => void;

  addAnnotation: (partial: Omit<Annotation, 'id' | 'author' | 'createdAt' | 'updatedAt' | 'version' | 'saved'>) => Annotation;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  scrollToAnnotation: (id: string) => void;

  saveAll: () => Promise<void>;
  loadFromDb: (docId: string) => Promise<void>;
  getDocumentAnnotations: () => DocumentAnnotations;

  auditLog: AuditEntry[];
  addAudit: (entry: Omit<AuditEntry, 'user' | 'timestamp'>) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  docName: '',
  docId: '',
  docVersion: 1,
  pdfFile: null,
  pdfUrl: null,
  currentUser: { name: 'User', color: [1, 0.84, 0] },
  annotations: [],
  selectedAnnotationId: null,
  currentPage: 1,
  totalPages: 0,
  scale: 1.5,
  activeTool: 'highlight',
  activeColor: [1, 0.95, 0.2],
  isPanelOpen: true,
  isSaving: false,
  saveStatus: 'idle',
  scrollTrigger: null,
  auditLog: [],

  setPdfFile: async (file: File) => {
    const docId = makeDocId(file.name);
    set({ pdfFile: file, pdfUrl: null, docName: file.name, docId, docVersion: 1, annotations: [], currentPage: 1 });
    await get().loadFromDb(docId);
  },

  setPdfUrl: async (url: string, name: string) => {
    const docId = makeDocId(name);
    set({ pdfUrl: url, pdfFile: null, docName: name, docId, docVersion: 1, annotations: [], currentPage: 1 });
    await get().loadFromDb(docId);
  },

  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (pages) => set({ totalPages: pages }),
  setScale: (scale) => set({ scale }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColor: (color) => set({ activeColor: color }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  setCurrentUser: (user) => set({ currentUser: user }),

  addAnnotation: (partial) => {
    const { currentUser, annotations, docVersion } = get();
    const now = new Date().toISOString();
    const annotation: Annotation = {
      ...partial,
      id: uuidv4(),
      author: currentUser.name,
      createdAt: now,
      updatedAt: now,
      version: docVersion,
      saved: false,
    };
    set({ annotations: [...annotations, annotation] });
    get().addAudit({ action: 'create_highlight', page: annotation.page, annotationId: annotation.id });
    return annotation;
  },

  updateAnnotation: (id, patch) => {
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
      ),
    }));
    get().addAudit({ action: 'update_highlight', page: get().annotations.find(a => a.id === id)?.page ?? 0, annotationId: id });
  },

  deleteAnnotation: (id) => {
    const ann = get().annotations.find(a => a.id === id);
    get().addAudit({ action: 'delete_highlight', page: ann?.page ?? 0, annotationId: id });
    set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id), selectedAnnotationId: null }));
  },

  selectAnnotation: (id) => set({ selectedAnnotationId: id }),

  scrollToAnnotation: (id) => {
    const ann = get().annotations.find(a => a.id === id);
    if (!ann) return;
    set({ selectedAnnotationId: id, scrollTrigger: { annotationId: id, page: ann.page, ts: Date.now() } });
  },

  saveAll: async () => {
    set({ isSaving: true, saveStatus: 'saving' });
    try {
      const doc = get().getDocumentAnnotations();
      await saveDocumentAnnotations(doc);
      set((s) => ({
        isSaving: false,
        saveStatus: 'saved',
        docVersion: s.docVersion + 1,
        annotations: s.annotations.map((a) => ({ ...a, saved: true })),
      }));
      get().addAudit({ action: 'save', page: 0 });
      setTimeout(() => set({ saveStatus: 'idle' }), 2000);
    } catch (e) {
      console.error('Save failed', e);
      set({ isSaving: false, saveStatus: 'error' });
    }
  },

  loadFromDb: async (docId: string) => {
    const doc = await loadDocumentAnnotations(docId);
    if (doc) {
      set({ annotations: doc.annotations, docVersion: doc.version + 1 });
    }
  },

  getDocumentAnnotations: (): DocumentAnnotations => {
    const { docId, docName, docVersion, annotations } = get();
    const now = new Date().toISOString();
    return { docId, docName, version: docVersion, annotations, createdAt: now, updatedAt: now };
  },

  addAudit: (entry) => {
    const { currentUser, auditLog } = get();
    const full: AuditEntry = { ...entry, user: currentUser.name, timestamp: new Date().toISOString() };
    set({ auditLog: [...auditLog, full] });
    addAuditEntry(full).catch(() => {});
  },
}));

// Color presets  
export const COLOR_PRESETS: { label: string; color: [number, number, number] }[] = [
  { label: 'Yellow', color: [1, 0.95, 0.2] },
  { label: 'Green', color: [0.4, 0.95, 0.4] },
  { label: 'Blue', color: [0.4, 0.7, 1] },
  { label: 'Pink', color: [1, 0.5, 0.8] },
  { label: 'Orange', color: [1, 0.65, 0.2] },
];
