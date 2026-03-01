import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { DocumentAnnotations, AuditEntry } from '../types/annotation';

const DB_NAME = 'pdf-annotator';
const DB_VERSION = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: IDBPDatabase<any> | null = null;

async function getDb() {
  if (!db) {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('annotations')) {
          const store = database.createObjectStore('annotations', { keyPath: 'docId' });
          store.createIndex('docName', 'docName');
        }
        if (!database.objectStoreNames.contains('auditLog')) {
          database.createObjectStore('auditLog', { keyPath: 'timestamp' });
        }
      },
    });
  }
  return db;
}

export async function saveDocumentAnnotations(doc: DocumentAnnotations): Promise<void> {
  const database = await getDb();
  await database.put('annotations', doc);
}

export async function loadDocumentAnnotations(docId: string): Promise<DocumentAnnotations | undefined> {
  const database = await getDb();
  return database.get('annotations', docId);
}

export async function getAllDocuments(): Promise<DocumentAnnotations[]> {
  const database = await getDb();
  return database.getAll('annotations');
}

export async function deleteDocumentAnnotations(docId: string): Promise<void> {
  const database = await getDb();
  await database.delete('annotations', docId);
}

export async function addAuditEntry(entry: AuditEntry): Promise<void> {
  const database = await getDb();
  await database.put('auditLog', entry);
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  const database = await getDb();
  return database.getAll('auditLog');
}

/** Export annotations as versioned JSON string */
export function exportAnnotationsJson(doc: DocumentAnnotations): string {
  return JSON.stringify(doc, null, 2);
}

/** Download annotations as .json file */
export function downloadAnnotationsJson(doc: DocumentAnnotations): void {
  const blob = new Blob([exportAnnotationsJson(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.docName}-v${doc.version}.annotations.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Generate a stable doc ID from filename */
export function makeDocId(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

/** Load annotations from a JSON file the user selects */
export async function importAnnotationsFromJson(): Promise<DocumentAnnotations | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as DocumentAnnotations;
        resolve(parsed);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
