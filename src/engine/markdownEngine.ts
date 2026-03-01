/**
 * Markdown Engine
 *
 * Sentinel-block strategy:
 *   All auto-generated highlight content lives exclusively between
 *   AUTO_START and AUTO_END comment markers.
 *   Everything outside is the user's free-writing space — never touched.
 *
 * No anchor tags are embedded in the markdown.
 * Bidirectional linking is handled at render-time by the panel component.
 */

import type { Annotation, DocumentAnnotations } from '../types/annotation';

// ─── Sentinel markers ────────────────────────────────────────────────────────

export const AUTO_START = '<!-- AUTO-GENERATED-START -->';
export const AUTO_END = '<!-- AUTO-GENERATED-END -->';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/** Sort annotations the same way the auto block renders them (page asc, top→bottom). */
export function sortAnnotations(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const yDiff = b.rect[3] - a.rect[3];
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.rect[0] - b.rect[0];
  });
}

// ─── Auto-block builder ───────────────────────────────────────────────────────

function buildSingleHighlightBlock(ann: Annotation): string {
  const lines: string[] = [];
  if (ann.extractedText) {
    lines.push(`> ${ann.extractedText.replace(/\n/g, '\n> ')}`);
  }
  if (ann.contents) {
    lines.push(`*${ann.contents}*`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Build the content that goes INSIDE the AUTO block.
 * Annotations are sorted page-ascending then top→bottom.
 * No anchor tags — bidirectional linking is computed at render-time.
 */
export function buildAutoSection(annotations: Annotation[]): string {
  if (annotations.length === 0) {
    return '_No highlights yet._\n';
  }
  return sortAnnotations(annotations).map(buildSingleHighlightBlock).join('\n');
}

// ─── Sentinel injection ───────────────────────────────────────────────────────

/**
 * Replace the content inside AUTO_START…AUTO_END with newSection.
 * If the markers don't exist yet, appends them.
 */
export function injectAutoBlock(markdown: string, newSection: string): string {
  const start = markdown.indexOf(AUTO_START);
  const end = markdown.indexOf(AUTO_END);

  if (start === -1 || end === -1) {
    return `${markdown}\n${AUTO_START}\n${newSection}\n${AUTO_END}\n`;
  }

  const before = markdown.slice(0, start + AUTO_START.length);
  const after = markdown.slice(end);
  return `${before}\n${newSection}\n${after}`;
}

/**
 * Split markdown into [before AUTO block (inclusive of marker), auto content, after AUTO block (inclusive of marker)].
 * Used by the panel to render the highlights section with a custom blockquote component.
 */
export function splitAutoBlock(markdown: string): [string, string, string] {
  const startIdx = markdown.indexOf(AUTO_START);
  const endIdx = markdown.indexOf(AUTO_END);
  if (startIdx === -1 || endIdx === -1) return [markdown, '', ''];
  return [
    markdown.slice(0, startIdx + AUTO_START.length),
    markdown.slice(startIdx + AUTO_START.length, endIdx),
    markdown.slice(endIdx),
  ];
}

// ─── Initial scaffold ─────────────────────────────────────────────────────────

/**
 * Build the first-time markdown scaffold for a new document.
 */
export function buildInitialMarkdown(docName: string): string {
  const name = docName.replace(/\.pdf$/i, '');
  const created = formatDate(new Date().toISOString());
  return [
    `# ${name}`,
    '',
    `*Created ${created}*`,
    '',
    '---',
    '',
    '## Highlights',
    '',
    AUTO_START,
    '_No highlights yet._',
    AUTO_END,
    '',
    '---',
    '',
    '## Personal Notes',
    '',
    '',
  ].join('\n');
}

// ─── Full export ──────────────────────────────────────────────────────────────

/**
 * Generate a clean Markdown export from DocumentAnnotations.
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

  for (const ann of sortAnnotations(annotations)) {
    if (ann.extractedText) {
      lines.push(`> ${ann.extractedText.replace(/\n/g, '\n> ')}`);
    }
    if (ann.contents) {
      lines.push(`*${ann.contents}*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Download the current notes markdown string as a .md file.
 */
export function downloadMarkdown(docName: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = docName.replace(/\.pdf$/i, '') + '.notes.md';
  a.click();
  URL.revokeObjectURL(url);
}
