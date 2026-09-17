import React from 'react';
import { X, Ruler } from 'lucide-react';
import { PERIMETERS, PerimeterId } from '../lib/perimeters';

// Source photos live in Public/gym measures (served as static files at
// /gym measures/...). Each photo already has its own card frame + label
// baked in, so the grid below renders them directly with no extra chrome.
const gymMeasuresAsset = (name: string) => encodeURI(`/gym measures/${name}`);

const INSTRUCTION_IMAGES: Record<PerimeterId, string> = {
  neck: gymMeasuresAsset('Screenshot 2026-09-17 192917.png'),
  shoulders: gymMeasuresAsset('12bee96c-29c1-44f1-820c-fff8da4500d0.png'),
  chest: gymMeasuresAsset('27a20c91-4196-4101-866b-a6db6bb54ca3.png'),
  biceps: gymMeasuresAsset('Screenshot 2026-09-17 192935.png'),
  forearm: gymMeasuresAsset('Screenshot 2026-09-17 192940.png'),
  waist: gymMeasuresAsset('Screenshot 2026-09-17 192948.png'),
  abdomen: gymMeasuresAsset('Screenshot 2026-09-17 193038.png'),
  hip: gymMeasuresAsset('Screenshot 2026-09-17 193007.png'),
  gluteus: gymMeasuresAsset('Screenshot 2026-09-17 193018.png'),
  thigh: gymMeasuresAsset('Screenshot 2026-09-17 193025.png'),
  calf: gymMeasuresAsset('Screenshot 2026-09-17 193032.png'),
};

interface Props {
  onClose: () => void;
}

export const PerimeterInstructionsModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perimeter-instructions-title"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="perimeter-instructions-title" className="text-lg font-semibold text-white flex items-center gap-2">
              <Ruler className="w-5 h-5 text-accent" />
              Perimeters
            </h2>
            <p className="text-xs text-text-muted mt-1">
              A tape measure is required. The perimeters to measure are:
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close instructions"
            className="shrink-0 p-2 rounded-full bg-surface-alt hover:bg-border text-text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {PERIMETERS.map((p) => (
            <img
              key={p.id}
              src={INSTRUCTION_IMAGES[p.id]}
              alt={`How to measure ${p.label.toLowerCase()} circumference`}
              className="w-full h-auto rounded-xl object-contain"
            />
          ))}
        </div>

        <div className="p-5 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
