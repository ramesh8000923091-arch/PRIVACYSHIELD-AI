import type { DetectedEntity } from '@/types';

const IPV4_CANDIDATE_REGEX =
  /(?<![\d.A-Za-z])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![\dA-Za-z]|\.\d)/g;

/**
 * Matches IPv6 candidates using full alphanumeric/underscore/colon boundaries so C++ (`std::cout`),
 * CSS (`div::before`), prose (`foo::bar`), and colon-prefixed identifiers (`id:2001:db8::1`) are
 * never falsely matched or partially corrupted.
 */
const IPV6_CANDIDATE_REGEX =
  /(?<![A-Za-z0-9_:])((?:[A-Fa-f0-9]{0,4}:){2,7}[A-Fa-f0-9.]{0,15})(?![A-Za-z0-9_:])/g;

export function isValidIPv4(candidate: string): boolean {
  const parts = candidate.split('.');
  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    if (part.length === 0 || part.length > 3) {
      return false;
    }
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

/**
 * Expands a valid RFC 4291 IPv6 address (including compressed `::` and IPv4-mapped forms)
 * into 8 zero-padded 4-character lowercase hex hextets. Returns null if invalid.
 */
export function expandIPv6(rawCandidate: string): string[] | null {
  const candidate = rawCandidate.trim().toLowerCase();
  if (!candidate.includes(':') || candidate.includes(':::') || candidate === '::') {
    return null;
  }

  let working = candidate;
  let embeddedHexTail: [string, string] | null = null;

  if (working.includes('.')) {
    const lastColon = working.lastIndexOf(':');
    if (lastColon === -1) return null;
    const ipv4Tail = working.slice(lastColon + 1);
    if (!isValidIPv4(ipv4Tail)) {
      return null;
    }
    const octets = ipv4Tail.split('.').map(Number);
    const hi = ((octets[0] << 8) | octets[1]).toString(16).padStart(4, '0');
    const lo = ((octets[2] << 8) | octets[3]).toString(16).padStart(4, '0');
    embeddedHexTail = [hi, lo];
    working = working.slice(0, lastColon);
    // Re-append ":0:0" so both "::192.0.2.128" (working === ":") and
    // "::ffff:192.0.2.128" preserve "::" compression and 2 placeholder hextets.
    working = `${working}:0:0`;
  }

  const doubleColonParts = working.split('::');
  if (doubleColonParts.length > 2) {
    return null;
  }

  const isValidHextet = (group: string) => /^[a-f0-9]{1,4}$/.test(group);

  let expanded: string[];
  if (doubleColonParts.length === 1) {
    const groups = working.split(':');
    if (groups.length !== 8 || !groups.every(isValidHextet)) {
      return null;
    }
    expanded = groups.map((g) => g.padStart(4, '0'));
  } else {
    const [leftRaw, rightRaw] = doubleColonParts;
    const leftGroups = leftRaw ? leftRaw.split(':') : [];
    const rightGroups = rightRaw ? rightRaw.split(':') : [];

    if (!leftGroups.every(isValidHextet) || !rightGroups.every(isValidHextet)) {
      return null;
    }

    const missing = 8 - (leftGroups.length + rightGroups.length);
    if (missing <= 0) {
      return null;
    }

    expanded = [
      ...leftGroups.map((g) => g.padStart(4, '0')),
      ...Array.from({ length: missing }, () => '0000'),
      ...rightGroups.map((g) => g.padStart(4, '0')),
    ];
  }

  if (embeddedHexTail) {
    expanded[6] = embeddedHexTail[0];
    expanded[7] = embeddedHexTail[1];
  }

  return expanded;
}

export function isValidIPv6(rawCandidate: string): boolean {
  return expandIPv6(rawCandidate) !== null;
}

/**
 * Produces a canonical normalized representation of an IPv4 or IPv6 address
 * so compressed, expanded, uppercase, and IPv4-mapped IPv6 variants map identically.
 */
export function canonicalizeIpAddress(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (isValidIPv4(trimmed)) {
    return trimmed;
  }
  const expanded = expandIPv6(trimmed);
  if (expanded) {
    return expanded.join(':');
  }
  return trimmed.toLowerCase();
}

export function detectIpAddresses(text: string): DetectedEntity[] {
  if (!text || (!text.includes('.') && !text.includes(':'))) {
    return [];
  }

  const v6Results: DetectedEntity[] = [];

  // 1. IPv6 detection first so IPv4-mapped IPv6 addresses don't also emit inner IPv4 spans
  if (text.includes(':')) {
    IPV6_CANDIDATE_REGEX.lastIndex = 0;
    let v6Match: RegExpExecArray | null;
    while ((v6Match = IPV6_CANDIDATE_REGEX.exec(text)) !== null) {
      let value = v6Match[1];
      let start = v6Match.index;

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
      v6Results.push({
        id: `IP_ADDRESS-${start}-${end}`,
        type: 'IP_ADDRESS',
        value,
        start,
        end,
        confidence: 0.95,
        validationMethod: 'IPV6_RFC4291_CHECK',
      });
    }
  }

  const v4Results: DetectedEntity[] = [];

  // 2. IPv4 detection (skipping spans already enclosed inside IPv4-mapped IPv6 matches)
  if (text.includes('.')) {
    IPV4_CANDIDATE_REGEX.lastIndex = 0;
    let v4Match: RegExpExecArray | null;
    while ((v4Match = IPV4_CANDIDATE_REGEX.exec(text)) !== null) {
      const value = v4Match[1];
      if (!isValidIPv4(value)) {
        continue;
      }

      const start = v4Match.index;
      const end = start + value.length;

      const insideIpv6 = v6Results.some((v6) => start >= v6.start && end <= v6.end);
      if (insideIpv6) {
        continue;
      }

      v4Results.push({
        id: `IP_ADDRESS-${start}-${end}`,
        type: 'IP_ADDRESS',
        value,
        start,
        end,
        confidence: 0.95,
        validationMethod: 'IPV4_OCTET_CHECK',
      });
    }
  }

  return [...v4Results, ...v6Results].sort((a, b) => a.start - b.start);
}
