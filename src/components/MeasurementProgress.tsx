import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, ActiveScreen } from '../types';

export type ChartableMetric =
  | 'weight'
  | 'body_fat_percent'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'neck'
  | 'arm'
  | 'forearm'
  | 'shoulders'
  | 'abdomen'
  | 'gluteus'
  | 'thigh'
  | 'calf';

export const METRIC_LABELS: Record<ChartableMetric, { label: string; unit: string }> = {
  weight: { label: 'Weight', unit: 'kg' },
  body_fat_percent: { label: 'Body Fat', unit: '%' },
  waist: { label: 'Waist', unit: 'cm' },
  chest: { label: 'Chest', unit: 'cm' },
  hips: { label: 'Hip', unit: 'cm' },
  neck: { label: 'Neck', unit: 'cm' },
  arm: { label: 'Biceps', unit: 'cm' },
  forearm: { label: 'Forearm', unit: 'cm' },
  shoulders: { label: 'Shoulders', unit: 'cm' },
  abdomen: { label: 'Abdomen', unit: 'cm' },
  gluteus: { label: 'Gluteus', unit: 'cm' },
  thigh: { label: 'Thigh', unit: 'cm' },
  calf: { label: 'Calf', unit: 'cm' },
};

const PRIMARY_METRICS: ChartableMetric[] = ['weight', 'body_fat_percent', 'waist', 'chest'];
const SECONDARY_METRICS: ChartableMetric[] = (Object.keys(METRIC_LABELS) as ChartableMetric[]).filter(
  (m) => !PRIMARY_METRICS.includes(m)
);

const RANGE_DAYS: Record<'1W' | '1M' | '3M' | '6M' | 'ALL', number | null> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  ALL: null,
};

interface Props {
  client: Client;
  onNavigate: (screen: ActiveScreen) => void;
  initialMetric?: ChartableMetric;
}

export const MeasurementProgress: React.FC<Props> = ({ client, onNavigate, initialMetric }) => {
  const [selectedMetric, setSelectedMetric] = useState<ChartableMetric>(initialMetric || 'weight');
  const [dateRange, setDateRange] = useState<'1W' | '1M' | '3M' | '6M' | 'ALL'>('3M');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeasurements = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMeasurements(data || []);
    } catch (err) {
      console.error('Error loading measurement progress:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeasurements();
  }, [client.id]);

  // Compute metric stats (no fabricated fallback values — dashes when data is missing)
  const latestM = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const currentWeight = latestM?.weight ?? client.starting_weight ?? null;
  const currentBodyFat = latestM?.body_fat_percent ?? null;
  const currentWaist = latestM?.waist ?? null;
  const currentChest = latestM?.chest ?? null;

  const primaryValues: Record<ChartableMetric, number | null> = {
    weight: currentWeight,
    body_fat_percent: currentBodyFat,
    waist: currentWaist,
    chest: currentChest,
  } as Record<ChartableMetric, number | null>;

  // Filter measurements to the selected date range
  const rangeFilteredMeasurements = useMemo(() => {
    const days = RANGE_DAYS[dateRange];
    if (days === null) return measurements;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return measurements.filter((m) => {
      const d = m.measured_on || m.created_at;
      return d ? new Date(d).getTime() >= cutoff : false;
    });
  }, [measurements, dateRange]);

  // Data-driven chart points for the selected metric (replaces the previous hardcoded polyline)
  const chartPoints = useMemo(() => {
    const withValue = rangeFilteredMeasurements.filter(
      (m) => m[selectedMetric] !== null && m[selectedMetric] !== undefined
    );
    if (withValue.length < 2) return null;

    const values = withValue.map((m) => m[selectedMetric] as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return withValue.map((m, idx) => ({
      x: (idx / (withValue.length - 1)) * 100,
      y: 100 - ((m[selectedMetric] as number) - min) / range * 100,
      value: m[selectedMetric] as number,
      date: m.measured_on || m.created_at || '',
    }));
  }, [rangeFilteredMeasurements, selectedMetric]);

  const firstChartDate = chartPoints && chartPoints[0].date
    ? new Date(chartPoints[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const lastChartDate = chartPoints && chartPoints[chartPoints.length - 1].date
    ? new Date(chartPoints[chartPoints.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  // This week / last week average for the selected metric (Mon-Sun weeks), matching the reference Weight screen.
  const weeklyAverages = useMemo(() => {
    const startOfWeek = (d: Date) => {
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
      const start = new Date(d);
      start.setDate(d.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      return start;
    };
    const thisWeekStart = startOfWeek(new Date());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const avgInRange = (start: Date, end: Date) => {
      const vals = measurements
        .filter((m) => {
          const d = m.measured_on || m.created_at;
          if (!d) return false;
          const t = new Date(d).getTime();
          return t >= start.getTime() && t < end.getTime();
        })
        .map((m) => m[selectedMetric])
        .filter((v): v is number => v !== null && v !== undefined);
      if (vals.length === 0) return null;
      return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
    };

    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/');
    const thisWeekEnd = new Date(thisWeekStart); thisWeekEnd.setDate(thisWeekStart.getDate() + 7);
    const lastWeekEnd = thisWeekStart;

    return {
      thisWeek: avgInRange(thisWeekStart, thisWeekEnd),
      thisWeekRange: `${fmt(thisWeekStart)} - ${fmt(new Date(thisWeekEnd.getTime() - 86400000))}`,
      lastWeek: avgInRange(lastWeekStart, lastWeekEnd),
      lastWeekRange: `${fmt(lastWeekStart)} - ${fmt(new Date(lastWeekEnd.getTime() - 86400000))}`,
    };
  }, [measurements, selectedMetric]);

  // Overall trend across the selected range
  const firstM = rangeFilteredMeasurements.length > 0 ? rangeFilteredMeasurements[0] : null;
  const lastM = rangeFilteredMeasurements.length > 0 ? rangeFilteredMeasurements[rangeFilteredMeasurements.length - 1] : null;
  const trendDiff = (lastM?.weight !== null && lastM?.weight !== undefined && firstM?.weight !== null && firstM?.weight !== undefined)
    ? parseFloat(((lastM!.weight as number) - (firstM!.weight as number)).toFixed(1))
    : null;

  return (
    <div className="flex-grow w-full max-w-4xl mx-auto p-5 flex flex-col gap-6 pb-28 font-['Inter',sans-serif]">
      {/* Header & Client Info */}
      <section className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-3xl font-semibold text-white">
          Measurement Progress
        </h2>
        <p className="text-sm text-text-muted">Client: {client.name}</p>
      </section>

      {/* Metric Selectors (Bento Grid Style) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PRIMARY_METRICS.map((metric) => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric)}
            className={`rounded-xl p-4 border text-left flex flex-col gap-1 transition-all active:scale-95 ${
              selectedMetric === metric
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-white border-border hover:bg-surface-alt'
            }`}
          >
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${
              selectedMetric === metric ? 'text-white/80' : 'text-text-muted'
            }`}>
              {METRIC_LABELS[metric].label}
            </span>
            <span className="text-xl font-bold">
              {primaryValues[metric] !== null ? `${primaryValues[metric]} ${METRIC_LABELS[metric].unit}` : '—'}
            </span>
          </button>
        ))}
      </section>

      {/* Secondary metric picker (perimeters beyond the primary 4) */}
      <section className="flex items-center gap-2">
        <label htmlFor="secondary-metric" className="text-xs font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap">
          More Metrics
        </label>
        <select
          id="secondary-metric"
          value={SECONDARY_METRICS.includes(selectedMetric) ? selectedMetric : ''}
          onChange={(e) => e.target.value && setSelectedMetric(e.target.value as ChartableMetric)}
          className="flex-1 p-2 bg-surface-alt border border-border rounded-lg text-sm text-white"
        >
          <option value="">Select a perimeter to chart...</option>
          {SECONDARY_METRICS.map((m) => (
            <option key={m} value={m}>{METRIC_LABELS[m].label}</option>
          ))}
        </select>
      </section>

      {/* Chart Section */}
      <section className="bg-surface rounded-xl border border-border p-4 md:p-6 flex flex-col gap-4">
        {/* Date Range Selector */}
        <div className="flex justify-between items-center bg-surface-alt rounded-lg p-1 w-full max-w-sm mx-auto md:mx-0">
          {(['1W', '1M', '3M', '6M', 'ALL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`flex-1 py-1 text-center text-xs font-semibold rounded-md transition-colors ${
                dateRange === r
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Chart Canvas Area */}
        {chartPoints ? (
          <div className="relative h-64 w-full mt-2 flex items-end">
            <div className="ml-2 w-full h-full relative border-b border-border">
              <svg className="absolute inset-0 w-full h-full z-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                <polyline
                  fill="none"
                  points={chartPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke="#ff6a1a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {chartPoints.map((p, idx) => (
                <div
                  key={idx}
                  className="absolute w-2.5 h-2.5 bg-surface border-2 border-accent rounded-full -translate-x-1/2 translate-y-1/2"
                  style={{ left: `${p.x}%`, bottom: `${100 - p.y}%` }}
                  title={`${p.value} ${METRIC_LABELS[selectedMetric].unit}`}
                />
              ))}

              {/* X-Axis date range labels */}
              <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-text-muted text-xs font-semibold px-1">
                <span>{firstChartDate}</span>
                <span>{lastChartDate}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-32 w-full flex items-center justify-center text-center text-sm text-text-muted">
            Not enough {METRIC_LABELS[selectedMetric].label.toLowerCase()} entries in this range to chart a trend.
          </div>
        )}

        {/* Overall Trend bar */}
        <div className="mt-8 flex items-center justify-between pt-4 border-t border-border">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Overall Trend
            </span>
            <div className="flex items-center text-accent mt-0.5 gap-1 font-semibold text-sm">
              {trendDiff !== null ? (
                <>
                  <span className="material-symbols-outlined text-base">
                    {trendDiff <= 0 ? 'trending_down' : 'trending_up'}
                  </span>
                  <span>{trendDiff > 0 ? `+${trendDiff}` : trendDiff} kg</span>
                </>
              ) : (
                <span className="text-text-muted font-normal">Not enough data</span>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('add_measurement')}
            className="bg-accent hover:bg-accent-hover text-white rounded font-semibold text-xs uppercase tracking-wider px-4 py-2 active:scale-95"
          >
            Log Entry
          </button>
        </div>

        {/* This week / last week average */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="block text-[10px] uppercase text-text-muted mb-1">This Week's Average</span>
            <span className="text-lg font-bold text-white">
              {weeklyAverages.thisWeek !== null ? `${weeklyAverages.thisWeek} ${METRIC_LABELS[selectedMetric].unit}` : '—'}
            </span>
            <span className="block text-[10px] text-text-muted mt-1">{weeklyAverages.thisWeekRange}</span>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="block text-[10px] uppercase text-text-muted mb-1">Last Week's Average</span>
            <span className="text-lg font-bold text-white">
              {weeklyAverages.lastWeek !== null ? `${weeklyAverages.lastWeek} ${METRIC_LABELS[selectedMetric].unit}` : '—'}
            </span>
            <span className="block text-[10px] text-text-muted mt-1">{weeklyAverages.lastWeekRange}</span>
          </div>
        </div>
      </section>

      {/* Recent Logs Table */}
      <section className="bg-surface rounded-xl border border-border p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-lg font-semibold text-white">Recent Logs</h3>
          <button
            onClick={() => onNavigate('client_profile')}
            className="text-xs font-semibold uppercase text-accent hover:underline"
          >
            View All
          </button>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {measurements.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-muted">
              No log history found. Click "Log Entry" to add one.
            </div>
          ) : (
            measurements.slice().reverse().map((m, idx) => {
              const dStr = m.measured_on || m.created_at;
              const dateFmt = dStr
                ? new Date(dStr).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent Entry';

              return (
                <div key={m.id || idx} className="flex items-center justify-between py-2.5 px-2 hover:bg-surface-alt rounded transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white">{dateFmt}</span>
                    <span className="text-[11px] text-text-muted">{m.session_name || 'Logged entry'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-base font-bold text-white">
                      {m.weight !== null ? `${m.weight} kg` : '—'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
