import React, { useRef, useState } from 'react';
import {
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Copy,
  AlertTriangle,
  Info,
  AlertOctagon,
  HelpCircle,
  Lightbulb,
  CalendarCheck,
  ShieldCheck,
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import {
  Client,
  AiReport,
  AiReportPeriod,
  AiReportGoal,
  AiReportLanguage,
  AiMetric,
} from '../types';
import { Modal } from './ui/Modal';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { normalizeAiReport, isReportEmpty } from '../lib/aiReport';

interface Props {
  client: Client;
  onClose: () => void;
}

const PERIODS: { id: AiReportPeriod; label: string }[] = [
  { id: '2w', label: 'Last two weeks' },
  { id: '1m', label: 'Last month' },
  { id: '3m', label: 'Last three months' },
  { id: '6m', label: 'Last six months' },
];

const GOALS: { id: AiReportGoal; label: string; hint: string }[] = [
  { id: 'gain_muscle', label: 'Gain muscle', hint: 'Reads weight, lean mass and limb perimeters' },
  { id: 'lose_fat', label: 'Lose fat', hint: 'Reads body fat, weight, waist and abdomen' },
];

const LANGUAGES: { id: AiReportLanguage; label: string; hint: string }[] = [
  { id: 'en', label: 'English', hint: 'Simple, plain English' },
  { id: 'mr_en', label: 'Marathi + English', hint: 'मराठी with gym words in English' },
  { id: 'mr', label: 'Marathi', hint: 'पूर्ण मराठी' },
];

/**
 * One current-state metric. Values are server-computed.
 * With a single measurement session there is no change, so no arrow and no
 * fake trend is drawn - just the value and a short note.
 */
const MetricCard: React.FC<{ m: AiMetric }> = ({ m }) => {
  const Icon = m.direction === 'increase' ? TrendingUp : m.direction === 'decrease' ? TrendingDown : Minus;
  const tone = m.good === null ? 'text-white' : m.good ? 'text-success' : 'text-accent';

  return (
    <div className="bg-surface-alt rounded-xl p-3 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted truncate">
        {m.label}
      </span>
      <span className="text-lg font-bold text-white leading-none">
        {m.value}
        {m.unit && <span className="text-xs font-semibold ml-0.5">{m.unit}</span>}
      </span>
      {m.change !== null ? (
        <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${tone}`}>
          <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
          {m.change > 0 ? '+' : ''}
          {m.change} {m.unit}
        </span>
      ) : (
        <span className="text-[11px] text-text-muted leading-tight">{m.note ?? '—'}</span>
      )}
      {m.change !== null && m.source && (
        <span className="text-[10px] text-text-muted leading-tight">{m.source}</span>
      )}
      {m.change === null && m.source && (
        <span className="text-[10px] text-text-muted leading-tight">{m.source}</span>
      )}
    </div>
  );
};

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-1.5">
    {items.map((c, i) => (
      <li key={i} className="text-sm text-white leading-snug flex gap-2">
        <span className="text-text-muted shrink-0" aria-hidden="true">&bull;</span>
        <span>{c}</span>
      </li>
    ))}
  </ul>
);

/** Section heading. Icon is decorative only, so it can never leak as text. */
const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  icon,
  children,
  className = 'text-white',
}) => (
  <h3 className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2 ${className}`}>
    <span aria-hidden="true" className="inline-flex shrink-0">{icon}</span>
    <span>{children}</span>
  </h3>
);

const SEVERITY_STYLE = {
  info: { box: 'bg-surface-alt border-border', text: 'text-white', Icon: Info },
  warning: { box: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', Icon: AlertTriangle },
  critical: { box: 'bg-danger-bg border-danger/40', text: 'text-danger', Icon: AlertOctagon },
} as const;

const CONFIDENCE_STYLE = {
  high: { dot: 'bg-success', label: 'High' },
  moderate: { dot: 'bg-amber-400', label: 'Moderate' },
  limited: { dot: 'bg-danger', label: 'Limited' },
} as const;

export const AIAnalysisModal: React.FC<Props> = ({ client, onClose }) => {
  const [step, setStep] = useState(1);
  const [period, setPeriod] = useState<AiReportPeriod | null>(null);
  const [goal, setGoal] = useState<AiReportGoal | null>(null);
  const [language, setLanguage] = useState<AiReportLanguage>('en');
  const [targetBodyFat, setTargetBodyFat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiReport | null>(null);
  const [copied, setCopied] = useState(false);

  /** Guards against a double-tap firing two identical generations. */
  const inFlight = useRef(false);

  const generate = async (lang: AiReportLanguage, force = false) => {
    if (!period || !goal || loading || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error: fnErr } = await supabase.functions.invoke('generate-ai-report', {
        body: {
          client_id: client.id,
          period,
          goal,
          target_body_fat: targetBodyFat ? parseFloat(targetBodyFat) : null,
          language: lang,
          force,
        },
      });
      if (fnErr) {
        // supabase-js only gives a generic message on non-2xx; the real reason is in the body.
        const body = await (fnErr as any)?.context?.json?.().catch(() => null);
        throw new Error(body?.error || fnErr.message);
      }
      if (!data?.success) throw new Error(data?.error || 'Failed to generate report');

      // Cached and fresh responses go through this identical path, so the
      // renderer only ever sees a fully-populated report.
      const normalized = normalizeAiReport(data.report);
      if (isReportEmpty(normalized)) throw new Error('The AI returned an empty report. Please try again.');

      setReport(normalized);
      setLanguage(lang);
      setStep(4);
    } catch (err: any) {
      setError(err.message || "We couldn't generate the analysis right now. Please try again.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const copySummary = async () => {
    if (!report) return;
    const text = [
      report.trainer_attention.summary,
      '',
      ...report.next_check_in.map((a) => `• ${a}`),
    ]
      .join('\n')
      .trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — long-press the text to copy it manually.');
    }
  };

  const footer = (() => {
    if (step === 1) {
      return (
        <button
          onClick={() => period && setStep(2)}
          disabled={!period}
          className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      );
    }
    if (step === 2) {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => setStep(1)}
            className="flex-1 border border-border text-text-muted py-3 rounded-lg flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => goal && setStep(3)}
            disabled={!goal}
            className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      );
    }
    if (step === 3) {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => setStep(2)}
            disabled={loading}
            className="flex-1 border border-border text-text-muted py-3 rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => generate(language)}
            disabled={loading}
            className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Analysing…
              </>
            ) : (
              'Generate Report'
            )}
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={onClose}
        className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press"
      >
        Done
      </button>
    );
  })();

  return (
    <Modal
      title="AI-Powered Analysis"
      icon={<Sparkles className="w-5 h-5 text-accent" />}
      onClose={onClose}
      size="lg"
      footer={footer}
    >
      <div className="p-5 space-y-4">
        {step < 4 && (
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Step {step} of 3</p>
            <div className="flex-1 h-1 bg-surface-alt rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${(step / 3) * 100}%` }} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <h3 className="text-white font-semibold">Which period should I analyse?</h3>
            <p className="text-xs text-text-muted -mt-1 mb-1">
              Only measurements inside this period are read.
            </p>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                aria-pressed={period === p.id}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  period === p.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface-alt text-text-muted hover:border-text-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <h3 className="text-white font-semibold">What is {client.name} training for?</h3>
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                aria-pressed={goal === g.id}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  goal === g.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface-alt text-text-muted hover:border-text-muted'
                }`}
              >
                <span className="block font-semibold">{g.label}</span>
                <span className="block text-[11px] opacity-80">{g.hint}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-semibold mb-1">Target body fat %</h3>
              <p className="text-xs text-text-muted mb-2">
                Optional. If set, the report measures the gap to this number.
              </p>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="e.g. 15"
                aria-label="Target body fat percentage"
                value={targetBodyFat}
                onChange={(e) => setTargetBodyFat(e.target.value)}
                className="w-full bg-surface-alt border-0 border-b-2 border-transparent focus:border-accent px-3 py-2.5 text-base text-white rounded-t transition-colors focus:outline-none"
              />
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Report language</h3>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLanguage(l.id)}
                    aria-pressed={language === l.id}
                    className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      language === l.id
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface-alt text-text-muted hover:border-text-muted'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{l.label}</span>
                    <span className="block text-[11px] opacity-80 leading-snug">{l.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-danger-bg text-danger text-xs font-medium rounded-lg border border-danger/30 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {step === 4 && report && (
          <ErrorBoundary
            title="Unable to display the AI report."
            onRetry={() => { setReport(null); setStep(3); }}
          >
          <div className="space-y-5">
            {/* Language switch: regenerates in the other language, numbers unchanged. */}
            <div className="flex items-center gap-1 bg-surface-alt rounded-lg p-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => l.id !== report.language && generate(l.id)}
                  disabled={loading}
                  aria-pressed={report.language === l.id}
                  className={`flex-1 text-xs font-semibold py-2 rounded-md transition-colors disabled:opacity-60 ${
                    report.language === l.id ? 'bg-accent text-white' : 'text-text-muted hover:text-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {loading && (
              <p className="text-xs text-text-muted flex items-center gap-2">
                <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-accent border-t-transparent" />
                Rewriting the report…
              </p>
            )}

            {/* 1. CURRENT STATE */}
            {report.current_state.length > 0 && (
              <section>
                <SectionTitle icon={<Sparkles className="w-3.5 h-3.5 text-accent" />} className="text-text-muted">
                  Current state
                </SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {report.current_state.map((m) => (
                    <MetricCard key={m.label} m={m} />
                  ))}
                </div>
                <p className="text-[11px] text-text-muted mt-2">
                  {report.periodStart === report.periodEnd
                    ? report.periodStart
                    : `${report.periodStart} – ${report.periodEnd}`}
                  {' · '}
                  {report.sessions} measurement session{report.sessions === 1 ? '' : 's'}
                </p>
              </section>
            )}

            {/* 2. TRAINER ATTENTION */}
            {report.trainer_attention.summary && (() => {
              const st = SEVERITY_STYLE[report.trainer_attention.severity];
              return (
                <section className={`rounded-xl border p-4 ${st.box}`}>
                  <div className="flex items-start gap-2.5">
                    <st.Icon className={`w-4 h-4 shrink-0 mt-0.5 ${st.text}`} aria-hidden="true" />
                    <div className="min-w-0">
                      {report.trainer_attention.title && (
                        <p className={`text-sm font-semibold ${st.text}`}>{report.trainer_attention.title}</p>
                      )}
                      <p className="text-sm text-white leading-snug mt-0.5">
                        {report.trainer_attention.summary}
                      </p>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* 3. WHAT WE KNOW */}
            {report.what_we_know.length > 0 && (
              <section>
                <SectionTitle icon={<Check className="w-3.5 h-3.5" />} className="text-success">
                  What we know
                </SectionTitle>
                <Bullets items={report.what_we_know} />
              </section>
            )}

            {/* 4. WHAT WE DON'T KNOW YET */}
            {report.what_we_dont_know.length > 0 && (
              <section>
                <SectionTitle icon={<HelpCircle className="w-3.5 h-3.5" />} className="text-text-muted">
                  What we don&apos;t know yet
                </SectionTitle>
                <Bullets items={report.what_we_dont_know} />
              </section>
            )}

            {/* 5. TRAINER INSIGHT */}
            {report.trainer_insight && (
              <section className="bg-surface-alt rounded-xl p-4">
                <SectionTitle icon={<Lightbulb className="w-3.5 h-3.5 text-accent" />}>
                  Trainer insight
                </SectionTitle>
                <p className="text-sm text-white leading-relaxed">{report.trainer_insight}</p>
              </section>
            )}

            {/* 6. NEXT CHECK-IN */}
            {report.next_check_in.length > 0 && (
              <section>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <SectionTitle icon={<CalendarCheck className="w-3.5 h-3.5 text-accent" />} className="text-white mb-0">
                    Next check-in
                  </SectionTitle>
                  <button
                    onClick={copySummary}
                    className="text-[11px] font-semibold text-accent flex items-center gap-1 hover:text-accent-hover"
                  >
                    {copied
                      ? <Check className="w-3 h-3" aria-hidden="true" />
                      : <Copy className="w-3 h-3" aria-hidden="true" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <Bullets items={report.next_check_in} />
              </section>
            )}

            {/* 7. DATA CONFIDENCE */}
            <section className="border-t border-border pt-3 flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] text-text-muted leading-snug">
                <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_STYLE[report.data_confidence.level].dot}`}
                    aria-hidden="true"
                  />
                  {CONFIDENCE_STYLE[report.data_confidence.level].label} confidence
                </span>
                {report.data_confidence.reason && <> — {report.data_confidence.reason}</>}
              </p>
            </section>
          </div>
          </ErrorBoundary>
        )}
      </div>
    </Modal>
  );
};
