import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, ActiveScreen } from '../types';

interface Props {
  client: Client;
  onNavigate: (screen: ActiveScreen) => void;
}

export const ShareReportModal: React.FC<Props> = ({ client, onNavigate }) => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  // Customization options
  const [includeKeyMetrics, setIncludeKeyMetrics] = useState(true);
  const [includeCircumferences, setIncludeCircumferences] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
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

        if (!error && data) {
          setMeasurements(data);
        }
      } catch (err) {
        console.error('Error fetching report measurements:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMeasurements();
  }, [client.id]);

  // Compute first and latest measurement
  const firstM = measurements.length > 0 ? measurements[0] : null;
  const lastM = measurements.length > 0 ? measurements[measurements.length - 1] : null;

  const startDateStr = firstM?.measured_on || firstM?.created_at;
  const endDateStr = lastM?.measured_on || lastM?.created_at;

  const startDateFmt = startDateStr
    ? new Date(startDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Oct 1, 2023';

  const endDateFmt = endDateStr
    ? new Date(endDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Dec 1, 2023';

  const dateRangeHeader = `${startDateFmt} – ${endDateFmt}`;

  // Helper for delta formatting
  const formatDelta = (val1?: number | null, val2?: number | null, unitName: string = '') => {
    if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return null;
    const diff = parseFloat((val2 - val1).toFixed(1));
    const sign = diff > 0 ? `+${diff}` : `${diff}`;
    return `${val1}${unitName} → ${val2}${unitName} (${sign}${unitName})`;
  };

  const weightDeltaText = formatDelta(
    firstM?.weight ?? client.starting_weight ?? null,
    lastM?.weight ?? null,
    'kg'
  );

  const bodyFatDeltaText = formatDelta(
    firstM?.body_fat_percent ?? null,
    lastM?.body_fat_percent ?? null,
    '%'
  );

  const waistDeltaText = formatDelta(
    firstM?.waist ?? null,
    lastM?.waist ?? null,
    'cm'
  );

  const chestDeltaText = formatDelta(
    firstM?.chest ?? null,
    lastM?.chest ?? null,
    'cm'
  );

  const hipsDeltaText = formatDelta(
    firstM?.hips ?? null,
    lastM?.hips ?? null,
    'cm'
  );

  const armDeltaText = formatDelta(
    firstM?.arm ?? null,
    lastM?.arm ?? null,
    'cm'
  );

  // Generate clean readable summary text
  const generateSummaryText = () => {
    const lines: string[] = [];
    lines.push(`Progress Update — ${client.name}`);
    lines.push(dateRangeHeader);
    lines.push('');

    if (includeKeyMetrics) {
      if (weightDeltaText) lines.push(`Weight: ${weightDeltaText}`);
      if (bodyFatDeltaText) lines.push(`Body Fat %: ${bodyFatDeltaText}`);
    }

    if (includeCircumferences) {
      if (waistDeltaText) lines.push(`Waist: ${waistDeltaText}`);
      if (chestDeltaText) lines.push(`Chest: ${chestDeltaText}`);
      if (hipsDeltaText) lines.push(`Hips: ${hipsDeltaText}`);
      if (armDeltaText) lines.push(`Arm: ${armDeltaText}`);
    }

    if (includeNotes && client.goal_notes) {
      lines.push('');
      lines.push(`Notes: ${client.goal_notes}`);
    }

    lines.push('');
    lines.push('Keep up the great work! — FitTrack Pro');

    return lines.join('\n');
  };

  const summaryText = generateSummaryText();

  // Handle WhatsApp Share
  const handleWhatsAppShare = () => {
    const encodedText = encodeURIComponent(summaryText);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  // Handle Copy Text
  const handleCopyText = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="flex-grow flex flex-col px-5 py-6 gap-6 pb-28 max-w-3xl mx-auto w-full font-['Inter',sans-serif]">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-3xl font-semibold text-[#111c2d]">
          Report Preview
        </h2>
        <p className="text-sm text-[#3e4947]">
          Review and configure the progress report before sharing with {client.name}.
        </p>
      </div>

      {/* Preview Card */}
      <div className="bg-white rounded-xl border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] overflow-hidden flex flex-col">
        {/* Card Header */}
        <div className="p-4 border-b border-[#bdc9c6]/40 bg-[#f0f3ff] flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#005c55] uppercase tracking-wider">
              PROGRESS SUMMARY
            </span>
            <span className="text-lg font-semibold text-[#111c2d]">
              {client.name}
            </span>
          </div>
          <div className="text-right flex flex-col">
            <span className="text-xs text-[#3e4947] font-medium">{dateRangeHeader}</span>
          </div>
        </div>

        {/* Card Body - Metric Cards */}
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="bg-[#f0f3ff] rounded-lg p-3 flex flex-col items-center justify-center border border-[#bdc9c6]/30">
            <span className="text-[11px] font-semibold text-[#3e4947] uppercase mb-1">
              Weight Change
            </span>
            <div className="flex items-baseline gap-1">
              <span className="material-symbols-outlined text-lg text-[#005c55]">
                trending_down
              </span>
              <span className="text-2xl font-bold text-[#005c55]">
                {lastM?.weight && firstM?.weight
                  ? (lastM.weight - firstM.weight).toFixed(1)
                  : '-4.0'}
              </span>
              <span className="text-xs text-[#3e4947]">kg</span>
            </div>
          </div>

          <div className="bg-[#f0f3ff] rounded-lg p-3 flex flex-col items-center justify-center border border-[#bdc9c6]/30">
            <span className="text-[11px] font-semibold text-[#3e4947] uppercase mb-1">
              Body Fat Change
            </span>
            <div className="flex items-baseline gap-1">
              <span className="material-symbols-outlined text-lg text-[#005c55]">
                trending_down
              </span>
              <span className="text-2xl font-bold text-[#005c55]">
                {lastM?.body_fat_percent && firstM?.body_fat_percent
                  ? (lastM.body_fat_percent - firstM.body_fat_percent).toFixed(1)
                  : '-3.0'}
              </span>
              <span className="text-xs text-[#3e4947]">%</span>
            </div>
          </div>
        </div>

        {/* Raw Text Preview Box */}
        <div className="p-4 bg-[#f9f9ff] border-t border-[#bdc9c6]/40">
          <span className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-2">
            Generated Text Message Preview
          </span>
          <pre className="bg-white p-3 rounded-lg border border-[#bdc9c6] text-xs font-mono text-[#111c2d] leading-relaxed whitespace-pre-wrap">
            {summaryText}
          </pre>
        </div>
      </div>

      {/* Configuration Toggles */}
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-[#111c2d] mb-1">
          Include in Report
        </h3>

        <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#f0f3ff] transition-colors cursor-pointer border border-transparent">
          <input
            type="checkbox"
            checked={includeKeyMetrics}
            onChange={(e) => setIncludeKeyMetrics(e.target.checked)}
            className="h-5 w-5 text-[#005c55] rounded border-[#6e7977] focus:ring-[#0f766e]"
          />
          <span className="text-sm font-medium text-[#111c2d]">
            Key Metrics (Weight & Body Fat)
          </span>
        </label>

        <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#f0f3ff] transition-colors cursor-pointer border border-transparent">
          <input
            type="checkbox"
            checked={includeCircumferences}
            onChange={(e) => setIncludeCircumferences(e.target.checked)}
            className="h-5 w-5 text-[#005c55] rounded border-[#6e7977] focus:ring-[#0f766e]"
          />
          <span className="text-sm font-medium text-[#111c2d]">
            Circumference Changes (Waist, Chest, Hips, Arm)
          </span>
        </label>

        <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#f0f3ff] transition-colors cursor-pointer border border-transparent">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(e) => setIncludeNotes(e.target.checked)}
            className="h-5 w-5 text-[#005c55] rounded border-[#6e7977] focus:ring-[#0f766e]"
          />
          <span className="text-sm font-medium text-[#111c2d]">
            Client Goal Notes & Milestones
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4 border-t border-[#bdc9c6]/50">
        <button
          onClick={handleWhatsAppShare}
          className="w-full bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full py-4 px-6 font-semibold text-base flex items-center justify-center gap-2 shadow-sm btn-press"
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            chat
          </span>
          Share via WhatsApp
        </button>

        <button
          onClick={handleCopyText}
          className="w-full bg-white text-[#005c55] border-2 border-[#005c55] hover:bg-[#e7eeff] rounded-full py-3.5 px-6 font-semibold text-base flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">
            {copied ? 'check' : 'content_copy'}
          </span>
          {copied ? 'Copied to Clipboard!' : 'Copy Summary Text'}
        </button>
      </div>
    </div>
  );
};
