export interface ParsedCsvDocument {
  fileName: string;
  fileSizeBytes: number;
  delimiter: string;
  linebreak: string;
  hasHeader: boolean;
  headers: string[];
  rows: string[][];
}

export type InputSourceType = 'PASTE' | 'TXT_FILE' | 'CSV_FILE' | 'SAMPLE';

export interface UploadedFileMeta {
  name: string;
  sizeBytes: number;
  extension: '.txt' | '.csv';
  mimeType: string;
}
