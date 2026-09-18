import React from 'react';
import { bmiCategoryInfo, BMI_RANGES } from '../lib/bmi';
import { Modal } from './ui/Modal';

interface Props {
  bmi: number;
  onClose: () => void;
}

export const BMIDetailModal: React.FC<Props> = ({ bmi, onClose }) => {
  const info = bmiCategoryInfo(bmi);

  return (
    <Modal title="BMI" onClose={onClose} size="md">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Category</p>
            <h3 className="text-2xl font-bold text-white">{info.category}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">BMI</p>
            <p className="text-2xl font-bold text-accent">{bmi}</p>
          </div>
        </div>

        <p className="text-sm text-text-muted border-t border-border pt-3">
          Body Mass Index (BMI) is a value derived from an individual's height and weight. It provides an estimate of body fat and is a screening tool for weight categories.
        </p>

        <div>
          <h4 className="text-sm font-semibold text-white mb-1">Analysis</h4>
          <p className="text-sm text-text-muted">{info.analysis}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white mb-1">Risk</h4>
          <p className="text-sm text-text-muted">{info.risk}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white mb-1">Recommendation</h4>
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
    </Modal>
  );
};
