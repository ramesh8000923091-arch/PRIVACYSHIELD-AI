/**
 * Pure Luhn mod-10 checksum validator for payment card numbers.
 * Never logs or persists input values.
 */
export function stripCardSeparators(value: string): string {
  return value.replace(/[\s-]+/g, '');
}

export function isValidLuhn(rawValue: string): boolean {
  const digits = stripCardSeparators(rawValue);

  if (!/^\d{13,19}$/.test(digits)) {
    return false;
  }

  // Reject degenerate all-identical sequences (e.g. 0000000000000000)
  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}
