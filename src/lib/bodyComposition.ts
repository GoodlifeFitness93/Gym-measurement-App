import type { BiologicalSex, BodyCompositionMethod, Client, Measurement } from '../types';

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

export function bodyCompositionLabel(method?: BodyCompositionMethod | null): string {
  if (!method) return 'Not set';
  return BODY_COMPOSITION_METHODS.find((m) => m.id === method)?.label ?? method;
}

const round1 = (n: number) => parseFloat(n.toFixed(1));

/* ------------------------------------------------------------------ *
 * US Navy circumference method (Hodgdon & Beckett, 1984).
 * Inputs in cm. This is a published estimation formula, not a guess —
 * every value it produces is labelled as a US Navy estimate in the UI.
 * ------------------------------------------------------------------ */
export function usNavyBodyFat(input: {
  sex: BiologicalSex;
  heightCm: number;
  neckCm: number;
  waistCm: number;
  hipCm?: number | null;
}): number | null {
  const { sex, heightCm, neckCm, waistCm, hipCm } = input;
  if (!(heightCm > 0) || !(neckCm > 0) || !(waistCm > 0)) return null;

  let bf: number;
  if (sex === 'male') {
    const girth = waistCm - neckCm;
    if (girth <= 0) return null;
    bf =
      495 /
        (1.0324 - 0.19077 * Math.log10(girth) + 0.15456 * Math.log10(heightCm)) -
      450;
  } else {
    if (!hipCm || hipCm <= 0) return null;
    const girth = waistCm + hipCm - neckCm;
    if (girth <= 0) return null;
    bf =
      495 /
        (1.29579 - 0.35004 * Math.log10(girth) + 0.221 * Math.log10(heightCm)) -
      450;
  }

  if (!isFinite(bf) || bf <= 0 || bf > 70) return null;
  return round1(bf);
}

export interface BodyFatResult {
  percent: number;
  /** 'measured' = trainer entered it. 'us_navy' = derived from girths. */
  source: 'measured' | 'us_navy';
  sourceLabel: string;
}

/**
 * Body fat for a measurement: the trainer's entered value always wins; only
 * when it is absent do we fall back to the US Navy estimate. Returns null
 * rather than a placeholder when neither is possible.
 */
export function resolveBodyFat(client: Client, m: Measurement | null | undefined): BodyFatResult | null {
  if (!m) return null;
  if (m.body_fat_percent != null) {
    return { percent: m.body_fat_percent, source: 'measured', sourceLabel: 'Entered by trainer' };
  }
  if (!client.biological_sex || !client.height_cm || !m.neck) return null;

  // For men the Navy protocol measures at the navel, which this app records as
  // "Abdomen"; fall back to Waist when abdomen was not taken.
  const waist = client.biological_sex === 'male' ? (m.abdomen ?? m.waist) : m.waist;
  if (!waist) return null;

  const percent = usNavyBodyFat({
    sex: client.biological_sex,
    heightCm: client.height_cm,
    neckCm: m.neck,
    waistCm: waist,
    hipCm: m.hips,
  });
  if (percent == null) return null;
  return { percent, source: 'us_navy', sourceLabel: 'US Navy estimate from girths' };
}

/** What the trainer still needs to record before body fat can be shown. */
export function missingForBodyFat(client: Client, m: Measurement | null | undefined): string[] {
  const missing: string[] = [];
  if (!client.biological_sex) missing.push('biological sex (Client Settings)');
  if (!client.height_cm) missing.push('height (Client Settings)');
  if (!m?.neck) missing.push('neck measurement');
  if (client.biological_sex === 'female') {
    if (!m?.waist) missing.push('waist measurement');
    if (!m?.hips) missing.push('hip measurement');
  } else if (!m?.abdomen && !m?.waist) {
    missing.push('waist or abdomen measurement');
  }
  return missing;
}

/* ------------------------------------------------------------------ *
 * Derived composition. All of these are exact arithmetic once weight,
 * height and a body-fat percentage exist — nothing is estimated twice.
 * ------------------------------------------------------------------ */
export interface CompositionBreakdown {
  fatMassKg: number;
  leanMassKg: number;
  ffmi: number;
  normalizedFfmi: number;
}

export function compositionBreakdown(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
  bodyFatPercent: number | null | undefined
): CompositionBreakdown | null {
  if (!weightKg || !heightCm || bodyFatPercent == null) return null;
  const h = heightCm / 100;
  if (h <= 0) return null;

  const fatMassKg = (weightKg * bodyFatPercent) / 100;
  const leanMassKg = weightKg - fatMassKg;
  const ffmi = leanMassKg / (h * h);
  // Kouri et al. height-normalisation to a 1.80 m reference.
  const normalizedFfmi = ffmi + 6.1 * (1.8 - h);

  return {
    fatMassKg: round1(fatMassKg),
    leanMassKg: round1(leanMassKg),
    ffmi: round1(ffmi),
    normalizedFfmi: round1(normalizedFfmi),
  };
}

/** Plain-English reading of a normalized FFMI value. */
export function ffmiCategory(normalizedFfmi: number, sex?: BiologicalSex | null): string {
  if (sex === 'female') {
    if (normalizedFfmi < 14) return 'Below average muscle mass';
    if (normalizedFfmi < 17) return 'Average muscle mass';
    if (normalizedFfmi < 19) return 'Above average muscle mass';
    return 'High muscle mass';
  }
  if (normalizedFfmi < 18) return 'Below average muscle mass';
  if (normalizedFfmi < 20) return 'Average muscle mass';
  if (normalizedFfmi < 22) return 'Above average muscle mass';
  if (normalizedFfmi < 25) return 'Well-developed muscle mass';
  return 'Very high muscle mass';
}
