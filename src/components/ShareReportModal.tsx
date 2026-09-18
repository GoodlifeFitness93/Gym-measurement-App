import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Copy, Check, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, ActiveScreen } from '../types';
import { PERIMETERS } from '../lib/perimeters';
import { resolveBodyFat } from '../lib/bodyComposition';

interface Props {
  client: Client;
  onNavigate: (screen: ActiveScreen) => void;
}

interface ChangeRow {
  label: string;
  unit: string;
  from: number;
  to: number;
  change: number;
  /** null when neither direction is inherently good (e.g. weight without a goal). */
  good: boolean | null;
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

export const ShareReportModal: React.FC<Props> = ({ client }) => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

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
          // Order by the date the measurement was taken, not when the row was
          // created — otherwise back-dated entries invert the period header.
          .order('measured_on', { ascending: true })
          .eq('client_id', client.id);
        if (!error && data) setMeasurements(data);
      } catch (err) {
        console.error('Error fetching report measurements:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMeasurements();
  }, [client.id]);

  const firstM = measurements.length > 0 ? measurements[0] : null;
  const lastM = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const hasRange = !!firstM && !!lastM && firstM !== lastM;

  const startDateFmt = fmtDate(firstM?.measured_on);
  const endDateFmt = fmtDate(lastM?.measured_on);
  const dateRangeHeader = startDateFmt && endDateFmt ? `${startDateFmt} – ${endDateFmt}` : '—';

  const firstFat = firstM ? resolveBodyFat(client, firstM) : null;
  const lastFat = lastM ? resolveBodyFat(client, lastM) : null;

  /** Builds a row only when both ends exist — never invents a value. */
  const row = (
    label: string,
    unit: string,
    from: number | null | undefined,
    to: number | null | undefined,
    good: boolean | null
  ): ChangeRow | null => {
    if (from == null || to == null) return null;
    const change = parseFloat((to - from).toFixed(1));
    return { label, unit, from, to, change, good };
  };

  const keyRows = useMemo(
    () =>
      [
        row('Weight', 'kg', firstM?.weight, lastM?.weight, null),
        row('Body Fat', '%', firstFat?.percent, lastFat?.percent, true),
      ].filter((r): r is ChangeRow => r !== null),
    [firstM, lastM, firstFat, lastFat]
  );

  const perimeterRows = useMemo(
    () =>
      PERIMETERS.map((p) =>
        row(p.label, 'cm', firstM?.[p.dbColumn] as number | null, lastM?.[p.dbColumn] as number | null, null)
      )
        .filter((r): r is ChangeRow => r !== null)
        .filter((r) => r.change !== 0),
    [firstM, lastM]
  );

  const headlineWeight = keyRows.find((r) => r.label === 'Weight') ?? null;
  const headlineFat = keyRows.find((r) => r.label === 'Body Fat') ?? null;

  /** Factual one-liner derived from the numbers — no invented encouragement. */
  const progressHighlight = useMemo(() => {
    if (!hasRange) return null;
    const parts: string[] = [];
    if (headlineWeight && headlineWeight.change !== 0) {
      parts.push(`weight ${headlineWeight.change < 0 ? 'down' : 'up'} ${Math.abs(headlineWeight.change)} kg`);
    }
    if (headlineFat && headlineFat.change !== 0) {
      parts.push(`body fat ${headlineFat.change < 0 ? 'down' : 'up'} ${Math.abs(headlineFat.change)}%`);
    }
    const biggest = [...perimeterRows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
    if (biggest) {
      parts.push(`${biggest.label.toLowerCase()} ${biggest.change < 0 ? 'down' : 'up'} ${Math.abs(biggest.change)} cm`);
    }
    if (parts.length === 0) return 'Measurements held steady across this period.';
    return `Over ${measurements.length} measurements: ${parts.join(', ')}.`;
  }, [hasRange, headlineWeight, headlineFat, perimeterRows, measurements.length]);

  /**
   * Compact, scannable WhatsApp text. Values stay exactly as recorded —
   * only the presentation is simplified.
   */
  const summaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push('*GOODLIFE FITNESS*');
    lines.push('Progress Report');
    lines.push('');
    lines.push(`Client: ${client.name}`);
    lines.push(`Period: ${dateRangeHeader}`);

    if (!firstM) {
      lines.push('');
      lines.push('No measurements recorded yet.');
      return lines.join('\n');
    }

    const fmtRow = (r: ChangeRow) =>
      `${r.label}: ${r.from} → ${r.to} ${r.unit} (${r.change > 0 ? '+' : ''}${r.change})`;

    if (includeKeyMetrics && keyRows.length > 0) {
      lines.push('');
      lines.push('*KEY CHANGES*');
      keyRows.forEach((r) => lines.push(fmtRow(r)));
    }

    if (includeCircumferences && perimeterRows.length > 0) {
      lines.push('');
      lines.push('*MEASUREMENTS*');
      perimeterRows.forEach((r) => lines.push(fmtRow(r)));
    }

    if (progressHighlight) {
      lines.push('');
      lines.push('*PROGRESS HIGHLIGHT*');
      lines.push(progressHighlight);
    }

    if (includeNotes && client.goal_notes) {
      lines.push('');
      lines.push('*NEXT FOCUS*');
      lines.push(client.goal_notes);
    }

    lines.push('');
    lines.push('— Goodlife Fitness');
    return lines.join('\n');
  }, [
    client.name,
    client.goal_notes,
    dateRangeHeader,
    firstM,
    keyRows,
    perimeterRows,
    progressHighlight,
    includeKeyMetrics,
    includeCircumferences,
    includeNotes,
  ]);

  const handleWhatsAppShare = () => {
    const phone = client.phone ? client.phone.replace(/[^\d]/g, '') : '';
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(summaryText)}`
      : `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const Headline: React.FC<{ label: string; r: ChangeRow | null; unit: string }> = ({ label, r, unit }) => {
    const Icon = !r || r.change === 0 ? Minus : r.change < 0 ? TrendingDown : TrendingUp;
    return (
      <div className="bg-surface-alt rounded-lg p-3 flex flex-col items-center justify-center border border-border">
        <span className="text-[11px] font-semibold text-text-muted uppercase mb-1 text-center">{label}</span>
        {r ? (
          <>
            <div className="flex items-baseline gap-1">
              <Icon className="w-4 h-4 text-accent self-center" />
              <span className="text-2xl font-bold text-accent">
                {r.change > 0 ? '+' : ''}
                {r.change}
              </span>
              <span className="text-xs text-text-muted">{unit}</span>
            </div>
            <span className="text-[11px] text-text-muted mt-0.5">
              {r.from} → {r.to} {unit}
            </span>
          </>
        ) : (
          <span className="text-xs text-text-muted italic text-center">Not recorded</span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col px-5 py-6 gap-6 max-w-3xl mx-auto w-full font-['Inter',sans-serif]">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-3xl font-semibold text-white">Report Preview</h2>
        <p className="text-sm text-text-muted">
          Review and configure the progress report before sharing with {client.name}.
        </p>
      </div>

      {!firstM && (
        <div className="bg-surface border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-text-muted">
            {client.name} has no measurements yet, so there is nothing to report. Log a measurement first.
          </p>
        </div>
      )}

      {firstM && (
        <>
          <div className="bg-surface rounded-xl border border-border shadow-[0_4px_12px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border bg-surface-alt flex flex-wrap justify-between items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                  Progress Summary
                </span>
                <span className="text-lg font-semibold text-white">{client.name}</span>
              </div>
              <span className="text-xs text-text-muted font-medium">{dateRangeHeader}</span>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              <Headline label="Weight Change" r={headlineWeight} unit="kg" />
              <Headline label="Body Fat Change" r={headlineFat} unit="%" />
            </div>

            {!hasRange && (
              <p className="px-4 pb-4 -mt-1 text-[11px] text-text-muted">
                Only one measurement on record — a change can be shown once a second one is logged.
              </p>
            )}

            <div className="p-4 bg-ink border-t border-border">
              <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                WhatsApp message preview
              </span>
              <pre className="bg-surface p-3 rounded-lg border border-border text-xs text-white leading-relaxed whitespace-pre-wrap break-words">
                {summaryText}
              </pre>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-white mb-1">Include in Report</h3>

            {[
              {
                checked: includeKeyMetrics,
                set: setIncludeKeyMetrics,
                label: 'Key Metrics (Weight & Body Fat)',
              },
              {
                checked: includeCircumferences,
                set: setIncludeCircumferences,
                label: `Measurement Changes (${perimeterRows.length} recorded)`,
              },
              {
                checked: includeNotes,
                set: setIncludeNotes,
                label: 'Client Goal Notes as "Next Focus"',
              },
            ].map((opt) => (
              <label
                key={opt.label}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-alt transition-colors cursor-pointer border border-transparent"
              >
                <input
                  type="checkbox"
                  checked={opt.checked}
                  onChange={(e) => opt.set(e.target.checked)}
                  className="h-5 w-5 accent-[var(--color-accent)] rounded"
                />
                <span className="text-sm font-medium text-white">{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-border">
            <button
              onClick={handleWhatsAppShare}
              className="w-full bg-accent hover:bg-accent-hover text-white rounded-full py-4 px-6 font-semibold text-base flex items-center justify-center gap-2 shadow-sm btn-press"
            >
              <MessageCircle className="w-5 h-5" />
              Share via WhatsApp
            </button>

            <button
              onClick={handleCopyText}
              className="w-full bg-surface text-accent border-2 border-accent hover:bg-surface-alt rounded-full py-3.5 px-6 font-semibold text-base flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Summary Text'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
