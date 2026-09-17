import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { Client, ActiveScreen, BiologicalSex, BodyCompositionMethod } from '../../types';
import { ALL_PERIMETER_IDS, PERIMETERS, PerimeterId } from '../../lib/perimeters';
import { BODY_COMPOSITION_METHODS } from '../../lib/bodyComposition';
import { cmToFtIn, ftInToCm } from '../../lib/units';

interface Props {
  onNavigate: (screen: ActiveScreen) => void;
  onSuccess: (client: Client) => void;
}

const STEP_TITLES = [
  'Name',
  'Biological Sex',
  'Body Composition Method',
  'Select Perimeters',
  'Unit System',
  'Height',
  'Date of Birth',
];

const TOTAL_STEPS = STEP_TITLES.length;

export const NewClientWizard: React.FC<Props> = ({ onNavigate, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [method, setMethod] = useState<BodyCompositionMethod | null>(null);
  const [selectedPerimeters, setSelectedPerimeters] = useState<PerimeterId[]>(ALL_PERIMETER_IDS);
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [dob, setDob] = useState('');

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return name.trim().length > 0;
      case 6:
        return unitSystem === 'metric' ? !!heightCm : !!heightFt || !!heightIn;
      default:
        return true;
    }
  };

  const togglePerimeter = (id: PerimeterId) => {
    setSelectedPerimeters((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleUnitChange = (next: 'metric' | 'imperial') => {
    // Keep the entered height consistent when switching units mid-wizard.
    if (next === unitSystem) return;
    if (next === 'imperial' && heightCm) {
      const { ft, inch } = cmToFtIn(parseFloat(heightCm));
      setHeightFt(String(ft));
      setHeightIn(String(inch));
    } else if (next === 'metric' && (heightFt || heightIn)) {
      const cm = ftInToCm(parseFloat(heightFt) || 0, parseFloat(heightIn) || 0);
      setHeightCm(cm.toFixed(1));
    }
    setUnitSystem(next);
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client not initialized');
      setLoading(false);
      return;
    }

    const finalHeightCm =
      unitSystem === 'metric'
        ? heightCm
          ? parseFloat(heightCm)
          : null
        : heightFt || heightIn
          ? ftInToCm(parseFloat(heightFt) || 0, parseFloat(heightIn) || 0)
          : null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const newRecord = {
        trainer_id: user.id,
        name: name.trim(),
        biological_sex: sex,
        body_composition_method: method,
        selected_perimeters: selectedPerimeters,
        unit_system: unitSystem,
        height_cm: finalHeightCm,
        date_of_birth: dob || null,
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
      console.error('Error creating client:', err);
      setError(err.message || 'Failed to create client.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (step === TOTAL_STEPS) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      onNavigate('dashboard');
    } else {
      setStep((s) => s - 1);
    }
  };

  return (
    <main className="max-w-md mx-auto px-5 py-6 pb-32 font-['Inter',sans-serif]">
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="p-2 -ml-2 rounded-full hover:bg-surface-alt text-text-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider">
            {step} of {TOTAL_STEPS}
          </p>
          <h2 className="text-xl font-semibold text-white">{STEP_TITLES[step - 1]}</h2>
        </div>
      </div>

      <div className="w-full h-1.5 bg-surface-alt rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-bg text-danger text-xs font-medium rounded-lg border border-danger/30">
          {error}
        </div>
      )}

      <div className="bg-surface rounded-xl p-5 border border-border min-h-[260px]">
        {step === 1 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Full Name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Sarah Jenkins"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-clinical w-full px-4 py-3 rounded-t-lg text-lg"
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {(['male', 'female'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                className={`py-8 rounded-xl border-2 font-semibold capitalize transition-colors ${
                  sex === s
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface-alt text-text-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            {BODY_COMPOSITION_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between ${
                  method === m.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface-alt text-text-muted'
                }`}
              >
                {m.label}
                {method === m.id && <Check className="w-4 h-4" />}
              </button>
            ))}
            <p className="text-xs text-text-muted pt-2">
              Calculation is not available yet — this only saves your preferred method.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-2">
            {PERIMETERS.map((p) => {
              const checked = selectedPerimeters.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePerimeter(p.id)}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium text-left flex items-center justify-between transition-colors ${
                    checked
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface-alt text-text-muted'
                  }`}
                >
                  {p.label}
                  {checked && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {step === 5 && (
          <div className="grid grid-cols-2 gap-3">
            {(['metric', 'imperial'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => handleUnitChange(u)}
                className={`py-8 rounded-xl border-2 font-semibold capitalize transition-colors ${
                  unitSystem === u
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface-alt text-text-muted'
                }`}
              >
                {u}
                <span className="block text-xs font-normal mt-1 normal-case">
                  {u === 'metric' ? 'kg · cm · mm' : 'lb · ft · in'}
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 6 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Height
            </label>
            {unitSystem === 'metric' ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="175"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="input-clinical w-full px-4 py-3 rounded-t-lg text-lg"
                />
                <span className="text-text-muted text-sm">cm</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number"
                    placeholder="5"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    className="input-clinical w-full px-4 py-3 rounded-t-lg text-lg"
                  />
                  <span className="text-text-muted text-sm">ft</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number"
                    placeholder="9"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    className="input-clinical w-full px-4 py-3 rounded-t-lg text-lg"
                  />
                  <span className="text-text-muted text-sm">in</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 7 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Date of Birth
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="input-clinical w-full px-4 py-3 rounded-t-lg text-lg"
            />
          </div>
        )}
      </div>

      <div className="pt-5">
        <button
          type="button"
          onClick={handleNext}
          disabled={loading || !canProceed()}
          className="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-lg py-3 rounded-lg btn-press flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          ) : step === TOTAL_STEPS ? (
            'Finish'
          ) : (
            'Next'
          )}
        </button>
      </div>
    </main>
  );
};
