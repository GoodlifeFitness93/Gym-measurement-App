import React, { useEffect, useState } from 'react';
import { Trash2, Plus, X, Check } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, CustomMeasure, BiologicalSex, BodyCompositionMethod, ActiveScreen } from '../types';
import { PERIMETERS, PerimeterId } from '../lib/perimeters';
import { BODY_COMPOSITION_METHODS } from '../lib/bodyComposition';

interface Props {
  client: Client;
  measurements: Measurement[];
  onNavigate: (screen: ActiveScreen) => void;
  onRefreshClient: () => void;
  onRefreshMeasurements: () => void;
}

const cardClass = 'bg-surface rounded-xl p-4 md:p-5 border border-border space-y-3';
const inputClass =
  'w-full bg-surface-alt border-0 border-b-2 border-transparent focus:border-accent px-3 py-2.5 text-sm text-white rounded-t transition-colors focus:outline-none';
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1';
const saveBtnClass =
  'bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-lg btn-press disabled:opacity-50';

export const ClientSettingsTab: React.FC<Props> = ({
  client,
  measurements,
  onNavigate,
  onRefreshClient,
  onRefreshMeasurements,
}) => {
  const supabase = getSupabase();

  // Profile section
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone || '');
  const [email, setEmail] = useState(client.email || '');
  const [sex, setSex] = useState<BiologicalSex | ''>(client.biological_sex || '');
  const [heightCm, setHeightCm] = useState(client.height_cm?.toString() || '');
  const [dob, setDob] = useState(client.date_of_birth || '');
  const [startingWeight, setStartingWeight] = useState(client.starting_weight?.toString() || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sessions section
  const [sessionNames, setSessionNames] = useState<Record<string, string>>({});
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);

  // Fat Method section
  const [method, setMethod] = useState<BodyCompositionMethod | ''>(client.body_composition_method || '');
  const [savingMethod, setSavingMethod] = useState(false);

  // Perimeters section
  const [selectedPerimeters, setSelectedPerimeters] = useState<PerimeterId[]>(
    (client.selected_perimeters as PerimeterId[]) || []
  );
  const [savingPerimeters, setSavingPerimeters] = useState(false);

  // Unit system section
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>(client.unit_system || 'metric');
  const [savingUnit, setSavingUnit] = useState(false);

  // Custom measures section
  const [customMeasures, setCustomMeasures] = useState<CustomMeasure[]>([]);
  const [newMeasureName, setNewMeasureName] = useState('');
  const [newMeasureType, setNewMeasureType] = useState<'perimeter' | 'fold'>('perimeter');
  const [newMeasureUnit, setNewMeasureUnit] = useState('cm');
  const [addingMeasure, setAddingMeasure] = useState(false);

  useEffect(() => {
    const fetchCustomMeasures = async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('custom_measures')
        .select('*')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: true });
      if (data) setCustomMeasures(data);
    };
    fetchCustomMeasures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedMeasurements = [...measurements].sort(
    (a, b) => new Date(a.measured_on).getTime() - new Date(b.measured_on).getTime()
  );

  const handleSaveProfile = async () => {
    if (!supabase) return;
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          biological_sex: sex || null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          date_of_birth: dob || null,
          starting_weight: startingWeight ? parseFloat(startingWeight) : null,
        })
        .eq('id', client.id);
      if (error) throw error;
      setProfileSaved(true);
      onRefreshClient();
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      alert('Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!supabase) return;
    setDeleting(true);
    try {
      const { data: photoRows } = await supabase
        .from('progress_photos')
        .select('storage_path')
        .eq('client_id', client.id);

      if (photoRows && photoRows.length > 0) {
        await supabase.storage
          .from('progress-photos')
          .remove(photoRows.map((p: any) => p.storage_path));
      }

      await supabase.from('progress_photos').delete().eq('client_id', client.id);
      await supabase.from('measurements').delete().eq('client_id', client.id);
      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) throw error;

      onNavigate('client_list');
    } catch (err) {
      alert('Failed to delete client.');
      setDeleting(false);
    }
  };

  const handleSaveSession = async (measurementId: string) => {
    if (!supabase) return;
    setSavingSessionId(measurementId);
    try {
      const { error } = await supabase
        .from('measurements')
        .update({ session_name: sessionNames[measurementId] ?? null })
        .eq('id', measurementId);
      if (error) throw error;
      onRefreshMeasurements();
    } catch (err) {
      alert('Failed to save session name.');
    } finally {
      setSavingSessionId(null);
    }
  };

  const handleSaveMethod = async () => {
    if (!supabase) return;
    setSavingMethod(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ body_composition_method: method || null })
        .eq('id', client.id);
      if (error) throw error;
      onRefreshClient();
    } catch (err) {
      alert('Failed to save fat method.');
    } finally {
      setSavingMethod(false);
    }
  };

  const togglePerimeter = (id: PerimeterId) => {
    setSelectedPerimeters((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSavePerimeters = async () => {
    if (!supabase) return;
    setSavingPerimeters(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ selected_perimeters: selectedPerimeters })
        .eq('id', client.id);
      if (error) throw error;
      onRefreshClient();
    } catch (err) {
      alert('Failed to save perimeters.');
    } finally {
      setSavingPerimeters(false);
    }
  };

  const handleSaveUnit = async (next: 'metric' | 'imperial') => {
    if (!supabase) return;
    setUnitSystem(next);
    setSavingUnit(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ unit_system: next })
        .eq('id', client.id);
      if (error) throw error;
      onRefreshClient();
    } catch (err) {
      alert('Failed to save unit system.');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleAddCustomMeasure = async () => {
    if (!supabase || !newMeasureName.trim()) return;
    setAddingMeasure(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('custom_measures')
        .insert({
          trainer_id: user.id,
          name: newMeasureName.trim(),
          measure_type: newMeasureType,
          unit: newMeasureUnit.trim() || 'cm',
        })
        .select()
        .single();
      if (error) throw error;
      setCustomMeasures((prev) => [...prev, data]);
      setNewMeasureName('');
    } catch (err) {
      alert('Failed to add custom measure.');
    } finally {
      setAddingMeasure(false);
    }
  };

  const handleDeleteCustomMeasure = async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('custom_measures').delete().eq('id', id);
      if (error) throw error;
      setCustomMeasures((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert('Failed to delete custom measure.');
    }
  };

  return (
    <section className="space-y-4">
      {/* Profile */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-accent pb-1 border-b border-border">Profile</h3>
        <div>
          <label className={labelClass}>Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Biological Sex</label>
            <select value={sex} onChange={(e) => setSex(e.target.value as BiologicalSex)} className={inputClass}>
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Height (cm)</label>
            <input
              type="number"
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Date of Birth</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Starting Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={startingWeight}
              onChange={(e) => setStartingWeight(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSaveProfile} disabled={savingProfile} className={saveBtnClass}>
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </button>
          {profileSaved && <span className="text-xs text-success font-semibold">Saved</span>}
        </div>
        <div className="pt-3 border-t border-border">
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-danger uppercase tracking-wider"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Client
          </button>
        </div>
      </div>

      {/* Measurement Sessions */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-accent pb-1 border-b border-border">Measurement Sessions</h3>
        {sortedMeasurements.length === 0 ? (
          <p className="text-xs text-text-muted">No measurement sessions logged yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedMeasurements.map((m, idx) => {
              const isInitial = idx === 0;
              const isCurrent = idx === sortedMeasurements.length - 1;
              return (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs text-text-muted">
                        {new Date(m.measured_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {isInitial && (
                        <span className="text-[10px] font-bold uppercase bg-accent/15 text-accent px-1.5 py-0.5 rounded">
                          Initial
                        </span>
                      )}
                      {isCurrent && !isInitial && (
                        <span className="text-[10px] font-bold uppercase bg-success/15 text-success px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <input
                      placeholder="Session name (e.g. Week 4)"
                      value={sessionNames[m.id!] ?? m.session_name ?? ''}
                      onChange={(e) => setSessionNames((prev) => ({ ...prev, [m.id!]: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={() => handleSaveSession(m.id!)}
                    disabled={savingSessionId === m.id}
                    className="p-2.5 rounded-lg bg-surface-alt text-accent disabled:opacity-50"
                    aria-label="Save session name"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fat Method */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-accent pb-1 border-b border-border">Fat Method</h3>
        <select value={method} onChange={(e) => setMethod(e.target.value as BodyCompositionMethod)} className={inputClass}>
          <option value="">Not set</option>
          {BODY_COMPOSITION_METHODS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <p className="text-xs text-text-muted">Calculation is not available yet — this only saves the preferred method.</p>
        <button onClick={handleSaveMethod} disabled={savingMethod} className={saveBtnClass}>
          {savingMethod ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Perimeters */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-accent pb-1 border-b border-border">Perimeters</h3>
        <div className="grid grid-cols-2 gap-2">
          {PERIMETERS.map((p) => {
            const checked = selectedPerimeters.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePerimeter(p.id)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium text-left flex items-center justify-between transition-colors ${
                  checked ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-alt text-text-muted'
                }`}
              >
                {p.label}
                {checked && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
        <button onClick={handleSavePerimeters} disabled={savingPerimeters} className={saveBtnClass}>
          {savingPerimeters ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Custom Measures */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-accent pb-1 border-b border-border">Custom Measures</h3>
        {customMeasures.length > 0 && (
          <div className="space-y-1.5">
            {customMeasures.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-surface-alt rounded-lg px-3 py-2">
                <span className="text-sm text-white">
                  {m.name} <span className="text-text-muted text-xs capitalize">({m.measure_type}, {m.unit})</span>
                </span>
                <button onClick={() => handleDeleteCustomMeasure(m.id)} aria-label={`Delete ${m.name}`} className="text-danger">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-1 border-t border-border">
          <input
            placeholder="Measure name"
            value={newMeasureName}
            onChange={(e) => setNewMeasureName(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2">
            <select
              value={newMeasureType}
              onChange={(e) => setNewMeasureType(e.target.value as 'perimeter' | 'fold')}
              className={inputClass}
            >
              <option value="perimeter">Perimeter</option>
              <option value="fold">Fold</option>
            </select>
            <input
              placeholder="unit"
              value={newMeasureUnit}
              onChange={(e) => setNewMeasureUnit(e.target.value)}
              className={`${inputClass} max-w-[80px]`}
            />
          </div>
          <button
            onClick={handleAddCustomMeasure}
            disabled={addingMeasure || !newMeasureName.trim()}
            className="flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg btn-press disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Measure
          </button>
        </div>
      </div>

      {/* Unit System */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-accent pb-1 border-b border-border">Unit System</h3>
        <div className="grid grid-cols-2 gap-3">
          {(['metric', 'imperial'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleSaveUnit(u)}
              disabled={savingUnit}
              className={`py-4 rounded-xl border-2 font-semibold capitalize transition-colors disabled:opacity-50 ${
                unitSystem === u ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-alt text-text-muted'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-lg font-semibold text-white">Delete {client.name}?</h3>
            <p className="text-sm text-text-muted">
              This permanently deletes this client along with their measurements and progress photos. This cannot be undone.
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
                onClick={handleDeleteClient}
                disabled={deleting}
                className="px-4 py-2 bg-danger text-white text-xs font-semibold uppercase tracking-wider rounded-lg disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
