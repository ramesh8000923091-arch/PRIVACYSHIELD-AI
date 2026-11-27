export type ExportFormat = 'txt' | 'csv';

export function buildSanitizedFileName(
  format: ExportFormat,
  originalFileName?: string | null
): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (originalFileName) {
    const cleanBase = originalFileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .slice(0, 64);
    return `${cleanBase || 'document'}-sanitized.${format}`;
  }
  return `privacyshield-sanitized-${stamp}.${format}`;
}

/**
 * Shared browser Blob download helper. Always revokes temporary object URLs immediately.
 */
export function triggerBlobDownload(content: string, fileName: string, mimeType: string): string {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return fileName;
}

/**
 * Downloads sanitized output strictly via browser Blob API and revokes
 * the temporary object URL immediately to prevent memory retention.
 */
export function downloadSanitizedFile(
  content: string,
  format: ExportFormat,
  originalFileName?: string | null
): string {
  const fileName = buildSanitizedFileName(format, originalFileName);
  const mimeType = format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
  return triggerBlobDownload(content, fileName, mimeType);
}
