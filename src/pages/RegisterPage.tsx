import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // No backend to register against — this just remembers the display name
    // locally, the same as logging in does.
    login(name || email.split('@')[0] || 'Friend');
    navigate('/app');
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle="Takes a few seconds — there's nothing to verify."
      footer={
        <>
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('/login')} className="font-medium text-blue-600 hover:underline">
            Log in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Name
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder="Alex Rivera"
          />
        </label>
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
          Sign up
        </button>
      </form>
    </AuthShell>
  );
}
