import type { DetectedEntity } from '@/types';

const EMAIL_CANDIDATE_REGEX =
  /(?<![A-Za-z0-9._%+-])([A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24})(?![A-Za-z0-9_%+-]|\.[A-Za-z0-9])/g;

function isValidEmailStructure(candidate: string): boolean {
  const atIndex = candidate.indexOf('@');
  if (atIndex <= 0 || atIndex !== candidate.lastIndexOf('@')) {
    return false;
  }

  const local = candidate.slice(0, atIndex);
  const domain = candidate.slice(atIndex + 1);

  if (local.length > 64 || domain.length > 253) {
    return false;
  }
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return false;
  }
  if (domain.includes('..')) {
    return false;
  }

  const labels = domain.split('.');
  if (labels.length < 2) {
    return false;
  }

  for (const label of labels) {
    if (label.length === 0 || label.length > 63 || label.startsWith('-') || label.endsWith('-')) {
      return false;
    }
  }

  return true;
}

export function detectEmails(text: string): DetectedEntity[] {
  if (!text || !text.includes('@')) {
    return [];
  }

  const results: DetectedEntity[] = [];
  EMAIL_CANDIDATE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EMAIL_CANDIDATE_REGEX.exec(text)) !== null) {
    const value = match[1];
    if (!isValidEmailStructure(value)) {
      continue;
    }

    const start = match.index;
    const end = start + value.length;

    results.push({
      id: `EMAIL-${start}-${end}`,
      type: 'EMAIL',
      value,
      start,
      end,
      confidence: 0.96,
      validationMethod: 'RFC_PATTERN',
    });
  }

  return results;
}
