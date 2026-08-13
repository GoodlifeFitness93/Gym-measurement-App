import React, { useState } from 'react';
import { saveSupabaseConfig, getSupabaseConfig } from '../lib/supabase';

interface Props {
  onConfigured: () => void;
}

export const SupabaseNotConfigured: React.FC<Props> = ({ onConfigured }) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [key, setKey] = useState(currentConfig.key);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !url.startsWith('http')) {
      setError('Please enter a valid Supabase Project URL (e.g. https://xyz.supabase.co)');
      return;
    }
    if (!key || key.length < 10) {
      setError('Please enter a valid Supabase Anon Key');
      return;
    }

    saveSupabaseConfig(url, key);
    setError(null);
    onConfigured();
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col justify-center items-center p-6 text-[#111c2d]">
      <main className="w-full max-w-lg bg-white p-8 rounded-xl border border-[#bdc9c6] shadow-[0_4px_12px_rgba(15,118,110,0.05)]">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-[#e7eeff] rounded-xl flex items-center justify-center text-[#005c55] mb-3">
            <span className="material-symbols-outlined text-4xl" data-weight="fill">
              database
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#005c55]">Supabase Not Configured</h1>
          <p className="text-sm text-[#3e4947] mt-1">
            FitTrack Pro requires Supabase database credentials to run.
          </p>
        </div>

        <div className="bg-[#f0f3ff] border-l-4 border-[#0f766e] p-4 rounded text-sm text-[#3e4947] mb-6 space-y-2">
          <p className="font-semibold text-[#111c2d]">Option 1: Set Environment Variables</p>
          <p>Add these variables to your <code className="bg-white px-1 py-0.5 rounded text-xs font-mono">.env</code> file:</p>
          <pre className="bg-[#1e293b] text-[#80d5cb] p-3 rounded text-xs font-mono overflow-x-auto leading-relaxed">
            VITE_SUPABASE_URL="https://your-project.supabase.co"{"\n"}
            VITE_SUPABASE_ANON_KEY="your-anon-key"
          </pre>
        </div>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#bdc9c6]"></div>
          </div>
          <span className="relative bg-white px-3 text-xs font-semibold text-[#6e7977] uppercase tracking-wider">
            Option 2: Connect Directly
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#ffdad6] text-[#93000a] text-sm rounded border border-[#ba1a1a]/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyz.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-sm text-[#111c2d] placeholder:text-[#6e7977]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Supabase Anon Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOi..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-sm text-[#111c2d] placeholder:text-[#6e7977]"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#005c55] hover:bg-[#0f766e] text-white py-3 px-6 rounded-lg font-semibold text-base btn-press shadow-[0_4px_12px_rgba(15,118,110,0.15)] flex justify-center items-center gap-2"
          >
            Connect & Continue
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </form>
      </main>
    </div>
  );
};
