import { ShieldCheck } from 'lucide-react';
import { PrivacyArchitectureSection } from '@/components/common/PrivacyArchitectureSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

export function WorkspacePrivacyView() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-status-verified" aria-hidden="true" />
            Client-Side Privacy Architecture
          </CardTitle>
          <CardDescription>
            Every detection, validation checksum, diff comparison, and file download runs
            exclusively inside your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrivacyArchitectureSection />
        </CardContent>
      </Card>
    </div>
  );
}
