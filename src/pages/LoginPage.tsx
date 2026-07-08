import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Nothing to authenticate against — there's no backend. A display name
    // is all this "session" is: derive one from the email so the TopBar has
    // something friendlier than the raw address to show.
    const displayName = email.split('@')[0] || 'Friend';
    login(displayName);
    navigate('/app');
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Welcome back."
      footer={
        <>
          Don't have an account?{' '}
          <button type="button" onClick={() => navigate('/register')} className="font-medium text-blue-600 hover:underline">
            Sign up
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder="••••••••"
          />
        </label>
        <button type="submit" className="mt-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Log in
        </button>
      </form>
    </AuthShell>
  );
}
