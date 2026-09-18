import React from 'react';
import { Ruler } from 'lucide-react';
import { PERIMETERS, PerimeterId } from '../lib/perimeters';
import { Modal } from './ui/Modal';

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
    <Modal
      title="Perimeters"
      icon={<Ruler className="w-5 h-5 text-accent" />}
      onClose={onClose}
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press"
        >
          Close
        </button>
      }
    >
      <div className="px-5 pt-4">
        <p className="text-xs text-text-muted">
          A tape measure is required. The perimeters to measure are:
        </p>
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
    </Modal>
  );
};
