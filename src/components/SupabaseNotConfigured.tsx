import React, { useState } from 'react';
import { validateSupabaseConfig, getSupabaseConfig, saveOverrideConfig } from '../lib/supabase';

interface Props {
  onConfigured: () => void;
}

export const SupabaseNotConfigured: React.FC<Props> = ({ onConfigured }) => {
  const validation = validateSupabaseConfig();
  const currentConfig = getSupabaseConfig();

  const [inputUrl, setInputUrl] = useState(currentConfig.url || '');
  const [inputKey, setInputKey] = useState(validation.keyIsMasked ? '' : (currentConfig.key || ''));
  const [formError, setFormError] = useState<string | null>(null);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl || (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://'))) {
      setFormError('Please enter a valid Supabase Project URL (e.g. https://xyz.supabase.co)');
      return;
    }
    if (!inputKey || inputKey.length < 20 || inputKey.includes('•')) {
      setFormError('Please enter a valid, unmasked Supabase Anon Key (raw JWT key, not bullet characters).');
      return;
    }

    saveOverrideConfig(inputUrl, inputKey);
    setFormError(null);
    onConfigured();
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col justify-center items-center p-6 text-[#111c2d] font-['Inter',sans-serif]">
      <main className="w-full max-w-lg bg-white p-8 rounded-xl border border-[#bdc9c6] shadow-[0_4px_12px_rgba(15,118,110,0.05)]">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-[#e7eeff] rounded-xl flex items-center justify-center text-[#005c55] mb-3">
            <span className="material-symbols-outlined text-4xl" data-weight="fill">
              database
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#005c55]">Supabase Setup</h1>
          <p className="text-sm text-[#3e4947] mt-1">
            FitTrack Pro requires a valid Supabase Project URL and Anon Key to connect.
          </p>
        </div>

        {/* Masked Key Diagnostic Banner */}
        {validation.keyIsMasked && (
          <div className="mb-6 p-4 bg-[#fff3cd] border-l-4 border-[#ffc107] text-[#856404] rounded text-sm space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#664d03]">
              <span className="material-symbols-outlined text-lg">warning</span>
              Masked Password Bullets Detected in Environment
            </div>
            <p className="text-xs leading-relaxed">
              <code className="font-mono bg-white px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> contains masked bullet characters (<strong className="font-mono">••••••</strong>) instead of the actual key string.
            </p>
            <p className="text-xs">
              Please copy the raw <strong className="font-semibold">anon public</strong> key from your Supabase Dashboard (<span className="italic">Project Settings &gt; API</span>) and enter it below or in your environment.
            </p>
          </div>
        )}

        {/* Other Validation Errors */}
        {!validation.keyIsMasked && (!validation.urlValid || !validation.keyValid) && (
          <div className="mb-6 p-4 bg-[#ffdad6] border-l-4 border-[#ba1a1a] text-[#93000a] text-xs rounded space-y-1">
            {validation.urlError && <p>• {validation.urlError}</p>}
            {validation.keyError && <p>• {validation.keyError}</p>}
          </div>
        )}

        {formError && (
          <div className="mb-4 p-3 bg-[#ffdad6] text-[#93000a] text-xs rounded border border-[#ba1a1a]/20">
            {formError}
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyz.supabase.co"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-sm text-[#111c2d] placeholder:text-[#6e7977]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Supabase Anon Key (Raw Key)
            </label>
            <input
              type="text"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-sm text-[#111c2d] placeholder:text-[#6e7977]"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#005c55] hover:bg-[#0f766e] text-white py-3 px-6 rounded-lg font-semibold text-base btn-press shadow-[0_4px_12px_rgba(15,118,110,0.15)] flex justify-center items-center gap-2"
          >
            Connect Database
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#d8e3fb] text-center">
          <button
            type="button"
            onClick={onConfigured}
            className="text-xs font-semibold text-[#005c55] hover:underline flex items-center justify-center gap-1 mx-auto"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Re-check Environment Variables
          </button>
        </div>
      </main>
    </div>
  );
};


