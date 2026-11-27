import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { PII_CATEGORY_LIST } from '@/constants';
import { isSupabaseConfigured } from '@/services/supabase';
import type { ThemeMode } from '@/store';
import { isRedactionMode, type PIIType, type RedactionMode } from '@/types';

interface WorkspaceSettingsViewProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  defaultRedactionMode: RedactionMode;
  onDefaultModeChange: (mode: RedactionMode) => void;
  retainMappingsAcrossDocuments: boolean;
  onRetainMappingsChange: (retain: boolean) => void;
  telemetryConsent: boolean;
  onTelemetryConsentChange: (consent: boolean) => void;
  enabledCategories: Record<PIIType, boolean>;
  onToggleCategory: (category: PIIType) => void;
}

export function WorkspaceSettingsView({
  theme,
  onToggleTheme,
  defaultRedactionMode,
  onDefaultModeChange,
  retainMappingsAcrossDocuments,
  onRetainMappingsChange,
  telemetryConsent,
  onTelemetryConsentChange,
  enabledCategories,
  onToggleCategory,
}: WorkspaceSettingsViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Workspace &amp; Privacy Settings</CardTitle>
        <CardDescription>
          Preferences are stored locally without any document content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4">
          <label htmlFor="settings-dark-theme" className="cursor-pointer">
            <span className="block text-sm font-medium text-text-primary">
              Dark Cybersecurity Theme
            </span>
            <span className="block text-xs text-text-muted">
              Switch between dark navy and crisp light workspace appearance.
            </span>
          </label>
          <Switch
            id="settings-dark-theme"
            checked={theme === 'dark'}
            onCheckedChange={onToggleTheme}
            aria-label="Toggle dark theme"
          />
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-text-primary">Default Redaction Mode</p>
            <p className="text-xs text-text-muted">
              Applied when starting a new session; also updates active workspace mode.
            </p>
          </div>
          <Tabs
            value={defaultRedactionMode}
            onValueChange={(value) => {
              if (isRedactionMode(value)) {
                onDefaultModeChange(value);
              }
            }}
          >
            <TabsList aria-label="Default redaction mode">
              <TabsTrigger value="FULL_MASK">Full</TabsTrigger>
              <TabsTrigger value="PARTIAL_MASK">Partial</TabsTrigger>
              <TabsTrigger value="PSEUDONYMIZE">Pseudo</TabsTrigger>
            </TabsList>
            <TabsContent
              value="FULL_MASK"
              forceMount
              className="sr-only data-[state=inactive]:hidden"
            >
              Active default policy: Full Mask.
            </TabsContent>
            <TabsContent
              value="PARTIAL_MASK"
              forceMount
              className="sr-only data-[state=inactive]:hidden"
            >
              Active default policy: Partial Mask.
            </TabsContent>
            <TabsContent
              value="PSEUDONYMIZE"
              forceMount
              className="sr-only data-[state=inactive]:hidden"
            >
              Active default policy: Consistent Pseudonymization.
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4">
          <label htmlFor="settings-retain-mappings" className="cursor-pointer">
            <span className="block text-sm font-medium text-text-primary">
              Retain Pseudonym Mappings Across Documents (RAM Opt-In)
            </span>
            <span className="block text-xs text-text-muted">
              Disabled by default so each new document resets tokens cleanly. Still strictly
              volatile RAM only.
            </span>
          </label>
          <Switch
            id="settings-retain-mappings"
            checked={retainMappingsAcrossDocuments}
            onCheckedChange={onRetainMappingsChange}
            aria-label="Retain pseudonym mappings across documents in RAM"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4">
          <label htmlFor="settings-telemetry-consent" className="cursor-pointer">
            <span className="block text-sm font-medium text-text-primary">
              Opt-In Anonymous Aggregate Statistics (Supabase Only)
            </span>
            <span className="block text-xs text-text-muted">
              {isSupabaseConfigured
                ? 'Sends non-sensitive integer counts only when enabled.'
                : 'Local-Only Mode active — Supabase credentials are not configured.'}
            </span>
          </label>
          <Switch
            id="settings-telemetry-consent"
            checked={telemetryConsent}
            onCheckedChange={onTelemetryConsentChange}
            disabled={!isSupabaseConfigured}
            aria-label="Opt-in anonymous aggregate statistics"
          />
        </div>

        <fieldset className="space-y-2 rounded-lg border border-border-subtle bg-bg-canvas/60 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Enabled PII Detectors
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PII_CATEGORY_LIST.map((cat) => (
              <label
                key={cat.type}
                htmlFor={`settings-cat-${cat.type}`}
                className="flex cursor-pointer items-center justify-between rounded-md border border-border-subtle px-3 py-2 text-xs"
              >
                <span className="font-medium text-text-primary">{cat.label}</span>
                <Switch
                  id={`settings-cat-${cat.type}`}
                  checked={enabledCategories[cat.type]}
                  onCheckedChange={() => onToggleCategory(cat.type)}
                  aria-label={`Enable ${cat.label} detector`}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-lg border border-border-subtle bg-bg-canvas/60 p-4 font-mono text-xs text-text-muted">
          <h3 className="mb-1.5 font-semibold text-text-primary">Keyboard Shortcuts</h3>
          <ul className="space-y-1">
            <li>• Ctrl/Cmd + Shift + L — Load Synthetic Sample Data</li>
            <li>• Esc — Cancel active background Web Worker scan or close active inspector</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
