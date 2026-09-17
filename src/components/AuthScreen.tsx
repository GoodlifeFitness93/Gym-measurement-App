import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';

interface Props {
  onSuccess: () => void;
}

export const AuthScreen: React.FC<Props> = ({ onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client is not initialized.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setError('Please enter your full name');
          setLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // Check if session was created or confirmation is needed
        if (data.session) {
          // Attempt to update or ensure trainer_profile row exists
          const user = data.session.user;
          if (user) {
            try {
              await supabase.from('trainer_profiles').upsert({
                id: user.id,
                full_name: fullName.trim(),
                unit_preference: 'metric',
              }, { onConflict: 'id' });
            } catch (pErr) {
              console.error('Failed to upsert trainer profile:', pErr);
            }
          }
          onSuccess();
        } else if (data.user) {
          // User created but needs email confirmation or direct sign in
          setError('Account created! Please check your email to confirm or try logging in.');
          setIsSignUp(false);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          const rawMessage = (signInError.message || '').toLowerCase();
          if (rawMessage.includes('banned') || rawMessage.includes('disabled')) {
            setError('Your Goodlife Fitness trainer account is currently inactive. Please contact the administrator.');
          } else {
            setError(signInError.message || 'Invalid email or password.');
          }
          setLoading(false);
          return;
        }

        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-ink min-h-screen flex flex-col items-center justify-center p-5 font-['Inter',sans-serif] text-white">
      <main className="w-full max-w-md flex flex-col items-center">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-surface rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.3)] flex items-center justify-center border border-border mb-4 overflow-hidden">
            <img src="/android-chrome-512x512.png" alt="Goodlife Fitness" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">
            Goodlife Fitness
          </h1>
          <p className="text-base text-text-muted tracking-wide">
            Precision Coaching
          </p>
        </div>

        {/* Auth Form Card */}
        <form
          onSubmit={handleSubmit}
          className="w-full bg-surface p-6 md:p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.3)] border border-border flex flex-col gap-6"
        >
          {/* Form Toggle Tabs */}
          <div className="flex border-b border-border pb-1">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(null); }}
              className={`flex-1 py-2 text-center text-sm font-semibold uppercase tracking-wider transition-colors ${
                !isSignUp
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(null); }}
              className={`flex-1 py-2 text-center text-sm font-semibold uppercase tracking-wider transition-colors ${
                isSignUp
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="p-3 bg-danger-bg text-danger text-xs font-medium rounded border border-danger/20">
              {error}
            </div>
          )}

          {isSignUp && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Coach Sarah Jenkins"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-clinical w-full px-4 py-3 rounded-t-lg border-0 border-b-2 text-base text-white placeholder:text-text-muted"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-text-muted"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="coach@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-clinical w-full px-4 py-3 rounded-t-lg border-0 border-b-2 text-base text-white placeholder:text-text-muted"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center w-full">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                Password
              </label>
              {!isSignUp && (
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); alert('Please request password reset from your administrator or Supabase dashboard.'); }}
                  className="text-sm text-accent hover:underline"
                >
                  Reset?
                </a>
              )}
            </div>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-clinical w-full px-4 py-3 rounded-t-lg border-0 border-b-2 text-base text-white placeholder:text-text-muted"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-accent hover:bg-accent-hover text-white py-3 px-6 rounded-lg font-semibold text-lg btn-press shadow-[0_4px_12px_rgba(255,106,26,0.25)] flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
            ) : (
              <>
                {isSignUp ? 'Sign up' : 'Log in'}
                <span className="material-symbols-outlined text-white text-lg">
                  arrow_forward
                </span>
              </>
            )}
          </button>
        </form>

        {/* Minimal Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-text-muted">System version 4.2.1-stable</p>
        </div>
      </main>
    </div>
  );
};
