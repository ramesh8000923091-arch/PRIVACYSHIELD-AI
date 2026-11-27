export const LIMITS = {
  /** Maximum permitted upload size in bytes (10 MB). */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  /** Inputs at or above 50 KB automatically offload to a Web Worker. */
  WORKER_TEXT_THRESHOLD_BYTES: 50 * 1024,
  /** CSV files exceeding 500 rows automatically offload to a Web Worker. */
  WORKER_CSV_ROW_THRESHOLD: 500,
  /** Maximum local audit log entries retained in browser storage. */
  MAX_AUDIT_LOG_ENTRIES: 200,
  /** Supported file extensions. */
  ALLOWED_EXTENSIONS: ['.txt', '.csv'] as const,
  /** Allowed MIME types per extension (browsers may report empty string for some files). */
  ALLOWED_MIME_BY_EXTENSION: {
    '.txt': ['text/plain', ''] as readonly string[],
    '.csv': [
      'text/csv',
      'text/plain',
      'text/comma-separated-values',
      'application/csv',
      'application/vnd.ms-excel',
      '',
    ] as readonly string[],
  },
} as const;
