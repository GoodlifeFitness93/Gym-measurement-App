import React from 'react';
import { X } from 'lucide-react';
import { bmiCategoryInfo, BMI_RANGES } from '../lib/bmi';

interface Props {
  bmi: number;
  onClose: () => void;
}

export const BMIDetailModal: React.FC<Props> = ({ bmi, onClose }) => {
  const info = bmiCategoryInfo(bmi);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto no-scrollbar p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Category</p>
            <h2 className="text-2xl font-bold text-white">{info.category}</h2>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">BMI</p>
            <p className="text-2xl font-bold text-accent">{bmi}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-1.5 rounded-full bg-surface-alt hover:bg-border text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-text-muted border-t border-border pt-3">
          Body Mass Index (BMI) is a value derived from an individual's height and weight. It provides an estimate of body fat and is a screening tool for weight categories.
        </p>

        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Analysis</h3>
          <p className="text-sm text-text-muted">{info.analysis}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Risk</h3>
          <p className="text-sm text-text-muted">{info.risk}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Recommendation</h3>
          <p className="text-sm text-text-muted">{info.recommendation}</p>
        </div>

        <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-surface-alt text-text-muted text-xs uppercase">
              <th className="text-left p-2 font-semibold">Category</th>
              <th className="text-left p-2 font-semibold">Range</th>
            </tr>
          </thead>
          <tbody>
            {BMI_RANGES.map((r) => (
              <tr key={r.label} className={`border-t border-border ${r.label === info.category ? 'bg-accent/10 text-accent font-semibold' : 'text-white'}`}>
                <td className="p-2">{r.label}</td>
                <td className="p-2">{r.range}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[11px] text-text-muted italic pt-1">
          This is an informational fitness-coaching estimate, not a medical diagnosis.
        </p>
      </div>
    </div>
  );
};
