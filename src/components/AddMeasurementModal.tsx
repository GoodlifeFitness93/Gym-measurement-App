import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, ActiveScreen } from '../types';

interface Props {
  client: Client;
  onNavigate: (screen: ActiveScreen) => void;
  onSuccess: () => void;
}

export const AddMeasurementModal: React.FC<Props> = ({
  client,
  onNavigate,
  onSuccess,
}) => {
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [weight, setWeight] = useState<string>('');
  const [bodyFat, setBodyFat] = useState<string>('');
  const [chest, setChest] = useState<string>('');
  const [waist, setWaist] = useState<string>('');
  const [hips, setHips] = useState<string>('');
  const [neck, setNeck] = useState<string>('');
  const [arm, setArm] = useState<string>('');
  const [thigh, setThigh] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const parseVal = (val: string): number | null => {
    if (!val || val.trim() === '') return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate no negative numbers
    const values = [weight, bodyFat, chest, waist, hips, neck, arm, thigh];
    for (const v of values) {
      if (v && parseFloat(v) < 0) {
        setError('Measurement values cannot be negative numbers.');
        return;
      }
    }

    setLoading(true);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client not initialized');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const parsedWeight = parseVal(weight);
      const parsedBodyFat = parseVal(bodyFat);
      const parsedChest = parseVal(chest);
      const parsedWaist = parseVal(waist);
      const parsedHips = parseVal(hips);
      const parsedNeck = parseVal(neck);
      const parsedArm = parseVal(arm);
      const parsedThigh = parseVal(thigh);

      const record: any = {
        client_id: client.id,
        trainer_id: user.id,
        measured_at: date,
        date: date,
        weight: parsedWeight,
        body_fat_percent: parsedBodyFat,
        chest: parsedChest,
        waist: parsedWaist,
        hips: parsedHips,
        neck: parsedNeck,
        arm: parsedArm,
        thigh: parsedThigh,
        unit: unit,
        notes: notes.trim() || null,
      };

      const { error: insertErr } = await supabase
        .from('measurements')
        .insert(record);

      if (insertErr) throw insertErr;

      onSuccess();
      onNavigate('client_profile');
    } catch (err: any) {
      console.error('Error saving measurement:', err);
      setError(err.message || 'Failed to save measurement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-5 py-6 pb-32 font-['Inter',sans-serif]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#111c2d]">Add Measurement</h2>
          <p className="text-xs text-[#3e4947]">Logging entry for {client.name}</p>
        </div>

        {/* Unit Toggle */}
        <div className="bg-[#f0f3ff] p-1 rounded-lg border border-[#bdc9c6]/50 flex gap-1">
          <button
            type="button"
            onClick={() => setUnit('metric')}
            className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded ${
              unit === 'metric'
                ? 'bg-[#005c55] text-white shadow-xs'
                : 'text-[#3e4947] hover:text-[#111c2d]'
            }`}
          >
            Metric (kg/cm)
          </button>
          <button
            type="button"
            onClick={() => setUnit('imperial')}
            className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded ${
              unit === 'imperial'
                ? 'bg-[#005c55] text-white shadow-xs'
                : 'text-[#3e4947] hover:text-[#111c2d]'
            }`}
          >
            Imperial (lbs/in)
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[#ffdad6] text-[#93000a] text-xs font-medium rounded-lg border border-[#ba1a1a]/20">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date Picker */}
        <div className="bg-white rounded-xl p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="date">
            Date
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6e7977]">
              calendar_month
            </span>
            <input
              id="date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] pl-10 pr-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Core Metrics */}
        <div className="bg-white rounded-xl p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] space-y-3">
          <h3 className="text-lg font-semibold text-[#005c55] pb-1 border-b border-[#d8e3fb]">
            Core Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="weight">
                Weight ({unit === 'metric' ? 'kg' : 'lbs'})
              </label>
              <input
                id="weight"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="bodyfat">
                Body Fat (%)
              </label>
              <input
                id="bodyfat"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Circumferences */}
        <div className="bg-white rounded-xl p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] space-y-3">
          <h3 className="text-lg font-semibold text-[#005c55] pb-1 border-b border-[#d8e3fb]">
            Circumferences ({unit === 'metric' ? 'cm' : 'in'})
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="chest">
                Chest
              </label>
              <input
                id="chest"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={chest}
                onChange={(e) => setChest(e.target.value)}
                className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="waist">
                Waist
              </label>
              <input
                id="waist"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="hips">
                Hips
              </label>
              <input
                id="hips"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={hips}
                onChange={(e) => setHips(e.target.value)}
                className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="neck">
                Neck
              </label>
              <input
                id="neck"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={neck}
                onChange={(e) => setNeck(e.target.value)}
                className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="arm">
                Arm
              </label>
              <input
                id="arm"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={arm}
                onChange={(e) => setArm(e.target.value)}
                className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="thigh">
                Thigh
              </label>
              <input
                id="thigh"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={thigh}
                onChange={(e) => setThigh(e.target.value)}
                className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-base text-[#111c2d] rounded-t transition-colors focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Optional Notes */}
        <div className="bg-white rounded-xl p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1" htmlFor="notes">
            Measurement Notes (Optional)
          </label>
          <input
            id="notes"
            type="text"
            placeholder="e.g. Measured morning before breakfast"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-[#f1f5f9] border-0 border-b-2 border-transparent focus:border-[#005c55] px-3 py-2.5 text-sm text-[#111c2d] rounded-t transition-colors focus:outline-none"
          />
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
                <span className="material-symbols-outlined">save</span>
                Save Measurement
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
};
