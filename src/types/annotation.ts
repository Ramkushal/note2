// Annotation schema mirroring PDF spec
export type AnnotationType = 'Highlight' | 'Underline' | 'StrikeOut' | 'Note';

export interface Annotation {
  id: string;
  page: number;         // 1-indexed
  type: AnnotationType;
  quadPoints: number[]; // PDF QuadPoints array (8n numbers)
  rect: [number, number, number, number]; // [x1,y1,x2,y2] in PDF coords
  color: [number, number, number];        // RGB 0-1
  author: string;
  contents: string;     // comment / note text
  extractedText: string; // text covered by highlight
  createdAt: string;    // ISO8601
  updatedAt: string;
  version: number;
  saved: boolean;       // persisted to disk / IndexedDB
}

export interface DocumentAnnotations {
  docId: string;        // hash / filename
  docName: string;
  version: number;
  annotations: Annotation[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  action: 'create_highlight' | 'update_highlight' | 'delete_highlight' | 'save' | 'export';
  user: string;
  timestamp: string;
  page: number;
  annotationId?: string;
}

export interface AppUser {
  name: string;
  color: [number, number, number];
}
