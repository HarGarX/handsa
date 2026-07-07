import { useEffect } from 'react';
import { usePlanStore } from '../store/usePlanStore';

export function Toast() {
  const message = usePlanStore((s) => s.toastMessage);
  const setToast = usePlanStore((s) => s.setToast);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [message, setToast]);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}
