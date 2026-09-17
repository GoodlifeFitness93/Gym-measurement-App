export interface BmiCategory {
  category: string;
  analysis: string;
  risk: string;
  recommendation: string;
}

const CATEGORIES: (BmiCategory & { max: number })[] = [
  {
    max: 18.5,
    category: 'Underweight',
    analysis: 'Weight is below the range typically associated with this height.',
    risk: 'Possible nutritional deficiency or other underlying health issue.',
    recommendation: 'Consider a structured plan to build weight through balanced nutrition and resistance training.',
  },
  {
    max: 25,
    category: 'Normal weight',
    analysis: 'Weight is ideal for height.',
    risk: 'Minimal health risks as long as lifestyle remains balanced.',
    recommendation: 'Maintain current weight through a balanced diet and regular physical activity.',
  },
  {
    max: 30,
    category: 'Overweight',
    analysis: 'Weight is above the range typically associated with this height.',
    risk: 'Increased risk of cardiovascular and metabolic conditions over time.',
    recommendation: 'A gradual, sustainable reduction in weight through diet and activity is generally advised.',
  },
  {
    max: 35,
    category: 'Obesity I',
    analysis: 'Weight is significantly above the range typically associated with this height.',
    risk: 'Elevated risk of cardiovascular disease, diabetes, and joint strain.',
    recommendation: 'A structured, supervised weight-management plan is recommended.',
  },
  {
    max: 40,
    category: 'Obesity II',
    analysis: 'Weight is substantially above the range typically associated with this height.',
    risk: 'Significantly elevated health risk; medical guidance is advisable.',
    recommendation: 'Close coordination with a healthcare provider alongside training is recommended.',
  },
  {
    max: Infinity,
    category: 'Obesity III',
    analysis: 'Weight is far above the range typically associated with this height.',
    risk: 'High health risk; medical supervision is strongly advised.',
    recommendation: 'Medical guidance alongside any fitness program is strongly recommended.',
  },
];

export const BMI_RANGES = [
  { label: 'Underweight', range: '< 18.5' },
  { label: 'Normal weight', range: '18.5 - 25' },
  { label: 'Overweight', range: '25 - 30' },
  { label: 'Obesity I', range: '30 - 35' },
  { label: 'Obesity II', range: '35 - 40' },
  { label: 'Obesity III', range: '> 40' },
];

export function calculateBmi(weightKg: number, heightCm: number): number {
  return parseFloat((weightKg / ((heightCm / 100) ** 2)).toFixed(2));
}

export function bmiCategoryInfo(bmi: number): BmiCategory {
  const match = CATEGORIES.find((c) => bmi < c.max) || CATEGORIES[CATEGORIES.length - 1];
  const { max, ...info } = match;
  return info;
}
