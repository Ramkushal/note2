/**
 * usePdfLoader hook
 * Loads a PDF document from a File or URL using pdfjs-dist.
 * Exposes the loaded PDFDocumentProxy and handles cleanup.
 */

import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Suppress known benign PDF.js worker warnings that can't be silenced via the API
// because the pdfjs-dist module object is sealed/frozen.
const _origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('Push buttons without action') || msg.includes('ButtonWidget')) return;
  _origWarn(...args);
};

interface UsePdfLoaderResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc: any | null;
  numPages: number;
  loading: boolean;
  error: string | null;
}

export function usePdfLoader(file: File | null, url: string | null): UsePdfLoaderResult {
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<any | null>(null);

  useEffect(() => {
    if (!file && !url) {
      setPdfDoc(null);
      setNumPages(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        let source: ArrayBuffer | string;
        if (file) {
          source = await file.arrayBuffer();
        } else {
          source = url!;
        }

        const loadingTask = pdfjsLib.getDocument(
          typeof source === 'string' ? source : { data: new Uint8Array(source) }
        );
        const doc = await loadingTask.promise;

        if (cancelled) {
          doc.destroy();
          return;
        }

        docRef.current?.destroy();
        docRef.current = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [file, url]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      docRef.current?.destroy();
    };
  }, []);

  return { pdfDoc, numPages, loading, error };
}
