/**
 * Markdown Generator Engine
 * Converts annotation store state → structured Markdown
 */

import type { Annotation, DocumentAnnotations } from '../types/annotation';


function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Generate full Markdown export from a DocumentAnnotations object.
 */
export function generateMarkdown(doc: DocumentAnnotations): string {
  const { docName, version, annotations } = doc;
  const lines: string[] = [];

  lines.push(`# ${docName}`);
  lines.push('');
  lines.push(`> **Version:** ${version} | **Exported:** ${formatDate(new Date().toISOString())}`);
  lines.push('');

  if (annotations.length === 0) {
    lines.push('_No annotations yet._');
    return lines.join('\n');
  }

  // Group by page, sort pages ascending, sort annotations top→bottom
  const byPage = new Map<number, Annotation[]>();
  for (const ann of annotations) {
    if (!byPage.has(ann.page)) byPage.set(ann.page, []);
    byPage.get(ann.page)!.push(ann);
  }

  const sortedPages = [...byPage.keys()].sort((a, b) => a - b);

  for (const page of sortedPages) {
    const anns = byPage
      .get(page)!
      .sort((a, b) => {
        const yDiff = b.rect[3] - a.rect[3];
        if (Math.abs(yDiff) > 4) return yDiff;
        return a.rect[0] - b.rect[0];
      });

    lines.push(`## Page ${page}`);
    lines.push('');

    for (const ann of anns) {
      if (ann.extractedText) {
        lines.push(`> ${ann.extractedText.replace(/\n/g, '\n> ')}`);
      }
      if (ann.contents) {
        lines.push('');
        lines.push(`*${ann.contents}*`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Download markdown as .md file.
 */
export function downloadMarkdown(doc: DocumentAnnotations): void {
  const content = generateMarkdown(doc);
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.docName.replace('.pdf', '') + '.export.md';
  a.click();
  URL.revokeObjectURL(url);
}
