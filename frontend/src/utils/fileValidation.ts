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

  const allowedMimes = LIMITS.ALLOWED_MIME_BY_EXTENSION[matchedExt];
  if (file.type && !allowedMimes.includes(file.type)) {
    return {
      valid: false,
      error: `Unexpected MIME type "${file.type}" for ${matchedExt}. Only plain text (.txt) and CSV (.csv) files are permitted.`,
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

const BINARY_SIGNATURES: readonly (readonly number[])[] = [
  [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  [0x50, 0x4b, 0x03, 0x04], // ZIP/XLSX/DOCX
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0xff, 0xd8, 0xff], // JPEG
];

async function readBlobAsUint8Array(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();
    if (buffer.byteLength > 0 || blob.size === 0) {
      return new Uint8Array(buffer);
    }
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(reader.result));
        } else {
          reject(new Error('Unexpected FileReader result'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read file bytes'));
      reader.readAsArrayBuffer(blob);
    });
  }
  const buffer = await new Response(blob).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Reads a File as UTF-8 text using File.text() with a FileReader fallback for older runtimes/jsdom.
 */
export async function readFileAsUtf8Text(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Unexpected FileReader text result'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read file text'));
      reader.readAsText(file, 'utf-8');
    });
  }
  return new Response(file).text();
}

/**
 * Inspects a leading byte slice (up to 8 KB) to reject disguised binaries and invalid UTF-8
 * before decoding the full file into memory.
 */
export async function validateUtf8TextBytes(
  file: File
): Promise<{ valid: boolean; error?: string }> {
  try {
    const sampleBlob = file.slice(0, Math.min(file.size, 8192));
    const bytes = await readBlobAsUint8Array(sampleBlob);

    for (const sig of BINARY_SIGNATURES) {
      if (bytes.length >= sig.length && sig.every((b, idx) => bytes[idx] === b)) {
        return {
          valid: false,
          error: 'File appears to be a binary format and cannot be processed as plain text.',
        };
      }
    }

    for (let i = 0; i < bytes.length; i += 1) {
      const b = bytes[i];
      // Reject NUL and non-printable control chars (allow TAB 0x09, LF 0x0A, CR 0x0D)
      if (b === 0x00 || b < 0x09 || b === 0x0b || b === 0x0c || (b >= 0x0e && b <= 0x1f)) {
        return {
          valid: false,
          error: 'File contains binary or non-printable control bytes and cannot be processed.',
        };
      }
    }

    // Validate UTF-8 structure; stream:true tolerates an incomplete trailing multi-byte codepoint at the 8 KB slice boundary
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(bytes, { stream: file.size > 8192 });
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'File is not valid UTF-8 text and cannot be processed safely.',
    };
  }
}
