import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { PrivacyBadge } from '@/components/common/PrivacyBadge';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/utils/cn';

interface NavTarget {
  label: string;
  to: string;
  sectionId?: string;
}

const LANDING_LINKS: readonly NavTarget[] = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/#features', sectionId: 'features' },
  { label: 'How It Works', to: '/#how-it-works', sectionId: 'how-it-works' },
  { label: 'Security', to: '/#security', sectionId: 'security' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  function handleNavClick(target: NavTarget) {
    setMobileMenuOpen(false);

    if (target.sectionId) {
      if (location.pathname === '/') {
        const element = document.getElementById(target.sectionId);
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      navigate(`/#${target.sectionId}`);
      return;
    }

    if (target.to === '/' && location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    navigate(target.to);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border-default bg-bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-2.5 font-semibold tracking-tight focus-visible:rounded-md"
        >
          <img src="/logo.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="text-base font-bold text-text-primary">
            PrivacyShield <span className="text-brand-primary">AI</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {LANDING_LINKS.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/' && !location.hash
                : location.hash === `#${item.sectionId}`;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNavClick(item)}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-brand-primary/15 text-brand-primary'
                    : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                )}
              >
                {item.label}
              </button>
            );
          })}
          <Link
            to="/history"
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              location.pathname === '/history'
                ? 'bg-brand-primary/15 text-brand-primary'
                : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
            )}
          >
            Activity Log
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <PrivacyBadge className="hidden xl:inline-flex" />
          <ThemeToggle />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/workspace">
              Launch Workspace
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          className="border-t border-border-default bg-bg-surface px-4 pb-5 pt-3 lg:hidden"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {LANDING_LINKS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNavClick(item)}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary cursor-pointer"
              >
                {item.label}
              </button>
            ))}
            <Link
              to="/history"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
            >
              Activity Log
            </Link>
            <Link
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
            >
              Privacy Architecture
            </Link>
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4">
            <PrivacyBadge className="self-start" />
            <Button asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
              <Link to="/workspace">
                Launch Workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
