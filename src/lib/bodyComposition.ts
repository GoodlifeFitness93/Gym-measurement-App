import type { BodyCompositionMethod } from '../types';

export interface BodyCompositionMethodConfig {
  id: BodyCompositionMethod;
  label: string;
}

export const BODY_COMPOSITION_METHODS: BodyCompositionMethodConfig[] = [
  { id: 'automatic', label: 'Automatic (Beginner)' },
  { id: 'us_navy', label: 'US Navy' },
  { id: 'manual_bia', label: 'Manual / Bioimpedance' },
  { id: 'jp3', label: 'Jackson-Pollock 3' },
  { id: 'jp4', label: 'Jackson-Pollock 4' },
  { id: 'jp7', label: 'Jackson-Pollock 7' },
];

// Calculation engines are intentionally not implemented yet. The UI must
// store the selected method but never fabricate a body-fat result.
export const CALCULATION_DEFERRED = true;

export function bodyCompositionLabel(method?: BodyCompositionMethod | null): string {
  if (!method) return 'Not set';
  return BODY_COMPOSITION_METHODS.find((m) => m.id === method)?.label ?? method;
}
