import { useCallback, useEffect, useState } from 'react';
import { runPrivacyVerification } from '@/services/privacy';
import { useWorkspaceStore } from '@/store';
import type { PrivacyVerificationReport } from '@/types';

/**
 * Shared reactive hook running the Privacy Verification Module against live workspace canaries.
 * Eliminates duplicate report construction across PrivacyArchitectureSection and AboutPage.
 */
export function usePrivacyVerificationReport() {
  const entities = useWorkspaceStore((s) => s.entities);
  const uploadedFile = useWorkspaceStore((s) => s.uploadedFile);
  const analytics = useWorkspaceStore((s) => s.analytics);

  const buildReport = useCallback((): PrivacyVerificationReport => {
    const sensitiveSamples = [
      ...entities.map((entity) => entity.value),
      ...(uploadedFile?.name ? [uploadedFile.name] : []),
    ];
    return runPrivacyVerification({
      sensitiveSamples,
      analyticsSnapshot: analytics,
    });
  }, [entities, uploadedFile, analytics]);

  const [report, setReport] = useState<PrivacyVerificationReport>(() => buildReport());

  useEffect(() => {
    setReport(buildReport());
  }, [buildReport]);

  const refreshReport = useCallback(() => {
    setReport(buildReport());
  }, [buildReport]);

  return { report, setReport, refreshReport };
}
