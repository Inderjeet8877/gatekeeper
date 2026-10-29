import { Link } from 'react-router-dom';
import { Logo, Threshold } from '../components/Logo';
import { btnClass } from '../components/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <Link to="/"><Logo /></Link>
      <Threshold className="my-10 w-full max-w-xs" />
      <h1 className="font-display text-display-md">This page isn't on the register.</h1>
      <p className="mt-3 max-w-md text-body text-fg-muted">The link may be old or mistyped. Head back and try again from the start.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className={btnClass('outline')}>Go to homepage</Link>
        <Link to="/app" className={btnClass('primary')}>Open the app</Link>
      </div>
    </main>
  );
}
