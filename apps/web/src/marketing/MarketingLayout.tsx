import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo, Threshold } from '../components/Logo';
import { btnClass, cx } from '../components/ui';

export const Container = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('mx-auto w-full max-w-[1200px] px-4 sm:px-6', className)}>{children}</div>
);

/** Full-width Threshold between major sections. */
export const Divider = ({ className }: { className?: string }) => <Container><Threshold className={className} /></Container>;

const NAV = [['/features', 'Features'], ['/pricing', 'Pricing'], ['/about', 'About'], ['/contact', 'Contact']];

export function MarketingLayout() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const onHero = pathname === '/' && !scrolled && !menu;

  useEffect(() => {
    document.documentElement.classList.remove('dark'); // marketing is always light
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setMenu(false), [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink-900">
      <a href="#content" className="sr-only z-tooltip rounded-control bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <header className={cx('sticky top-0 z-sticky h-[72px] transition-colors duration-base',
        onHero ? 'bg-transparent' : 'border-b border-slate-200 bg-paper/90 backdrop-blur', pathname === '/' && '-mb-[72px]')}>
        <Container className="flex h-full items-center gap-6">
          <Link to="/" aria-label="Gatekeeper home"><Logo reversed={onHero} /></Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => cx('rounded-control px-3 py-2 text-label transition-colors',
                onHero ? 'text-navy-100 hover:text-white' : isActive ? 'text-navy-900' : 'text-slate-600 hover:text-navy-900')}>{label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-4">
            <Link to="/login" className={cx('hidden h-11 items-center rounded-control px-4 text-label sm:inline-flex', onHero ? 'text-paper hover:bg-navy-800' : 'text-navy-900 hover:bg-slate-100')}>Sign in</Link>
            <Link to="/contact" className={cx(btnClass('primary'), 'hidden sm:inline-flex')}>Book a demo</Link>
            <button type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={menu ? 'Close menu' : 'Open menu'}
              className={cx('flex h-11 w-11 items-center justify-center rounded-full md:hidden', onHero ? 'text-paper' : 'text-navy-900')}>
              {menu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </Container>
        {menu && (
          <div className="fixed inset-x-0 bottom-0 top-[72px] z-sticky overflow-y-auto bg-paper px-4 py-6 md:hidden">
            <nav aria-label="Mobile" className="flex flex-col">
              {NAV.map(([to, label]) => <Link key={to} to={to} className="border-b border-slate-200 py-4 font-display text-[1.75rem] text-navy-900">{label}</Link>)}
            </nav>
            <div className="mt-8 grid gap-3">
              <Link to="/contact" className={btnClass('primary', 'lg', true)}>Book a demo</Link>
              <Link to="/login" className={btnClass('outline', 'lg', true)}>Sign in</Link>
            </div>
          </div>
        )}
      </header>

      <main id="content" className="flex-1"><Outlet /></main>

      <footer className="bg-navy-950 text-navy-200">
        <Container className="grid gap-10 py-16 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo reversed />
            <p className="mt-4 max-w-xs text-body-sm">Every arrival, accounted for. Gate, helpdesk and accounts for gated communities.</p>
          </div>
          {[
            ['Product', [['/features', 'Features'], ['/pricing', 'Pricing'], ['/login', 'Sign in']]],
            ['Company', [['/about', 'About'], ['/contact', 'Contact']]],
            ['Legal', [['/privacy', 'Privacy'], ['/terms', 'Terms']]],
            ['Contact', [['/contact', 'Book a demo'], ['mailto:hello@gatekeeper.example', 'hello@gatekeeper.example']]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <h2 className="text-label !text-paper">{title as string}</h2>
              <ul className="mt-3 space-y-2 text-body-sm">
                {(links as string[][]).map(([to, l]) => (
                  <li key={l}>{to.startsWith('mailto:') ? <a href={to} className="break-all text-paper/70 hover:text-paper">{l}</a> : <Link to={to} className="text-paper/70 hover:text-paper">{l}</Link>}</li>
                ))}
              </ul>
            </div>
          ))}
        </Container>
        <Container><Threshold /></Container>
        <Container className="flex flex-wrap justify-between gap-2 py-6 text-caption text-navy-300">
          <span>© 2026 Gatekeeper</span><span>Made in Bengaluru</span>
        </Container>
      </footer>
    </div>
  );
}
