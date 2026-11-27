import {
  SafeSupabaseStatisticsPayloadSchema,
  type SafeSupabaseStatisticsPayload,
} from '@/services/privacy';
import type { DetectionAnalytics, RedactionMode } from '@/types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface MetadataSyncResult {
  synced: boolean;
  reason?: string;
}

/**
 * Optionally submits consented, strictly Zod-validated aggregate integer counts
 * to Supabase when configured. Completely no-op in Local-Only Mode.
 */
export async function submitConsentedAggregateStats(
  analytics: DetectionAnalytics,
  redactionMode: RedactionMode,
  userConsented: boolean
): Promise<MetadataSyncResult> {
  if (!userConsented) {
    return { synced: false, reason: 'consent-not-granted' };
  }

  if (!isSupabaseConfigured) {
    return { synced: false, reason: 'local-only-mode' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { synced: false, reason: 'client-unavailable' };
  }

  const payload: SafeSupabaseStatisticsPayload = SafeSupabaseStatisticsPayloadSchema.parse({
    email_count: analytics.countsByCategory.EMAIL,
    phone_count: analytics.countsByCategory.PHONE,
    ip_count: analytics.countsByCategory.IP_ADDRESS,
    pan_count: analytics.countsByCategory.PAN,
    aadhaar_count: analytics.countsByCategory.AADHAAR,
    credit_card_count: analytics.countsByCategory.CREDIT_CARD,
    total_entities: analytics.totalDetected,
    redaction_mode: redactionMode,
  });

  const { error } = await client.from('sanitization_statistics').insert(payload);
  if (error) {
    return { synced: false, reason: 'supabase-unavailable' };
  }

  return { synced: true };
}
