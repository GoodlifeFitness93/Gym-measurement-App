import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, ActiveScreen } from '../types';

const METRIC_LABELS: Record<'weight' | 'body_fat_percent' | 'chest' | 'waist', { label: string; unit: string }> = {
  weight: { label: 'Weight', unit: 'kg' },
  body_fat_percent: { label: 'Body Fat', unit: '%' },
  waist: { label: 'Waist', unit: 'cm' },
  chest: { label: 'Chest', unit: 'cm' },
};

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
}

export const MeasurementProgress: React.FC<Props> = ({ client, onNavigate }) => {
  const [selectedMetric, setSelectedMetric] = useState<'weight' | 'body_fat_percent' | 'chest' | 'waist'>('weight');
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
        <h2 className="text-2xl md:text-3xl font-semibold text-[#111c2d]">
          Measurement Progress
        </h2>
        <p className="text-sm text-[#3e4947]">Client: {client.name}</p>
      </section>

      {/* Metric Selectors (Bento Grid Style) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setSelectedMetric('weight')}
          className={`rounded-xl p-4 border text-left flex flex-col gap-1 shadow-xs transition-all active:scale-95 ${
            selectedMetric === 'weight'
              ? 'bg-[#005c55] text-white border-[#005c55]'
              : 'bg-white text-[#111c2d] border-[#bdc9c6]/60 hover:bg-[#f0f3ff]'
          }`}
        >
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${
            selectedMetric === 'weight' ? 'text-white/80' : 'text-[#3e4947]'
          }`}>
            Weight
          </span>
          <span className="text-xl font-bold">{currentWeight !== null ? `${currentWeight} kg` : '—'}</span>
        </button>

        <button
          onClick={() => setSelectedMetric('body_fat_percent')}
          className={`rounded-xl p-4 border text-left flex flex-col gap-1 shadow-xs transition-all active:scale-95 ${
            selectedMetric === 'body_fat_percent'
              ? 'bg-[#005c55] text-white border-[#005c55]'
              : 'bg-white text-[#111c2d] border-[#bdc9c6]/60 hover:bg-[#f0f3ff]'
          }`}
        >
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${
            selectedMetric === 'body_fat_percent' ? 'text-white/80' : 'text-[#3e4947]'
          }`}>
            Body Fat
          </span>
          <span className="text-xl font-bold">{currentBodyFat !== null ? `${currentBodyFat} %` : '—'}</span>
        </button>

        <button
          onClick={() => setSelectedMetric('waist')}
          className={`rounded-xl p-4 border text-left flex flex-col gap-1 shadow-xs transition-all active:scale-95 ${
            selectedMetric === 'waist'
              ? 'bg-[#005c55] text-white border-[#005c55]'
              : 'bg-white text-[#111c2d] border-[#bdc9c6]/60 hover:bg-[#f0f3ff]'
          }`}
        >
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${
            selectedMetric === 'waist' ? 'text-white/80' : 'text-[#3e4947]'
          }`}>
            Waist
          </span>
          <span className="text-xl font-bold">{currentWaist !== null ? `${currentWaist} cm` : '—'}</span>
        </button>

        <button
          onClick={() => setSelectedMetric('chest')}
          className={`rounded-xl p-4 border text-left flex flex-col gap-1 shadow-xs transition-all active:scale-95 ${
            selectedMetric === 'chest'
              ? 'bg-[#005c55] text-white border-[#005c55]'
              : 'bg-white text-[#111c2d] border-[#bdc9c6]/60 hover:bg-[#f0f3ff]'
          }`}
        >
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${
            selectedMetric === 'chest' ? 'text-white/80' : 'text-[#3e4947]'
          }`}>
            Chest
          </span>
          <span className="text-xl font-bold">{currentChest !== null ? `${currentChest} cm` : '—'}</span>
        </button>
      </section>

      {/* Chart Section */}
      <section className="bg-white rounded-xl border border-[#bdc9c6]/60 p-4 md:p-6 shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex flex-col gap-4">
        {/* Date Range Selector */}
        <div className="flex justify-between items-center bg-[#f0f3ff] rounded-lg p-1 w-full max-w-sm mx-auto md:mx-0">
          {(['1W', '1M', '3M', '6M', 'ALL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`flex-1 py-1 text-center text-xs font-semibold rounded-md transition-colors ${
                dateRange === r
                  ? 'bg-white text-[#005c55] shadow-xs border border-[#bdc9c6]/40'
                  : 'text-[#3e4947] hover:text-[#005c55]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Chart Canvas Area */}
        {chartPoints ? (
          <div className="relative h-64 w-full mt-2 flex items-end">
            <div className="ml-2 w-full h-full relative border-b border-[#bdc9c6]/50">
              <svg className="absolute inset-0 w-full h-full z-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                <polyline
                  fill="none"
                  points={chartPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke="#0f766e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {chartPoints.map((p, idx) => (
                <div
                  key={idx}
                  className="absolute w-2.5 h-2.5 bg-white border-2 border-[#0f766e] rounded-full -translate-x-1/2 translate-y-1/2"
                  style={{ left: `${p.x}%`, bottom: `${100 - p.y}%` }}
                  title={`${p.value} ${METRIC_LABELS[selectedMetric].unit}`}
                />
              ))}

              {/* X-Axis date range labels */}
              <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[#3e4947] text-xs font-semibold px-1">
                <span>{firstChartDate}</span>
                <span>{lastChartDate}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-32 w-full flex items-center justify-center text-center text-sm text-[#6e7977]">
            Not enough {METRIC_LABELS[selectedMetric].label.toLowerCase()} entries in this range to chart a trend.
          </div>
        )}

        {/* Overall Trend bar */}
        <div className="mt-8 flex items-center justify-between pt-4 border-t border-[#bdc9c6]/50">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#3e4947] uppercase tracking-wider">
              Overall Trend
            </span>
            <div className="flex items-center text-[#005c55] mt-0.5 gap-1 font-semibold text-sm">
              {trendDiff !== null ? (
                <>
                  <span className="material-symbols-outlined text-base">
                    {trendDiff <= 0 ? 'trending_down' : 'trending_up'}
                  </span>
                  <span>{trendDiff > 0 ? `+${trendDiff}` : trendDiff} kg</span>
                </>
              ) : (
                <span className="text-[#6e7977] font-normal">Not enough data</span>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('add_measurement')}
            className="bg-[#005c55] hover:bg-[#0f766e] text-white rounded font-semibold text-xs uppercase tracking-wider px-4 py-2 active:scale-95"
          >
            Log Entry
          </button>
        </div>
      </section>

      {/* Recent Logs Table */}
      <section className="bg-white rounded-xl border border-[#bdc9c6]/60 p-4 shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#bdc9c6]/50">
          <h3 className="text-lg font-semibold text-[#111c2d]">Recent Logs</h3>
          <button
            onClick={() => onNavigate('client_profile')}
            className="text-xs font-semibold uppercase text-[#005c55] hover:underline"
          >
            View All
          </button>
        </div>

        <div className="flex flex-col divide-y divide-[#bdc9c6]/30">
          {measurements.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#6e7977]">
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
                <div key={m.id || idx} className="flex items-center justify-between py-2.5 px-2 hover:bg-[#f0f3ff] rounded transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[#111c2d]">{dateFmt}</span>
                    <span className="text-[11px] text-[#3e4947]">Logged entry</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-base font-bold text-[#111c2d]">
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
