import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, ActiveScreen } from '../types';

interface Props {
  onNavigate: (screen: ActiveScreen) => void;
  onSuccess: (client: Client) => void;
}

export const AddClientModal: React.FC<Props> = ({ onNavigate, onSuccess }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [startingWeight, setStartingWeight] = useState('');
  const [goalNotes, setGoalNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter client full name.');
      return;
    }

    if (startingWeight && parseFloat(startingWeight) < 0) {
      setError('Starting weight cannot be a negative number.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client not initialized');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const newRecord = {
        trainer_id: user.id,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        starting_weight: startingWeight ? parseFloat(startingWeight) : null,
        goal_notes: goalNotes.trim() || null,
      };

      const { data, error: insertErr } = await supabase
        .from('clients')
        .insert(newRecord)
        .select()
        .single();

      if (insertErr) throw insertErr;

      onSuccess(data);
      onNavigate('client_profile');
    } catch (err: any) {
      console.error('Error adding new client:', err);
      setError(err.message || 'Failed to add client.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-5 py-6 pb-32 font-['Inter',sans-serif]">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[#111c2d]">Add New Client</h2>
        <p className="text-xs text-[#3e4947]">Create a profile to start tracking client progress</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[#ffdad6] text-[#93000a] text-xs font-medium rounded-lg border border-[#ba1a1a]/20">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Client Full Name <span className="text-[#ba1a1a]">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Sarah Jenkins"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-base text-[#111c2d] placeholder:text-[#6e7977]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              placeholder="+1 (555) 019-2834"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-base text-[#111c2d] placeholder:text-[#6e7977]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Email Address (Optional)
            </label>
            <input
              type="email"
              placeholder="client@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-base text-[#111c2d] placeholder:text-[#6e7977]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Starting Weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 72.0"
              value={startingWeight}
              onChange={(e) => setStartingWeight(e.target.value)}
              className="input-clinical w-full px-4 py-2.5 rounded-t-lg text-base text-[#111c2d] placeholder:text-[#6e7977]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
              Goal Notes / Milestones
            </label>
            <textarea
              rows={3}
              placeholder="Target weight, training preferences, injuries or dietary goals..."
              value={goalNotes}
              onChange={(e) => setGoalNotes(e.target.value)}
              className="w-full p-3 bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] rounded-t text-sm text-[#111c2d] focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#005c55] hover:bg-[#0f766e] text-white font-semibold text-lg py-3 rounded-lg shadow-[0_4px_12px_rgba(15,118,110,0.15)] btn-press flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span className="material-symbols-outlined">person_add</span>
                Create Client Profile
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
};
