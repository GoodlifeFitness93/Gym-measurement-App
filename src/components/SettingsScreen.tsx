import React, { useEffect, useState } from 'react';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { TrainerProfile, ActiveScreen } from '../types';

interface Props {
  onNavigate: (screen: ActiveScreen) => void;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<Props> = ({ onLogout }) => {
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [unitPreference, setUnitPreference] = useState<'metric' | 'imperial'>('metric');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read-only Supabase Config
  const envConfig = getSupabaseConfig();

  const fetchProfile = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: err } = await supabase
        .from('trainer_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!err && data) {
        setProfile(data);
        setFullName(data.full_name || user.user_metadata?.full_name || '');
        setPhone(data.phone || '');
        setUnitPreference(data.unit_preference || 'metric');
      } else {
        setFullName(user.user_metadata?.full_name || user.email || '');
      }
    } catch (err) {
      console.error('Error fetching trainer profile:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client not initialized.');
      setSaving(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { error: upsertErr } = await supabase.from('trainer_profiles').upsert({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        unit_preference: unitPreference,
      });

      if (upsertErr) throw upsertErr;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Save profile error:', err);
      setError(err.message || 'Failed to save trainer profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutClick = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => null);
    }
    onLogout();
  };

  return (
    <div className="px-5 py-6 max-w-2xl mx-auto space-y-6 pb-28 font-['Inter',sans-serif]">
      <div>
        <h2 className="text-2xl font-semibold text-[#111c2d]">Account & Settings</h2>
        <p className="text-sm text-[#3e4947]">Manage your trainer profile & preferences</p>
      </div>

      {error && (
        <div className="p-3 bg-[#ffdad6] text-[#93000a] text-xs font-medium rounded-lg border border-[#ba1a1a]/20">
          {error}
        </div>
      )}

      {/* Trainer Profile Card */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-xl p-6 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] space-y-4">
        <h3 className="text-lg font-semibold text-[#005c55] pb-2 border-b border-[#d8e3fb]">
          Trainer Profile
        </h3>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-base text-[#111c2d]"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-base text-[#111c2d]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-2">
            Unit Preference
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setUnitPreference('metric')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border transition-all ${
                unitPreference === 'metric'
                  ? 'bg-[#005c55] text-white border-[#005c55]'
                  : 'bg-[#f0f3ff] text-[#3e4947] border-[#bdc9c6]'
              }`}
            >
              Metric (kg, cm)
            </button>
            <button
              type="button"
              onClick={() => setUnitPreference('imperial')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border transition-all ${
                unitPreference === 'imperial'
                  ? 'bg-[#005c55] text-white border-[#005c55]'
                  : 'bg-[#f0f3ff] text-[#3e4947] border-[#bdc9c6]'
              }`}
            >
              Imperial (lbs, in)
            </button>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-lg btn-press shadow"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

          {saveSuccess && (
            <span className="text-xs text-[#0f766e] font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Changes saved!
            </span>
          )}
        </div>
      </form>

      {/* Read-only Database Connection Info */}
      <div className="bg-white rounded-xl p-6 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] space-y-4">
        <h3 className="text-lg font-semibold text-[#005c55] pb-2 border-b border-[#d8e3fb] flex items-center justify-between">
          <span>Supabase Connection</span>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#86f2e4] text-[#006f66] uppercase">
            Connected via Env
          </span>
        </h3>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
            Supabase URL
          </label>
          <input
            type="text"
            readOnly
            value={envConfig.url || 'Not configured'}
            className="bg-[#f1f5f9] border border-[#bdc9c6]/50 w-full px-4 py-2 text-xs font-mono text-[#6e7977] rounded-lg focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
            Supabase Anon Key
          </label>
          <input
            type="password"
            readOnly
            value={envConfig.key ? '••••••••••••••••••••••••••••••••' : 'Not configured'}
            className="bg-[#f1f5f9] border border-[#bdc9c6]/50 w-full px-4 py-2 text-xs font-mono text-[#6e7977] rounded-lg focus:outline-none"
          />
        </div>
      </div>

      {/* Logout Action Card */}
      <div className="bg-white rounded-xl p-6 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-[#111c2d]">Sign Out</h4>
          <p className="text-xs text-[#3e4947]">End your active coaching session safely.</p>
        </div>

        <button
          type="button"
          onClick={handleLogoutClick}
          className="bg-[#ffdad6] hover:bg-[#ba1a1a] hover:text-white text-[#93000a] text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Log Out
        </button>
      </div>
    </div>
  );
};
