import React, { useState } from 'react';
import { PerimeterId, PERIMETER_MAP } from '../lib/perimeters';
import type { BiologicalSex } from '../types';

import maleFront from '../../assets/anatomy/male-front.svg';
import maleBack from '../../assets/anatomy/male-back.svg';
import femaleFront from '../../assets/anatomy/female-front.svg';
import femaleBack from '../../assets/anatomy/female-back.svg';

const DIAGRAMS: Record<BiologicalSex, Record<'front' | 'back', string>> = {
  male: { front: maleFront, back: maleBack },
  female: { front: femaleFront, back: femaleBack },
};

// Percentage coordinates within the 200x260 silhouette viewBox, per view.
// Approximate placement — intended to communicate location, not medical precision.
const HOTSPOTS: Record<'front' | 'back', Partial<Record<PerimeterId, { x: number; y: number }>>> = {
  front: {
    neck: { x: 50, y: 18 },
    shoulders: { x: 50, y: 22.5 },
    chest: { x: 50, y: 34.5 },
    biceps: { x: 75, y: 31 },
    forearm: { x: 75, y: 56 },
    waist: { x: 50, y: 49 },
    abdomen: { x: 50, y: 56 },
    hip: { x: 50, y: 62 },
    thigh: { x: 42.5, y: 79 },
  },
  back: {
    neck: { x: 50, y: 18 },
    shoulders: { x: 50, y: 22.5 },
    biceps: { x: 75, y: 31 },
    forearm: { x: 75, y: 56 },
    hip: { x: 50, y: 62 },
    gluteus: { x: 50, y: 65.5 },
    thigh: { x: 42.5, y: 79 },
    calf: { x: 42.5, y: 91 },
  },
};

interface Props {
  sex: BiologicalSex;
  view: 'front' | 'back';
  onViewChange: (view: 'front' | 'back') => void;
  activePerimeterId?: PerimeterId | null;
  onHotspotClick: (id: PerimeterId) => void;
}

export const AnatomyDiagram: React.FC<Props> = ({
  sex,
  view,
  onViewChange,
  activePerimeterId,
  onHotspotClick,
}) => {
  const [hovered, setHovered] = useState<PerimeterId | null>(null);
  const hotspots = HOTSPOTS[view];
  const labelId = hovered ?? activePerimeterId ?? null;

  return (
    <div className="bg-surface-alt border border-border rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Measurement Guide
        </span>
        <div className="flex rounded-full bg-surface p-0.5 border border-border">
          {(['front', 'back'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`px-3 py-1 text-xs font-medium rounded-full capitalize transition-colors ${
                view === v ? 'bg-accent text-white' : 'text-text-muted'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-[180px] mx-auto">
        <img src={DIAGRAMS[sex][view]} alt={`${sex} body diagram, ${view} view`} className="w-full h-auto" />
        {(Object.entries(hotspots) as [PerimeterId, { x: number; y: number }][]).map(([id, pos]) => {
          const isActive = activePerimeterId === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={`Focus ${PERIMETER_MAP[id].label} measurement field`}
              onClick={() => onHotspotClick(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(id)}
              onBlur={() => setHovered(null)}
              className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-ink transition-colors ${
                isActive ? 'bg-accent scale-125' : 'bg-accent/70 hover:bg-accent'
              }`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            />
          );
        })}
      </div>

      <p className="text-center text-xs font-semibold text-accent mt-2 h-4">
        {labelId ? PERIMETER_MAP[labelId].label : ' '}
      </p>
    </div>
  );
};
