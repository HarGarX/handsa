import { Plus, Copy, Trash2, X } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';

export function PlansModal() {
  const show = usePlanStore((s) => s.showPlansModal);
  const setShow = usePlanStore((s) => s.setShowPlansModal);
  const plansIndex = usePlanStore((s) => s.plansIndex);
  const currentPlanId = usePlanStore((s) => s.plan.id);
  const newPlan = usePlanStore((s) => s.newPlan);
  const duplicatePlan = usePlanStore((s) => s.duplicatePlan);
  const switchPlan = usePlanStore((s) => s.switchPlan);
  const deletePlan = usePlanStore((s) => s.deletePlan);

  if (!show) return null;

  const sorted = [...plansIndex].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={() => setShow(false)}
    >
      <div
        className="flex max-h-[70vh] w-96 flex-col gap-3 rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">My Plans</h2>
          <button
            type="button"
            title="Close"
            onClick={() => setShow(false)}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <button
          type="button"
          title="Create a new, empty plan and switch to it"
          onClick={newPlan}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Plus size={15} />
          New plan
        </button>

        <div className="flex flex-col gap-1 overflow-y-auto">
          {sorted.length === 0 && <p className="py-6 text-center text-xs text-gray-400">No saved plans yet.</p>}
          {sorted.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                p.id === currentPlanId ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <button
                type="button"
                title={p.id === currentPlanId ? 'Currently open plan' : `Switch to "${p.name}"`}
                className="flex-1 truncate text-left text-sm text-gray-800"
                onClick={() => switchPlan(p.id)}
              >
                {p.name}
                <div className="text-[10px] font-normal text-gray-400">
                  {new Date(p.updatedAt).toLocaleString()}
                </div>
              </button>
              <button
                type="button"
                title="Duplicate this plan as a new copy"
                onClick={() => {
                  if (p.id !== currentPlanId) switchPlan(p.id);
                  duplicatePlan();
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                title="Delete this plan permanently"
                onClick={() => {
                  if (window.confirm(`Delete plan "${p.name}"? This cannot be undone.`)) deletePlan(p.id);
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
