import React from 'react';
import { X } from 'lucide-react';
import { Measurement } from '../types';
import { PERIMETERS } from '../lib/perimeters';

interface Props {
  a: Measurement;
  b: Measurement;
  onClose: () => void;
}

const ROWS: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'body_fat_percent', label: 'Body Fat', unit: '%' },
  ...PERIMETERS.map((p) => ({ key: p.dbColumn, label: p.label, unit: 'cm' })),
];

function fmtDate(m: Measurement) {
  return new Date(m.measured_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const CompareMeasurementsModal: React.FC<Props> = ({ a, b, onClose }) => {
  // Always compare in chronological order so "Change" reads as later-minus-earlier.
  const [earlier, later] = new Date(a.measured_on) <= new Date(b.measured_on) ? [a, b] : [b, a];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Compare Measurements</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full bg-surface-alt hover:bg-border text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
            <span></span>
            <span className="text-center">{fmtDate(earlier)}</span>
            <span className="text-center">{fmtDate(later)}</span>
          </div>

          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {ROWS.map((row) => {
              const valA = earlier[row.key] as number | null | undefined;
              const valB = later[row.key] as number | null | undefined;
              if (valA == null && valB == null) return null;
              const delta = valA != null && valB != null ? parseFloat((valB - valA).toFixed(1)) : null;
              return (
                <div key={row.key} className="grid grid-cols-3 gap-2 px-3 py-2.5 items-center bg-surface-alt/40">
                  <span className="text-sm text-white">{row.label}</span>
                  <span className="text-sm text-text-muted text-center">{valA != null ? `${valA} ${row.unit}` : '—'}</span>
                  <span className="text-sm text-center">
                    <span className="text-white font-semibold">{valB != null ? `${valB} ${row.unit}` : '—'}</span>
                    {delta !== null && delta !== 0 && (
                      <span className={`ml-1.5 text-xs font-semibold ${delta > 0 ? 'text-accent' : 'text-success'}`}>
                        ({delta > 0 ? '+' : ''}{delta})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
