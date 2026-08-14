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
          setError(signInError.message || 'Invalid email or password.');
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
    <div className="bg-[#f9f9ff] min-h-screen flex flex-col items-center justify-center p-5 font-['Inter',sans-serif] text-[#111c2d]">
      <main className="w-full max-w-md flex flex-col items-center">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white rounded-xl shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex items-center justify-center border border-[#bdc9c6] mb-4">
            <span
              className="material-symbols-outlined text-[#005c55] text-4xl"
              data-icon="monitor_heart"
              data-weight="fill"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              monitor_heart
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#111c2d] mb-1">
            FitTrack Pro
          </h1>
          <p className="text-base text-[#3e4947] tracking-wide">
            Precision Coaching
          </p>
        </div>

        {/* Auth Form Card */}
        <form
          onSubmit={handleSubmit}
          className="w-full bg-white p-6 md:p-8 rounded-xl shadow-[0_4px_12px_rgba(15,118,110,0.05)] border border-[#bdc9c6] flex flex-col gap-6"
        >
          {/* Form Toggle Tabs */}
          <div className="flex border-b border-[#bdc9c6] pb-1">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(null); }}
              className={`flex-1 py-2 text-center text-sm font-semibold uppercase tracking-wider transition-colors ${
                !isSignUp
                  ? 'text-[#005c55] border-b-2 border-[#005c55]'
                  : 'text-[#6e7977] hover:text-[#111c2d]'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(null); }}
              className={`flex-1 py-2 text-center text-sm font-semibold uppercase tracking-wider transition-colors ${
                isSignUp
                  ? 'text-[#005c55] border-b-2 border-[#005c55]'
                  : 'text-[#6e7977] hover:text-[#111c2d]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="p-3 bg-[#ffdad6] text-[#93000a] text-xs font-medium rounded border border-[#ba1a1a]/20">
              {error}
            </div>
          )}

          {isSignUp && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#3e4947]">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Coach Sarah Jenkins"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-clinical w-full px-4 py-3 rounded-t-lg border-0 border-b-2 text-base text-[#111c2d] placeholder:text-[#6e7977]"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-[#3e4947]"
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
              className="input-clinical w-full px-4 py-3 rounded-t-lg border-0 border-b-2 text-base text-[#111c2d] placeholder:text-[#6e7977]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center w-full">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-[#3e4947]"
              >
                Password
              </label>
              {!isSignUp && (
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); alert('Please request password reset from your administrator or Supabase dashboard.'); }}
                  className="text-sm text-[#005c55] hover:underline"
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
              className="input-clinical w-full px-4 py-3 rounded-t-lg border-0 border-b-2 text-base text-[#111c2d] placeholder:text-[#6e7977]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#005c55] hover:bg-[#0f766e] text-white py-3 px-6 rounded-lg font-semibold text-lg btn-press shadow-[0_4px_12px_rgba(15,118,110,0.15)] flex justify-center items-center gap-2 disabled:opacity-50"
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
          <p className="text-xs text-[#3e4947]">System version 4.2.1-stable</p>
        </div>
      </main>
    </div>
  );
};
