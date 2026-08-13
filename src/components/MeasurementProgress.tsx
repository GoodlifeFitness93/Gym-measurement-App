import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, ActiveScreen } from '../types';

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

  // Compute metric stats
  const latestM = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const currentWeight = latestM?.weight ?? client.starting_weight ?? 68.2;
  const currentBodyFat = latestM?.body_fat_percent ?? 22.4;
  const currentWaist = latestM?.waist ?? 78.0;
  const currentChest = latestM?.chest ?? 92.0;

  // Calculate 3-month trend
  const firstM = measurements.length > 0 ? measurements[0] : null;
  const trendDiff = (latestM?.weight && firstM?.weight)
    ? parseFloat((latestM.weight - firstM.weight).toFixed(1))
    : -3.4;

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
          <span className="text-xl font-bold">{currentWeight} kg</span>
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
          <span className="text-xl font-bold">{currentBodyFat} %</span>
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
          <span className="text-xl font-bold">{currentWaist} cm</span>
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
          <span className="text-xl font-bold">{currentChest} cm</span>
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
        <div className="relative h-64 w-full mt-2 flex items-end">
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[#3e4947] text-xs font-semibold text-right pr-2 pb-6 border-r border-[#bdc9c6]/50">
            <span>72kg</span>
            <span>70kg</span>
            <span>68kg</span>
            <span>66kg</span>
          </div>

          <div className="ml-10 w-full h-full relative border-b border-[#bdc9c6]/50">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between z-0 pointer-events-none">
              <div className="w-full border-t border-[#bdc9c6]/30 h-0" />
              <div className="w-full border-t border-[#bdc9c6]/30 h-0" />
              <div className="w-full border-t border-[#bdc9c6]/30 h-0" />
              <div className="w-full border-t border-[#bdc9c6]/30 h-0" />
            </div>

            {/* Area Fill */}
            <div
              className="absolute bottom-0 left-0 right-0 h-3/4 z-10"
              style={{
                background: 'linear-gradient(to top, rgba(15, 118, 110, 0.15) 0%, rgba(15, 118, 110, 0) 100%)',
                clipPath: 'polygon(0% 100%, 0% 80%, 20% 70%, 40% 60%, 60% 75%, 80% 50%, 100% 40%, 100% 100%)',
              }}
            />

            {/* Line SVG */}
            <svg className="absolute inset-0 w-full h-full z-20" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path
                d="M0,80 L20,70 L40,60 L60,75 L80,50 L100,40"
                fill="none"
                stroke="#0f766e"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx="0" cy="80" fill="#ffffff" r="3.5" stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <circle cx="20" cy="70" fill="#ffffff" r="3.5" stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <circle cx="40" cy="60" fill="#ffffff" r="3.5" stroke="#0f766e" strokeWidth="2" vector-effect="non-scaling-stroke" />
              <circle cx="60" cy="75" fill="#ffffff" r="3.5" stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <circle cx="80" cy="50" fill="#ffffff" r="3.5" stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <circle cx="100" cy="40" fill="#0f766e" r="5" stroke="#ffffff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>

            {/* Current Tooltip Badge */}
            <div className="absolute right-0 top-[30%] -translate-y-full translate-x-2 bg-[#263143] text-[#ecf1ff] px-2 py-1 rounded shadow-md z-30 text-xs font-bold whitespace-nowrap">
              {currentWeight} kg
            </div>

            {/* X-Axis Month Labels */}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[#3e4947] text-xs font-semibold px-2">
              <span>Oct</span>
              <span>Nov</span>
              <span>Dec</span>
              <span>Jan</span>
            </div>
          </div>
        </div>

        {/* 3-Month Trend bar */}
        <div className="mt-8 flex items-center justify-between pt-4 border-t border-[#bdc9c6]/50">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#3e4947] uppercase tracking-wider">
              Overall Trend
            </span>
            <div className="flex items-center text-[#005c55] mt-0.5 gap-1 font-semibold text-sm">
              <span className="material-symbols-outlined text-base">
                {trendDiff <= 0 ? 'trending_down' : 'trending_up'}
              </span>
              <span>{trendDiff > 0 ? `+${trendDiff}` : trendDiff} kg</span>
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
              const dStr = m.measured_at || m.date || m.created_at;
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
