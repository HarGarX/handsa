import { usePlanStore } from '../store/usePlanStore';

/**
 * A small floating reminder shown while a multi-click chain (Wall or Run) is
 * in progress. Walls commit a real `Wall` on every click, so there's little
 * risk of lost work there — but Runs don't become a real `Run` until the
 * chain is explicitly finished, and nothing else on screen says so. This is
 * the "so you don't wonder where it went" half of that fix; the other half
 * (never actually losing a run you forgot to finish) lives in the store.
 */
export function DraftHint() {
  const wallDraft = usePlanStore((s) => s.interaction.wallDraft);
  const runDraft = usePlanStore((s) => s.interaction.runDraft);

  let text: string | null = null;
  if (runDraft) {
    text = 'Click to add a point · Enter or double-click to finish · Esc to cancel (finished points are saved automatically even if you switch tools)';
  } else if (wallDraft) {
    text = 'Click to place the next wall · Enter or double-click to finish · Esc to cancel · Shift for a free angle';
  }

  if (!text) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm">
      {text}
    </div>
  );
}
