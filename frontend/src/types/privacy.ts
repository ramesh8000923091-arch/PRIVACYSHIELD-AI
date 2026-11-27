export type PrivacySurface =
  'NETWORK' | 'LOCAL_STORAGE' | 'SESSION_STORAGE' | 'CONSOLE' | 'ANALYTICS' | 'SUPABASE';

export interface PrivacyCheckResult {
  surface: PrivacySurface;
  passed: boolean;
  details: string;
  checkedAt: string;
}

export interface PrivacyVerificationReport {
  overallPassed: boolean;
  localOnlyMode: boolean;
  checks: PrivacyCheckResult[];
  generatedAt: string;
}
