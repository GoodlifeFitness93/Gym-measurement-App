import type { Measurement } from '../types';

export type PerimeterId =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'biceps'
  | 'forearm'
  | 'waist'
  | 'abdomen'
  | 'hip'
  | 'gluteus'
  | 'thigh'
  | 'calf';

export interface PerimeterConfig {
  id: PerimeterId;
  label: string;
  dbColumn: keyof Measurement;
}

// Single source of truth for the 11 StartFit-style perimeters: canonical id,
// display label, and the (possibly legacy-named) measurements column it maps to.
export const PERIMETERS: PerimeterConfig[] = [
  { id: 'neck', label: 'Neck', dbColumn: 'neck' },
  { id: 'shoulders', label: 'Shoulders', dbColumn: 'shoulders' },
  { id: 'chest', label: 'Chest', dbColumn: 'chest' },
  { id: 'biceps', label: 'Biceps', dbColumn: 'arm' },
  { id: 'forearm', label: 'Forearm', dbColumn: 'forearm' },
  { id: 'waist', label: 'Waist', dbColumn: 'waist' },
  { id: 'abdomen', label: 'Abdomen', dbColumn: 'abdomen' },
  { id: 'hip', label: 'Hip', dbColumn: 'hips' },
  { id: 'gluteus', label: 'Gluteus', dbColumn: 'gluteus' },
  { id: 'thigh', label: 'Thigh', dbColumn: 'thigh' },
  { id: 'calf', label: 'Calf', dbColumn: 'calf' },
];

export const ALL_PERIMETER_IDS: PerimeterId[] = PERIMETERS.map((p) => p.id);

export const PERIMETER_MAP: Record<PerimeterId, PerimeterConfig> = PERIMETERS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PerimeterId, PerimeterConfig>
);
