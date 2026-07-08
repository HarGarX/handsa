import { useNavigate } from 'react-router-dom';
import { ArrowRight, BrickWall, Layers, Lightbulb, Ruler, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';

const FEATURES = [
  {
    Icon: BrickWall,
    title: 'Draw walls, doors & windows',
    body: 'Click to place points, chain automatically, snap to a grid — corners fill in cleanly with square or round joints, no gaps.',
  },
  {
    Icon: Layers,
    title: 'Multi-discipline layers',
    body: 'Separate layers for electrical, plumbing, lighting & HVAC, and furniture, each with its own tools — reference the rest dimmed underneath.',
  },
  {
    Icon: Sparkles,
    title: 'Placement Assistant',
    body: 'Hover a room while furnishing it and get suggested spots for a sofa, TV stand, bed, and more — with a one-line reason for each.',
  },
  {
    Icon: Ruler,
    title: 'Measurements that matter',
    body: 'Live room areas, wall lengths, and a real drawing scale for export — built for planning a space, not for photorealism.',
  },
  {
    Icon: Lightbulb,
    title: 'Simple, on purpose',
    body: 'Furniture and fixtures are clean 2D symbols, not 3D renders — easy to read, easy to place, nothing standing between you and the layout.',
  },
  {
    Icon: ShieldCheck,
    title: '100% local',
    body: 'Every plan lives in this browser only. Nothing is uploaded, and there is no account required to use any of it.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);
  const displayName = useAuthStore((s) => s.displayName);
  const isFirstVisit = usePlanStore((s) => s.isFirstVisit);

  const primaryCtaLabel = isFirstVisit && !displayName ? 'Get started — no signup needed' : 'Continue editing';

  function enterApp() {
    if (!displayName) continueAsGuest();
    navigate('/app');
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold">Blueprint</span>
        <nav className="flex items-center gap-2 text-sm">
          {displayName ? (
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Continue to app
            </button>
          ) : (
            <>
              <button type="button" onClick={() => navigate('/login')} className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100">
                Log in
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Sign up
              </button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center sm:py-24">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            A floor plan editor that stays out of your way
          </h1>
          <p className="mt-5 max-w-xl text-lg text-gray-600">
            Sketch a room, lay out the wiring and plumbing, drop in furniture — all in your browser, all measured to
            scale, no design software learning curve.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={enterApp}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
            >
              {primaryCtaLabel}
              <ArrowRight size={18} />
            </button>
            {!displayName && (
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="rounded-lg border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Create a free account
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-400">No credit card, no email verification — just start drawing.</p>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-gray-100 p-6 shadow-sm">
                <Icon size={22} className="text-blue-600" />
                <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-gray-100 bg-gray-50 py-16">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <ShieldCheck size={28} className="mx-auto text-blue-600" />
            <h2 className="mt-3 text-2xl font-semibold">Your plans never leave your browser</h2>
            <p className="mt-2 text-gray-600">
              Blueprint saves everything to this browser's local storage. There's no server behind it, no account
              required to use it fully, and nothing about your floor plans is ever uploaded anywhere.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-center text-xs text-gray-400">
        Blueprint — a simple 2D floor plan editor.
      </footer>
    </div>
  );
}
