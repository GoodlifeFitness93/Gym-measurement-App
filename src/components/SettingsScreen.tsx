import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
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
        <h2 className="text-2xl font-semibold text-white">Account & Settings</h2>
        <p className="text-sm text-text-muted">Manage your trainer profile & preferences</p>
      </div>

      {error && (
        <div className="p-3 bg-danger-bg text-danger text-xs font-medium rounded-lg border border-danger/20">
          {error}
        </div>
      )}

      {/* Trainer Profile Card */}
      <form onSubmit={handleSaveProfile} className="bg-surface rounded-xl p-6 border border-border shadow-[0_4px_12px_rgba(0,0,0,0.25)] space-y-4">
        <h3 className="text-lg font-semibold text-accent pb-2 border-b border-border">
          Trainer Profile
        </h3>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-base text-white"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-base text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Unit Preference
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setUnitPreference('metric')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border transition-all ${
                unitPreference === 'metric'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface-alt text-text-muted border-border'
              }`}
            >
              Metric (kg, cm)
            </button>
            <button
              type="button"
              onClick={() => setUnitPreference('imperial')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border transition-all ${
                unitPreference === 'imperial'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface-alt text-text-muted border-border'
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
            className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-lg btn-press shadow"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

          {saveSuccess && (
            <span className="text-xs text-accent font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Changes saved!
            </span>
          )}
        </div>
      </form>

      {/* Logout Action Card */}
      <div className="bg-surface rounded-xl p-6 border border-border shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-white">Sign Out</h4>
          <p className="text-xs text-text-muted">End your active coaching session safely.</p>
        </div>

        <button
          type="button"
          onClick={handleLogoutClick}
          className="bg-danger-bg hover:bg-danger hover:text-white text-danger text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Log Out
        </button>
      </div>
    </div>
  );
};
