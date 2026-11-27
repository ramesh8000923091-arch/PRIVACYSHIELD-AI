import { computeVerhoeffCheckDigit } from '@/services/detection/verhoeffValidator';

const SYNTHETIC_AADHAAR_1_RAW = `23456789012${computeVerhoeffCheckDigit('23456789012')}`;
const SYNTHETIC_AADHAAR_2_RAW = `34567890123${computeVerhoeffCheckDigit('34567890123')}`;

export const SYNTHETIC_AADHAAR_1 = `${SYNTHETIC_AADHAAR_1_RAW.slice(0, 4)} ${SYNTHETIC_AADHAAR_1_RAW.slice(4, 8)} ${SYNTHETIC_AADHAAR_1_RAW.slice(8)}`;
export const SYNTHETIC_AADHAAR_2 = `${SYNTHETIC_AADHAAR_2_RAW.slice(0, 4)}-${SYNTHETIC_AADHAAR_2_RAW.slice(4, 8)}-${SYNTHETIC_AADHAAR_2_RAW.slice(8)}`;

/**
 * Strictly fictional synthetic document containing zero real personal data.
 * Includes repeated email & phone entries to demonstrate Consistent Pseudonymization,
 * Luhn-valid test cards, Verhoeff-valid synthetic Aadhaar numbers, PANs, and IPv4/IPv6 addresses.
 */
export const SAMPLE_DOCUMENT_TEXT = `INCIDENT & SUPPORT ESCALATION LOG (SYNTHETIC TEST DATA)
========================================================
Ticket ID: INC-2026-4092
Reporter: priya.sharma@example.com
Secondary CC: arjun.mehta@example.org
Primary Mobile: +91 98765 43210
Alternate Contact: 9876543210 (same user, alternate format)

Network Telemetry:
- Client IPv4: 192.168.42.19
- Gateway IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334

KYC & Billing Verification (Synthetic Placeholders):
- Individual PAN: ABCPK1234F
- Corporate PAN: AAACA5678K
- Aadhaar Ref #1: ${SYNTHETIC_AADHAAR_1}
- Aadhaar Ref #2: ${SYNTHETIC_AADHAAR_2}
- Test Visa Card (Luhn Valid): 4111-1111-1111-1111
- Test Mastercard (Luhn Valid): 5500 0000 0000 0004
- Invalid Non-Card Sequence (Should Ignore): 1234-5678-9012-3456

Follow-Up Note:
Please notify priya.sharma@example.com once verification completes.`;

export const SAMPLE_CSV_TEXT = `record_id,full_name,email,phone,pan,aadhaar_ref,notes
101,"Sharma, Priya",priya.sharma@example.com,+91 9876543210,ABCPK1234F,${SYNTHETIC_AADHAAR_1},"Escalated from 192.168.42.19, card 4111-1111-1111-1111"
102,"Mehta, Arjun",arjun.mehta@example.org,09820112233,BZVPM4321D,${SYNTHETIC_AADHAAR_2},"Repeat contact priya.sharma@example.com, edge 2001:0db8:85a3::7334"`;
