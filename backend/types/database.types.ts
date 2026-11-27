/**
 * PrivacyShield AI — Supabase Database Type Definitions (Safe Metadata Only)
 *
 * Notice: No table in this schema contains raw text, document blobs,
 * filenames, detected PII values, or pseudonymization mappings.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ThemePreference = 'dark' | 'light';
export type RedactionModeDb = 'FULL_MASK' | 'PARTIAL_MASK' | 'PSEUDONYMIZE';

export interface Database {
  public: {
    Tables: {
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          theme: ThemePreference;
          default_redaction_mode: RedactionModeDb;
          telemetry_consent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: ThemePreference;
          default_redaction_mode?: RedactionModeDb;
          telemetry_consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          theme?: ThemePreference;
          default_redaction_mode?: RedactionModeDb;
          telemetry_consent?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      sanitization_statistics: {
        Row: {
          id: string;
          user_id: string | null;
          email_count: number;
          phone_count: number;
          ip_count: number;
          pan_count: number;
          aadhaar_count: number;
          credit_card_count: number;
          total_entities: number;
          redaction_mode: RedactionModeDb;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email_count: number;
          phone_count: number;
          ip_count: number;
          pan_count: number;
          aadhaar_count: number;
          credit_card_count: number;
          total_entities: number;
          redaction_mode: RedactionModeDb;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
