import { LIMITS } from '@/constants';

export interface FileValidationResult {
  valid: boolean;
  extension?: '.txt' | '.csv';
  error?: string;
}

export function validateUploadedFile(file: File): FileValidationResult {
  const lowerName = file.name.trim().toLowerCase();
  const matchedExt = LIMITS.ALLOWED_EXTENSIONS.find((ext) => lowerName.endsWith(ext));

  if (!matchedExt) {
    return {
      valid: false,
      error: 'Unsupported file type. Please upload a .txt or .csv file.',
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The selected file is empty. Please choose a file containing text.',
    };
  }

  if (file.size > LIMITS.MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return {
      valid: false,
      error: `File exceeds the ${maxMb} MB client-side safety limit.`,
    };
  }

  const allowedMimes: readonly string[] = LIMITS.ALLOWED_MIME_TYPES;
  if (file.type && !allowedMimes.includes(file.type)) {
    return {
      valid: false,
      error: `Unexpected MIME type "${file.type}". Only plain text (.txt) and CSV (.csv) files are permitted.`,
    };
  }

  return {
    valid: true,
    extension: matchedExt,
  };
}

export function containsBinaryNullBytes(text: string): boolean {
  return text.includes('\u0000');
}
