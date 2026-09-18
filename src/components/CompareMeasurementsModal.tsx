import React from 'react';
import { Measurement } from '../types';
import { PERIMETERS } from '../lib/perimeters';
import { Modal } from './ui/Modal';

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
    <Modal title="Compare Measurements" onClose={onClose} size="lg">
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
    </Modal>
  );
};
