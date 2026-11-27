import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-brand-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Page Not Found</h1>
      <p className="mt-3 text-sm text-text-muted">
        The route you requested does not exist in PrivacyShield AI.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Return Home</Link>
      </Button>
    </section>
  );
}
