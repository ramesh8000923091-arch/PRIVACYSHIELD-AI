import type { DetectedEntity } from '@/types';

const IPV4_CANDIDATE_REGEX =
  /(?<![\d.A-Za-z])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![\dA-Za-z]|\.\d)/g;

const IPV6_CANDIDATE_REGEX =
  /(?<![A-Fa-f0-9:])((?:[A-Fa-f0-9]{0,4}:){2,7}[A-Fa-f0-9.]{0,15})(?![A-Fa-f0-9:])/g;

export function isValidIPv4(candidate: string): boolean {
  const parts = candidate.split('.');
  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    if (part.length === 0 || part.length > 3) {
      return false;
    }
    // Disallow leading zeros like 01 or 001 (except single "0")
    if (part.length > 1 && part.startsWith('0')) {
      return false;
    }
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) {
      return false;
    }
  }

  return true;
}

export function isValidIPv6(rawCandidate: string): boolean {
  if (!rawCandidate.includes(':')) {
    return false;
  }

  // Must not contain triple colons
  if (rawCandidate.includes(':::')) {
    return false;
  }

  // Reject bare "::" in general text to avoid false positives in prose/code
  if (rawCandidate === '::') {
    return false;
  }

  // Handle IPv4-mapped suffix (e.g., ::ffff:192.0.2.128)
  let working = rawCandidate;
  let hasEmbeddedIpv4 = false;
  if (working.includes('.')) {
    const lastColon = working.lastIndexOf(':');
    if (lastColon === -1) return false;
    const ipv4Tail = working.slice(lastColon + 1);
    if (!isValidIPv4(ipv4Tail)) {
      return false;
    }
    working = `${working.slice(0, lastColon)}:0:0`;
    hasEmbeddedIpv4 = true;
  }

  const doubleColonParts = working.split('::');
  if (doubleColonParts.length > 2) {
    return false;
  }

  const isValidHextet = (group: string) => /^[A-Fa-f0-9]{1,4}$/.test(group);

  if (doubleColonParts.length === 1) {
    // Full uncompressed IPv6 MUST have exactly 8 hextets (automatically rejects HH:MM:SS timestamps)
    const groups = working.split(':');
    if (groups.length !== 8) {
      return false;
    }
    return groups.every(isValidHextet);
  }

  // Compressed IPv6 with a single "::"
  const [leftRaw, rightRaw] = doubleColonParts;
  const leftGroups = leftRaw ? leftRaw.split(':') : [];
  const rightGroups = rightRaw ? rightRaw.split(':') : [];

  if (!leftGroups.every(isValidHextet) || !rightGroups.every(isValidHextet)) {
    return false;
  }

  const totalGroups = leftGroups.length + rightGroups.length;
  // With "::", at least one hextet is omitted, so total explicit groups must be < 8
  if (totalGroups >= 8) {
    return false;
  }

  // Require at least one non-empty group (already true since rawCandidate !== '::')
  if (totalGroups === 0 && !hasEmbeddedIpv4) {
    return false;
  }

  return true;
}

export function detectIpAddresses(text: string): DetectedEntity[] {
  if (!text || (!text.includes('.') && !text.includes(':'))) {
    return [];
  }

  const results: DetectedEntity[] = [];

  // 1. IPv4 detection
  IPV4_CANDIDATE_REGEX.lastIndex = 0;
  let v4Match: RegExpExecArray | null;
  while ((v4Match = IPV4_CANDIDATE_REGEX.exec(text)) !== null) {
    const value = v4Match[1];
    if (!isValidIPv4(value)) {
      continue;
    }

    const start = v4Match.index;
    const end = start + value.length;

    results.push({
      id: `IP_ADDRESS-${start}-${end}`,
      type: 'IP_ADDRESS',
      value,
      start,
      end,
      confidence: 0.95,
      validationMethod: 'IPV4_OCTET_CHECK',
    });
  }

  // 2. IPv6 detection
  IPV6_CANDIDATE_REGEX.lastIndex = 0;
  let v6Match: RegExpExecArray | null;
  while ((v6Match = IPV6_CANDIDATE_REGEX.exec(text)) !== null) {
    let value = v6Match[1];
    let start = v6Match.index;

    // Trim trailing single punctuation colons or dots from prose (preserve "::")
    while (value.endsWith('.') || (value.endsWith(':') && !value.endsWith('::'))) {
      value = value.slice(0, -1);
    }
    while (value.startsWith(':') && !value.startsWith('::')) {
      value = value.slice(1);
      start += 1;
    }

    if (!isValidIPv6(value)) {
      continue;
    }

    const end = start + value.length;
    results.push({
      id: `IP_ADDRESS-${start}-${end}`,
      type: 'IP_ADDRESS',
      value,
      start,
      end,
      confidence: 0.95,
      validationMethod: 'IPV6_RFC4291_CHECK',
    });
  }

  return results;
}
