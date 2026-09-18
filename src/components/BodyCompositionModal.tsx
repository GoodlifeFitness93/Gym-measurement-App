import React, { useMemo, useState } from 'react';
import { PersonStanding, ChevronRight, Info, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Client, Measurement } from '../types';
import { calculateBmi, bmiCategoryInfo } from '../lib/bmi';
import {
  compositionBreakdown,
  resolveBodyFat,
  missingForBodyFat,
  ffmiCategory,
} from '../lib/bodyComposition';
import { BMIDetailModal } from './BMIDetailModal';
import { Modal } from './ui/Modal';

interface Props {
  client: Client;
  measurements: Measurement[];
  onClose: () => void;
}

interface Row {
  key: string;
  label: string;
  sublabel: string;
  value: string | null;
  /** Change vs. the earliest measurement in range, already formatted. */
  delta?: { text: string; good: boolean | null } | null;
  onClick?: () => void;
  /** Shown instead of a value when the data needed is not recorded yet. */
  missing?: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const BodyCompositionModal: React.FC<Props> = ({ client, measurements, onClose }) => {
  const [showBmiDetail, setShowBmiDetail] = useState(false);

  const { latest, first } = useMemo(() => {
    const sorted = [...measurements].sort(
      (a, b) => new Date(a.measured_on).getTime() - new Date(b.measured_on).getTime()
    );
    return { latest: sorted[sorted.length - 1] ?? null, first: sorted[0] ?? null };
  }, [measurements]);

  const latestFat = resolveBodyFat(client, latest);
  const firstFat = resolveBodyFat(client, first);

  const bmi = latest?.weight && client.height_cm ? calculateBmi(latest.weight, client.height_cm) : null;
  const firstBmi = first?.weight && client.height_cm ? calculateBmi(first.weight, client.height_cm) : null;

  const comp = compositionBreakdown(latest?.weight, client.height_cm, latestFat?.percent ?? null);
  const firstComp = compositionBreakdown(first?.weight, client.height_cm, firstFat?.percent ?? null);

  const hasTrend = !!first && !!latest && first.measured_on !== latest.measured_on;

  /** Formats "+1.2 kg" / "-0.4" and colours it by whether the direction helps. */
  const delta = (
    now: number | null | undefined,
    then: number | null | undefined,
    unit: string,
    lowerIsBetter: boolean | null
  ): Row['delta'] => {
    if (!hasTrend || now == null || then == null) return null;
    const d = parseFloat((now - then).toFixed(1));
    if (d === 0) return { text: `No change${unit ? ` (${unit})` : ''}`, good: null };
    const good = lowerIsBetter === null ? null : lowerIsBetter ? d < 0 : d > 0;
    return { text: `${d > 0 ? '+' : ''}${d}${unit ? ` ${unit}` : ''}`, good };
  };

  const fatMissing = latest ? missingForBodyFat(client, latest) : [];

  const rows: Row[] = [
    {
      key: 'weight',
      label: 'Weight',
      sublabel: 'Total body weight on the scale',
      value: latest?.weight != null ? `${latest.weight} kg` : null,
      delta: delta(latest?.weight, first?.weight, 'kg', null),
      missing: 'Add a weight in the next measurement.',
    },
    {
      key: 'fat',
      label: 'Fat',
      sublabel:
        latestFat?.source === 'us_navy'
          ? 'US Navy estimate from neck / waist / hip'
          : 'Percentage of body weight that is fat',
      value: latestFat ? `${latestFat.percent} %` : null,
      delta: delta(latestFat?.percent, firstFat?.percent, '%', true),
      missing: fatMissing.length ? `Needs ${fatMissing.join(', ')}.` : undefined,
    },
    {
      key: 'muscle',
      label: 'Muscle (Fat-Free Mass)',
      sublabel: 'Everything that is not fat — muscle, bone, organs, water',
      value: comp ? `${comp.leanMassKg} kg` : null,
      delta: delta(comp?.leanMassKg, firstComp?.leanMassKg, 'kg', false),
      missing: 'Needs weight plus a body-fat percentage.',
    },
    {
      key: 'fatmass',
      label: 'Fat Mass',
      sublabel: 'Weight carried as body fat',
      value: comp ? `${comp.fatMassKg} kg` : null,
      delta: delta(comp?.fatMassKg, firstComp?.fatMassKg, 'kg', true),
      missing: 'Needs weight plus a body-fat percentage.',
    },
    {
      key: 'bmi',
      label: 'BMI',
      sublabel: bmi != null ? bmiCategoryInfo(bmi).category : 'Weight compared to height',
      value: bmi != null ? `${bmi}` : null,
      delta: delta(bmi, firstBmi, '', null),
      onClick: bmi != null ? () => setShowBmiDetail(true) : undefined,
      missing: 'Needs weight and the height in Client Settings.',
    },
    {
      key: 'ffmi',
      label: 'FFMI',
      sublabel: 'Fat-free mass relative to height',
      value: comp ? `${comp.ffmi}` : null,
      delta: delta(comp?.ffmi, firstComp?.ffmi, '', false),
      missing: 'Needs weight, height and a body-fat percentage.',
    },
    {
      key: 'nffmi',
      label: 'Nor. FFMI',
      sublabel: comp
        ? ffmiCategory(comp.normalizedFfmi, client.biological_sex)
        : 'FFMI adjusted to a 1.80 m reference height',
      value: comp ? `${comp.normalizedFfmi}` : null,
      delta: delta(comp?.normalizedFfmi, firstComp?.normalizedFfmi, '', false),
      missing: 'Needs weight, height and a body-fat percentage.',
    },
  ];

  return (
    <Modal title="Body Composition" icon={<PersonStanding className="w-5 h-5 text-accent" />} onClose={onClose} size="md">
      <div className="p-5 space-y-3">
        {!latest && (
          <p className="text-sm text-text-muted text-center py-8">
            No measurements yet — log one to see body composition.
          </p>
        )}

        {latest && (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Latest</p>
              <p className="text-xs text-text-muted">{fmtDate(latest.measured_on)}</p>
            </div>

            {rows.map((r) => {
              const Wrapper = r.onClick ? 'button' : 'div';
              return (
                <Wrapper
                  key={r.key}
                  {...(r.onClick ? { type: 'button' as const, onClick: r.onClick } : {})}
                  className={`w-full text-left px-4 py-3 bg-surface-alt rounded-xl block ${
                    r.onClick ? 'hover:bg-border transition-colors' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{r.label}</p>
                      <p className="text-[11px] text-text-muted leading-snug">{r.sublabel}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.value ? (
                        <div className="text-right">
                          <p className="text-lg font-bold text-white leading-tight">{r.value}</p>
                          {r.delta && (
                            <p
                              className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${
                                r.delta.good === null
                                  ? 'text-text-muted'
                                  : r.delta.good
                                    ? 'text-success'
                                    : 'text-accent'
                              }`}
                            >
                              {r.delta.text.startsWith('+') ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : r.delta.text.startsWith('-') ? (
                                <TrendingDown className="w-3 h-3" />
                              ) : (
                                <Minus className="w-3 h-3" />
                              )}
                              {r.delta.text}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted italic max-w-[9.5rem] text-right leading-snug">
                          {r.missing ?? 'Not enough data'}
                        </span>
                      )}
                      {r.onClick && <ChevronRight className="w-4 h-4 text-text-muted" />}
                    </div>
                  </div>
                </Wrapper>
              );
            })}

            {latestFat?.source === 'us_navy' && (
              <p className="text-[11px] text-text-muted flex gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>
                  Body fat is a <strong className="text-white">US Navy estimate</strong> calculated from this
                  client&apos;s neck, waist{client.biological_sex === 'female' ? ' and hip' : ''} measurements and
                  height. Enter a measured body-fat % in a measurement and that value is used instead.
                </span>
              </p>
            )}

            {hasTrend && (
              <p className="text-[11px] text-text-muted pt-1">
                Change shown against {fmtDate(first!.measured_on)} ({measurements.length} measurements).
              </p>
            )}
            {!hasTrend && (
              <p className="text-[11px] text-text-muted pt-1">
                Only one measurement recorded — log another to see change over time.
              </p>
            )}
          </>
        )}
      </div>

      {showBmiDetail && bmi != null && <BMIDetailModal bmi={bmi} onClose={() => setShowBmiDetail(false)} />}
    </Modal>
  );
};
