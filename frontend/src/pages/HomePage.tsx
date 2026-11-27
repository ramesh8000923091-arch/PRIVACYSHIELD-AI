import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Cpu,
  Download,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Layers,
  Lock,
  ScanSearch,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UploadCloud,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { FaqAccordion } from '@/components/common/FaqAccordion';
import { InteractiveHeroPreview } from '@/components/common/InteractiveHeroPreview';
import { PrivacyArchitectureSection } from '@/components/common/PrivacyArchitectureSection';
import { PrivacyBadge } from '@/components/common/PrivacyBadge';
import { RedactionModesShowcase } from '@/components/common/RedactionModesShowcase';
import { SectionHeader } from '@/components/common/SectionHeader';
import { LIMITS, PII_CATEGORY_LIST } from '@/constants';
import { isSupabaseConfigured } from '@/services/supabase';
import { useAuditLogStore } from '@/store';
import type { PIIType } from '@/types';

const PROBLEM_CARDS = [
  {
    icon: Terminal,
    title: 'Application & Server Logs',
    description:
      'Stack traces and request dumps routinely leak IP addresses, email tokens, and mobile numbers into bug trackers and chat channels.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Customer CSV Exports',
    description:
      'Analytics teams share exported tables containing PAN, Aadhaar, and payment digits — risking instant compliance violations.',
  },
  {
    icon: FileText,
    title: 'Support Tickets & Resumes',
    description:
      'Everyday operational documents combine unstructured prose with personal identifiers that manual redaction frequently misses.',
  },
  {
    icon: FileWarning,
    title: 'Third-Party Cloud Risk',
    description:
      'Uploading raw documents to cloud AI tools or external redaction APIs expands your attack surface before data is even sanitized.',
  },
] as const;

const WORKFLOW_STEPS = [
  {
    step: '01',
    icon: UploadCloud,
    title: 'Paste Text or Drop Files',
    description:
      'Paste raw text directly or drag and drop .txt and .csv files up to 10 MB. Files are validated and read strictly in local memory.',
  },
  {
    step: '02',
    icon: ScanSearch,
    title: 'Deterministic Classification',
    description:
      'Six modular detectors classify entities with Luhn, Verhoeff, IPv4/IPv6, and PAN structural validation — plus deterministic overlap resolution.',
  },
  {
    step: '03',
    icon: SlidersHorizontal,
    title: 'Select Redaction Policy',
    description:
      'Switch instantly between Full Mask, Partial Mask, and RAM-only Consistent Pseudonymization, or exclude individual detections.',
  },
  {
    step: '04',
    icon: Download,
    title: 'Compare & Export Clean Files',
    description:
      'Inspect synchronized side-by-side diffs, review live analytics, and download sanitized .txt or structure-preserving .csv outputs.',
  },
] as const;

const SECURITY_GUARANTEES = [
  {
    icon: Lock,
    title: 'Zero Raw Data Transmission',
    description:
      'No backend document API and no third-party LLM calls. Every byte of original input remains inside your browser process.',
  },
  {
    icon: ShieldCheck,
    title: 'Mathematical Checksum Validation',
    description:
      'Credit cards pass Luhn mod-10 validation and Aadhaar-like numbers pass Verhoeff checksums to dramatically reduce false positives.',
  },
  {
    icon: Cpu,
    title: 'Non-Blocking Web Worker Engine',
    description:
      'Inputs at or above 50 KB or 500+ CSV rows offload automatically to an isolated browser Web Worker with cancellation support.',
  },
  {
    icon: Layers,
    title: 'Strict XSS & CSP Hardening',
    description:
      'Zero dangerouslySetInnerHTML usage, strict Content Security Policy headers, MIME/extension validation, and immediate Blob URL cleanup.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Cell-Safe CSV Preservation',
    description:
      'PapaParse parses and re-serializes cell by cell so delimiters, headers, and commas inside quoted fields stay intact.',
  },
  {
    icon: Activity,
    title: 'Built-In Privacy Verification',
    description:
      'A dedicated Privacy Verification Module audits browser storage, console output, analytics objects, and optional Supabase payloads.',
  },
] as const;

const CATEGORY_EXAMPLES: Record<PIIType, { before: string; after: string }> = {
  EMAIL: { before: 'anuj@example.com', after: 'an****@example.com' },
  PHONE: { before: '+91 9876543210', after: 'XXXXXX3210' },
  IP_ADDRESS: { before: '192.168.42.19', after: '192.168.xxx.xxx' },
  PAN: { before: 'ABCPK1234F', after: 'XXXXX1234X' },
  AADHAAR: { before: '2345 6789 0128', after: 'XXXX XXXX 0128' },
  CREDIT_CARD: { before: '4111-1111-1111-1111', after: 'XXXX-XXXX-XXXX-1111' },
};

export function HomePage() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const auditEntries = useAuditLogStore((state) => state.entries);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [location.hash, prefersReducedMotion]);

  const realStats = useMemo(() => {
    const localSanitizations = auditEntries.filter(
      (entry) => entry.action === 'SANITIZATION_COMPLETED'
    ).length;
    const totalEntitiesRecorded = auditEntries.reduce(
      (sum, entry) => sum + (entry.detectedCount ?? 0),
      0
    );

    return [
      {
        label: 'Supported PII Categories',
        value: String(PII_CATEGORY_LIST.length),
        detail: 'Modular deterministic detectors',
      },
      {
        label: 'Redaction Modes',
        value: '3',
        detail: 'Full, Partial & Pseudonymize',
      },
      {
        label: 'Max Local File Upload',
        value: `${Math.round(LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB`,
        detail: `Worker offload >= ${Math.round(LIMITS.WORKER_TEXT_THRESHOLD_BYTES / 1024)} KB`,
      },
      {
        label: 'Raw Bytes Sent Externally',
        value: '0 B',
        detail: isSupabaseConfigured ? 'Metadata opt-in only' : 'Local-Only Mode active',
      },
      {
        label: 'Your Local Activity Events',
        value: String(auditEntries.length),
        detail: `${localSanitizations} sanitizations • ${totalEntitiesRecorded} entities counted locally`,
      },
    ];
  }, [auditEntries]);

  function scrollToFeatures() {
    document
      .getElementById('features')
      ?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  const fadeUp = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: 'easeOut' as const },
      };

  return (
    <div className="relative overflow-x-clip">
      {/* Subtle cybersecurity radial background grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(59, 130, 246, 0.22), transparent 70%), radial-gradient(ellipse 45% 35% at 85% 15%, rgba(139, 92, 246, 0.16), transparent 70%)',
        }}
      />

      {/* HERO SECTION */}
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
        <motion.div {...fadeUp} className="grid items-center gap-12 lg:grid-cols-12">
          <div className="flex flex-col items-start gap-6 lg:col-span-5">
            <PrivacyBadge />

            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-text-primary sm:text-5xl">
              Your Data. Your Privacy.{' '}
              <span className="bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent dark:from-blue-400 dark:to-violet-400">
                Our Priority.
              </span>
            </h1>

            <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
              Detect, classify and sanitize sensitive information instantly. Privacy-first
              processing that keeps your data inside your browser.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button asChild size="lg" className="shadow-md">
                <Link to="/workspace">
                  Start Sanitizing
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={scrollToFeatures}>
                Explore Features
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-status-verified" aria-hidden="true" />
                No server upload
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
                Luhn &amp; Verhoeff validated
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 text-brand-secondary" aria-hidden="true" />
                TXT &amp; CSV ready
              </span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <InteractiveHeroPreview />
          </div>
        </motion.div>
      </section>

      {/* SECTION 1: PROBLEM STATEMENT */}
      <section
        id="problem"
        className="border-t border-border-subtle bg-bg-surface/40 py-20 scroll-mt-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="The Exposure Problem"
            title="Sensitive data leaks happen inside everyday files"
            description="Engineers, analysts, and support teams regularly share operational documents that embed personal identifiers — creating privacy, breach, and compliance exposure."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEM_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.title}
                  className="transition-[border-color] hover:border-brand-primary/40"
                >
                  <CardHeader>
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-bg-elevated text-brand-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle>{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-text-muted">{card.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 2: HOW PRIVACYSHIELD WORKS */}
      <section id="how-it-works" className="border-t border-border-subtle py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Workflow"
            title="How PrivacyShield AI works"
            description="Four deterministic steps executed locally in your browser — from raw input to verified sanitized export."
            align="center"
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.step} className="relative overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/15 text-brand-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <span className="font-mono text-xs font-bold text-text-muted">
                        STEP {item.step}
                      </span>
                    </div>
                    <CardTitle className="pt-2">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-text-muted">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: SUPPORTED PII CATEGORIES */}
      <section
        id="features"
        className="border-t border-border-subtle bg-bg-surface/40 py-20 scroll-mt-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Detection Engine"
            title="Six modular PII detectors with deterministic validation"
            description="Each category runs in its own isolated TypeScript module with checksum or structural verification and priority-based overlap resolution."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PII_CATEGORY_LIST.map((category) => {
              const sample = CATEGORY_EXAMPLES[category.type];
              return (
                <Card
                  key={category.type}
                  className="flex flex-col justify-between transition-[border-color] hover:border-brand-primary/40"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{category.label}</CardTitle>
                      <span
                        className="rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold"
                        style={{
                          color: category.colorVar.fg,
                          backgroundColor: category.colorVar.bg,
                          border: `1px solid ${category.colorVar.border}`,
                        }}
                      >
                        {category.type}
                      </span>
                    </div>
                    <CardDescription className="font-mono text-[11px]">
                      {category.validationLabel}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {category.description}
                    </p>
                    {sample && (
                      <div className="rounded-lg border border-border-subtle bg-bg-canvas/80 px-3 py-2.5 font-mono text-xs">
                        <div className="flex items-center justify-between gap-2 text-text-muted">
                          <span>Synthetic:</span>
                          <span className="truncate">{sample.before}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300">
                          <span>Partial:</span>
                          <span className="truncate font-semibold">{sample.after}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 4: THREE REDACTION MODES */}
      <section id="modes" className="border-t border-border-subtle py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Sanitization Policies"
            title="Three redaction modes for every privacy workflow"
            description="Switch modes instantaneously without re-uploading or mutating your original document. Compare exact transformations below."
          />

          <div className="mt-10">
            <RedactionModesShowcase />
          </div>
        </div>
      </section>

      {/* SECTION 5: PRIVACY-FIRST ARCHITECTURE */}
      <section
        id="architecture"
        className="border-t border-border-subtle bg-bg-surface/40 py-20 scroll-mt-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Privacy By Design"
            title="Verifiable client-side trust boundary"
            description="Inspect exactly what stays in volatile browser RAM versus what is strictly forbidden from external networks and storage — then run a live self-check."
          />

          <div className="mt-10">
            <PrivacyArchitectureSection />
          </div>
        </div>
      </section>

      {/* SECTION 6: SECURITY FEATURES */}
      <section id="security" className="border-t border-border-subtle py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Security Engineering"
            title="Engineered to enterprise cybersecurity standards"
            description="Security is not a marketing banner — it is enforced at the parser, renderer, storage, worker, and HTTP header layers."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY_GUARANTEES.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title}>
                  <CardHeader>
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-bg-elevated text-status-verified">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-text-muted">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 7: REAL APPLICATION STATISTICS (ZERO FABRICATED CLAIMS) */}
      <section
        id="stats"
        className="border-t border-border-subtle bg-bg-surface/40 py-16 scroll-mt-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                Transparent Application Telemetry
              </span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">
                Actual platform specifications &amp; your local metrics
              </h2>
            </div>
            <Badge variant="default" className="self-start font-mono text-[11px] sm:self-auto">
              Zero Fabricated Numbers
            </Badge>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {realStats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-5">
                  <p className="font-mono text-2xl font-bold text-text-primary sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-xs font-semibold text-text-secondary">{stat.label}</p>
                  <p className="mt-1 text-[11px] text-text-muted">{stat.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: FAQ */}
      <section id="faq" className="border-t border-border-subtle py-20 scroll-mt-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Questions & Answers"
            title="Frequently asked questions"
            description="Technical clarity on how PrivacyShield AI detects PII, preserves CSV integrity, and enforces client-side privacy."
            align="center"
          />

          <div className="mt-10">
            <FaqAccordion />
          </div>
        </div>
      </section>

      {/* FINAL CTA BANNER */}
      <section className="border-t border-border-subtle bg-bg-surface/60 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="glass-panel flex flex-col items-start justify-between gap-6 rounded-2xl p-8 sm:flex-row sm:items-center sm:p-10">
            <div className="space-y-2">
              <Badge variant="verified" className="font-mono text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Ready in Browser — No Sign-Up Required
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Sanitize sensitive documents in seconds.
              </h2>
              <p className="max-w-xl text-sm text-text-secondary">
                Launch the PrivacyShield AI workspace to paste text, upload .txt or .csv files,
                inspect live diffs, and export clean documents locally.
              </p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link to="/workspace">
                Launch Workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
