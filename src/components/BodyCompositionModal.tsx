import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { Client, Measurement } from '../types';
import { calculateBmi } from '../lib/bmi';
import { BMIDetailModal } from './BMIDetailModal';

interface Props {
  client: Client;
  measurements: Measurement[];
  onClose: () => void;
}

export const BodyCompositionModal: React.FC<Props> = ({ client, measurements, onClose }) => {
  const [showBmiDetail, setShowBmiDetail] = useState(false);
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const bmi = latest?.weight && client.height_cm ? calculateBmi(latest.weight, client.height_cm) : null;

  const rows: { label: string; value: string | null; onClick?: () => void }[] = [
    { label: 'Weight', value: latest?.weight != null ? `${latest.weight} kg` : null },
    { label: 'Fat', value: latest?.body_fat_percent != null ? `${latest.body_fat_percent} %` : null },
    { label: 'BMI', value: bmi != null ? `${bmi}` : null, onClick: bmi != null ? () => setShowBmiDetail(true) : undefined },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Body Composition</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full bg-surface-alt hover:bg-border text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {!latest && (
            <p className="text-sm text-text-muted text-center py-6">No measurements yet — log one to see body composition.</p>
          )}

          {latest && rows.map((r) => (
            <button
              key={r.label}
              type="button"
              disabled={!r.onClick}
              onClick={r.onClick}
              className={`w-full flex items-center justify-between px-4 py-3 bg-surface-alt rounded-lg ${r.onClick ? 'hover:bg-border' : ''}`}
            >
              <span className="text-sm text-text-muted">{r.label}</span>
              <span className="text-base font-bold text-white">{r.value ?? '—'}</span>
            </button>
          ))}

          {latest && (
            <>
              <div className="flex items-center justify-between px-4 py-3 bg-surface-alt/50 rounded-lg opacity-60">
                <span className="text-sm text-text-muted flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Muscle</span>
                <span className="text-xs text-text-muted">Not available</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-surface-alt/50 rounded-lg opacity-60">
                <span className="text-sm text-text-muted flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> FFMI</span>
                <span className="text-xs text-text-muted">Not available</span>
              </div>
              <p className="text-[11px] text-text-muted italic pt-1">
                Muscle mass and FFMI require a body-composition calculation method (e.g. skinfold or bioimpedance) that isn't implemented yet — no value is shown rather than an estimate.
              </p>
            </>
          )}
        </div>
      </div>

      {showBmiDetail && bmi != null && <BMIDetailModal bmi={bmi} onClose={() => setShowBmiDetail(false)} />}
    </div>
  );
};
