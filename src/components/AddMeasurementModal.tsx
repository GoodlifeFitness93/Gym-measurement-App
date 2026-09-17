import React, { useEffect, useState, useRef } from 'react';
import { Info, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Client, ActiveScreen, CustomMeasure, Measurement } from '../types';
import { PERIMETERS, PerimeterId } from '../lib/perimeters';
import { cmToIn, inToCm, parsePerimeterInput } from '../lib/units';
import { PerimeterInstructionsModal } from './PerimeterInstructionsModal';
import { AnatomyDiagram } from './AnatomyDiagram';

interface Props {
  client: Client;
  onNavigate: (screen: ActiveScreen) => void;
  onSuccess: () => void;
  editMeasurement?: Measurement | null;
}

const inputClass =
  'w-full bg-surface-alt border-0 border-b-2 border-transparent focus:border-accent px-3 py-2.5 text-base text-white rounded-t transition-colors focus:outline-none';

export const AddMeasurementModal: React.FC<Props> = ({
  client,
  onNavigate,
  onSuccess,
  editMeasurement,
}) => {
  const isEditing = !!editMeasurement;
  const [unit, setUnit] = useState<'metric' | 'imperial'>(editMeasurement?.unit || client.unit_system || 'metric');
  const [perimeterUnit, setPerimeterUnit] = useState<'cm' | 'in'>(
    client.unit_system === 'imperial' ? 'in' : 'cm'
  );
  const [date, setDate] = useState<string>(editMeasurement?.measured_on || new Date().toISOString().split('T')[0]);
  const [sessionName, setSessionName] = useState<string>(editMeasurement?.session_name || '');

  const [weight, setWeight] = useState<string>(editMeasurement?.weight != null ? String(editMeasurement.weight) : '');
  const [bodyFat, setBodyFat] = useState<string>(editMeasurement?.body_fat_percent != null ? String(editMeasurement.body_fat_percent) : '');
  const [perimeterValues, setPerimeterValues] = useState<Record<string, string>>(() => {
    if (!editMeasurement) return {};
    const initial: Record<string, string> = {};
    for (const p of PERIMETERS) {
      const val = (editMeasurement as any)[p.dbColumn];
      if (val != null) initial[p.id] = String(val);
    }
    return initial;
  });
  const [notes, setNotes] = useState<string>(editMeasurement?.notes || '');

  const [customMeasures, setCustomMeasures] = useState<CustomMeasure[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const [showInstructions, setShowInstructions] = useState(false);
  const [showDiagram, setShowDiagram] = useState(true);
  const [diagramView, setDiagramView] = useState<'front' | 'back'>('front');
  const [focusedPerimeter, setFocusedPerimeter] = useState<PerimeterId | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inputRefs = useRef<Partial<Record<PerimeterId, HTMLInputElement | null>>>({});

  const selectedPerimeters = PERIMETERS.filter((p) =>
    (client.selected_perimeters || []).includes(p.id)
  );

  useEffect(() => {
    const fetchCustomMeasures = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('custom_measures')
        .select('*')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: true });
      if (data) setCustomMeasures(data);

      if (editMeasurement?.id) {
        const { data: existingValues } = await supabase
          .from('custom_measure_values')
          .select('custom_measure_id, value')
          .eq('measurement_id', editMeasurement.id);
        if (existingValues) {
          const prefill: Record<string, string> = {};
          for (const v of existingValues) prefill[v.custom_measure_id] = String(v.value);
          setCustomValues(prefill);
        }
      }
    };
    fetchCustomMeasures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async () => {
    if (!editMeasurement?.id) return;
    setDeleting(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error: delErr } = await supabase.from('measurements').delete().eq('id', editMeasurement.id);
      if (delErr) throw delErr;
      onSuccess();
      onNavigate('client_profile');
    } catch (err: any) {
      setError(err.message || 'Failed to delete measurement.');
      setDeleting(false);
    }
  };

  const handlePerimeterChange = (id: PerimeterId, value: string) => {
    setPerimeterValues((prev) => ({ ...prev, [id]: value }));
  };

  const handlePerimeterUnitChange = (next: 'cm' | 'in') => {
    if (next === perimeterUnit) return;
    setPerimeterValues((prev: Record<string, string>) => {
      const converted: Record<string, string> = {};
      for (const [key, val] of Object.entries(prev)) {
        if (!val) { converted[key] = val; continue; }
        const num = parseFloat(val);
        if (isNaN(num)) { converted[key] = val; continue; }
        converted[key] = (next === 'in' ? cmToIn(num) : inToCm(num)).toFixed(1);
      }
      return converted;
    });
    setPerimeterUnit(next);
  };

  const handleHotspotClick = (id: PerimeterId) => {
    setFocusedPerimeter(id);
    setShowDiagram(true);
    inputRefs.current[id]?.focus();
    inputRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const allEntered = [weight, bodyFat, ...Object.values(perimeterValues), ...Object.values(customValues)];
    for (const v of allEntered) {
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

    const parseVal = (val: string): number | null => {
      if (!val || val.trim() === '') return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const record: any = {
        client_id: client.id,
        trainer_id: user.id,
        measured_on: date,
        unit,
        session_name: sessionName.trim() || null,
        weight: parseVal(weight),
        body_fat_percent: parseVal(bodyFat),
        notes: notes.trim() || null,
      };

      for (const p of selectedPerimeters) {
        const raw = parseVal(perimeterValues[p.id]);
        record[p.dbColumn] = raw === null ? null : parsePerimeterInput(raw, perimeterUnit);
      }

      let measurementId = editMeasurement?.id;
      if (isEditing && measurementId) {
        const { error: updateErr } = await supabase
          .from('measurements')
          .update(record)
          .eq('id', measurementId);
        if (updateErr) throw updateErr;
        // Replace custom measure values wholesale — simplest correct way to keep them in sync.
        await supabase.from('custom_measure_values').delete().eq('measurement_id', measurementId);
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('measurements')
          .insert(record)
          .select()
          .single();
        if (insertErr) throw insertErr;
        measurementId = inserted.id;
      }

      const customRows = customMeasures
        .filter((m) => customValues[m.id] && customValues[m.id].trim() !== '')
        .map((m) => ({
          measurement_id: measurementId,
          custom_measure_id: m.id,
          trainer_id: user.id,
          value: parseFloat(customValues[m.id]),
        }));

      if (customRows.length > 0) {
        const { error: customErr } = await supabase.from('custom_measure_values').insert(customRows);
        if (customErr) throw customErr;
      }

      onSuccess();
      onNavigate('client_profile');
    } catch (err: any) {
      console.error('Error saving measurement:', err);
      setError(err.message || 'Failed to save measurement.');
    } finally {
      setLoading(false);
    }
  };

  const perimeterMeasures = customMeasures.filter((m) => m.measure_type === 'perimeter');
  const foldMeasures = customMeasures.filter((m) => m.measure_type === 'fold');

  return (
    <main className="max-w-md mx-auto px-5 py-6 pb-32 font-['Inter',sans-serif]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-white">{isEditing ? 'Edit Measurement' : 'Add Measurement'}</h2>
          <p className="text-xs text-text-muted">{isEditing ? 'Editing entry for' : 'Logging entry for'} {client.name}</p>
        </div>

        <div className="bg-surface-alt p-1 rounded-lg border border-border flex gap-1">
          <button
            type="button"
            onClick={() => setUnit('metric')}
            className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded ${
              unit === 'metric' ? 'bg-accent text-white' : 'text-text-muted hover:text-white'
            }`}
          >
            Metric
          </button>
          <button
            type="button"
            onClick={() => setUnit('imperial')}
            className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded ${
              unit === 'imperial' ? 'bg-accent text-white' : 'text-text-muted hover:text-white'
            }`}
          >
            Imperial
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-bg text-danger text-xs font-medium rounded-lg border border-danger/30">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date + Session */}
        <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1" htmlFor="session_name">
              Session Name (Optional)
            </label>
            <input
              id="session_name"
              type="text"
              placeholder="e.g. Initial, Week 4, Current"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Core Metrics */}
        <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
          <h3 className="text-lg font-semibold text-accent pb-1 border-b border-border">Core Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1" htmlFor="weight">
                Weight ({unit === 'metric' ? 'kg' : 'lbs'})
              </label>
              <input
                id="weight"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1" htmlFor="bodyfat">
                Body Fat (%)
              </label>
              <input
                id="bodyfat"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Perimeters */}
        <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-border">
            <h3 className="text-lg font-semibold text-accent">Perimeters</h3>
            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="flex items-center gap-1 text-xs font-semibold text-accent"
            >
              <Info className="w-4 h-4" />
              Instructions
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="bg-surface-alt p-1 rounded-lg border border-border flex gap-1">
              <button
                type="button"
                onClick={() => handlePerimeterUnitChange('cm')}
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded ${
                  perimeterUnit === 'cm' ? 'bg-accent text-white' : 'text-text-muted'
                }`}
              >
                cm
              </button>
              <button
                type="button"
                onClick={() => handlePerimeterUnitChange('in')}
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded ${
                  perimeterUnit === 'in' ? 'bg-accent text-white' : 'text-text-muted'
                }`}
              >
                in
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowDiagram((s) => !s)}
              className="flex items-center gap-1 text-xs font-medium text-text-muted"
            >
              {showDiagram ? 'Hide diagram' : 'Show diagram'}
              {showDiagram ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showDiagram && (
            <AnatomyDiagram
              sex={client.biological_sex || 'male'}
              view={diagramView}
              onViewChange={setDiagramView}
              activePerimeterId={focusedPerimeter}
              onHotspotClick={handleHotspotClick}
            />
          )}

          {selectedPerimeters.length === 0 && perimeterMeasures.length === 0 && (
            <p className="text-xs text-text-muted">
              No perimeters selected for this client. Enable them from the client's Settings tab.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {selectedPerimeters.map((p) => (
              <div key={p.id}>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                    focusedPerimeter === p.id ? 'text-accent' : 'text-text-muted'
                  }`}
                  htmlFor={`perimeter-${p.id}`}
                >
                  {p.label}
                </label>
                <input
                  id={`perimeter-${p.id}`}
                  ref={(el) => { inputRefs.current[p.id] = el; }}
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={perimeterValues[p.id] || ''}
                  onChange={(e) => handlePerimeterChange(p.id, e.target.value)}
                  onFocus={() => setFocusedPerimeter(p.id)}
                  className={inputClass}
                />
              </div>
            ))}
            {perimeterMeasures.map((m) => (
              <div key={m.id}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1" htmlFor={`custom-${m.id}`}>
                  {m.name} ({m.unit})
                </label>
                <input
                  id={`custom-${m.id}`}
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={customValues[m.id] || ''}
                  onChange={(e) => setCustomValues((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Custom Fold Measures */}
        {foldMeasures.length > 0 && (
          <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
            <h3 className="text-lg font-semibold text-accent pb-1 border-b border-border">Custom Folds</h3>
            <div className="grid grid-cols-2 gap-4">
              {foldMeasures.map((m) => (
                <div key={m.id}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1" htmlFor={`fold-${m.id}`}>
                    {m.name} ({m.unit})
                  </label>
                  <input
                    id={`fold-${m.id}`}
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={customValues[m.id] || ''}
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional Notes */}
        <div className="bg-surface rounded-xl p-4 border border-border">
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1" htmlFor="notes">
            Measurement Notes (Optional)
          </label>
          <input
            id="notes"
            type="text"
            placeholder="e.g. Measured morning before breakfast"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} text-sm`}
          />
        </div>

        <div className="pt-2 space-y-3">
          <button
            type="submit"
            disabled={loading || deleting}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-lg py-3 rounded-lg btn-press flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                {isEditing ? 'Save Changes' : 'Save Measurement'}
              </>
            )}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={loading || deleting}
              className="w-full flex items-center justify-center gap-1.5 text-danger text-sm font-semibold py-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete Measurement
            </button>
          )}
        </div>
      </form>

      {showInstructions && <PerimeterInstructionsModal onClose={() => setShowInstructions(false)} />}

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-lg font-semibold text-white">Delete this measurement?</h3>
            <p className="text-sm text-text-muted">
              This permanently removes this measurement entry ({date}). It will not affect the rest of {client.name}'s profile. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold uppercase text-text-muted hover:bg-surface-alt rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-danger text-white text-xs font-semibold uppercase tracking-wider rounded-lg disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
