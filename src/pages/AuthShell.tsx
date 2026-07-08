import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Shared chrome for the login/register screens — a centered card plus the disclosure that this is a local-only demo. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const navigate = useNavigate();
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 text-lg font-semibold text-gray-900 hover:text-blue-600"
      >
        Blueprint
      </button>

      <div className="w-full max-w-sm rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>

        <div className="mt-6">{children}</div>

        <p className="mt-4 text-center text-xs text-gray-400">
          This is a demo account — nothing is sent anywhere, and your name is only remembered on this device.
        </p>

        <button
          type="button"
          onClick={() => {
            continueAsGuest();
            navigate('/app');
          }}
          className="mt-4 w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Skip this, continue as guest
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-500">{footer}</div>
    </div>
  );
}
