// Canonical storage is always centimeters/kilograms. These helpers only
// convert for display/input so repeated round-trips don't drift.

export function cmToIn(cm: number): number {
  return cm / 2.54;
}

export function inToCm(inches: number): number {
  return inches * 2.54;
}

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round((totalIn - ft * 12) * 10) / 10;
  return { ft, inch };
}

export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * 2.54;
}

export function formatPerimeterValue(cm: number, unit: 'cm' | 'in'): string {
  const value = unit === 'cm' ? cm : cmToIn(cm);
  return value.toFixed(1);
}

export function parsePerimeterInput(value: number, unit: 'cm' | 'in'): number {
  return unit === 'cm' ? value : inToCm(value);
}
