export type PIIType = 'EMAIL' | 'PHONE' | 'IP_ADDRESS' | 'PAN' | 'AADHAAR' | 'CREDIT_CARD';

export type ValidationMethod =
  | 'RFC_PATTERN'
  | 'INDIAN_MOBILE_RULE'
  | 'IPV4_OCTET_CHECK'
  | 'IPV6_RFC4291_CHECK'
  | 'PAN_STRUCTURE_CHECK'
  | 'VERHOEFF_CHECKSUM'
  | 'LUHN_CHECKSUM';

export interface CellLocation {
  row: number;
  col: number;
  columnName?: string;
}

export interface DetectedEntity {
  id: string;
  type: PIIType;
  /** Held strictly in volatile RAM — never logged or persisted. */
  value: string;
  start: number;
  end: number;
  confidence: number;
  validationMethod: ValidationMethod;
  cellLocation?: CellLocation;
}

export interface DetectionOptions {
  enabledCategories: Record<PIIType, boolean>;
}

export interface DetectionSummary {
  entities: DetectedEntity[];
  countsByCategory: Record<PIIType, number>;
  totalDetected: number;
  durationMs: number;
  usedWorker: boolean;
}
