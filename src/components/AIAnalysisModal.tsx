import React, { useRef, useState } from 'react';
import {
  Sparkles,
  Check,
  Target,
  Lightbulb,
  CalendarCheck,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageCircle,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import {
  Client,
  AiReport,
  AiReportPeriod,
  AiReportGoal,
  AiReportLanguage,
  AiGlanceTile,
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

/** A single number tile. Values come from the server, never from model prose. */
const GlanceCard: React.FC<{ tile: AiGlanceTile }> = ({ tile }) => {
  const Icon =
    tile.direction === 'increase' ? TrendingUp : tile.direction === 'decrease' ? TrendingDown : Minus;
  const tone = tile.good === null ? 'text-white' : tile.good ? 'text-success' : 'text-accent';

  return (
    <div className="bg-surface-alt rounded-xl p-3 flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted truncate">
        {tile.label}
      </span>
      {tile.change != null ? (
        <>
          <span className={`text-lg font-bold leading-none flex items-center gap-1 ${tone}`}>
            <Icon className="w-4 h-4 shrink-0" />
            {tile.change > 0 ? '+' : ''}
            {tile.change}
            <span className="text-xs font-semibold">{tile.unit}</span>
          </span>
          <span className="text-[11px] text-text-muted">
            {tile.from} → {tile.to} {tile.unit}
          </span>
        </>
      ) : (
        <>
          <span className="text-lg font-bold text-white leading-none">
            {tile.to}
            <span className="text-xs font-semibold ml-0.5">{tile.unit}</span>
          </span>
          <span className="text-[11px] text-text-muted">{tile.note ?? 'No change yet'}</span>
        </>
      )}
    </div>
  );
};

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-1.5">
    {items.map((c, i) => (
      <li key={i} className="text-sm text-white leading-snug flex gap-2">
        <span className="text-text-muted shrink-0">•</span>
        <span>{c}</span>
      </li>
    ))}
  </ul>
);

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
    const text = [report.executive_summary, '', ...report.recommended_next_actions.map((a) => `• ${a}`)]
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

            {report.glance.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Progress at a glance
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {report.glance.map((t) => (
                    <GlanceCard key={t.label} tile={t} />
                  ))}
                </div>
                <p className="text-[11px] text-text-muted mt-2">
                  {report.periodStart} – {report.periodEnd} · {report.sessions} measurements
                </p>
              </section>
            )}

            <p className="text-white text-sm leading-relaxed">{report.executive_summary}</p>

            {report.progress_highlights.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-white text-xs font-semibold uppercase tracking-wider mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-accent" /> Progress highlights
                </h3>
                <Bullets items={report.progress_highlights} />
              </section>
            )}

            {report.what_is_going_well.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-success text-xs font-semibold uppercase tracking-wider mb-2">
                  <Check className="w-3.5 h-3.5" /> What&apos;s going well
                </h3>
                <Bullets items={report.what_is_going_well} />
              </section>
            )}

            {report.areas_to_watch.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Areas to watch
                </h3>
                <Bullets items={report.areas_to_watch} />
              </section>
            )}

            {(report.goalNumbers || report.goal_progress) && (
              <section className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                <h3 className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Goal progress</h3>
                {report.goalNumbers && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <p className="text-[10px] uppercase text-text-muted">Target</p>
                      <p className="text-base font-bold text-white">{report.goalNumbers.targetBodyFat}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-text-muted">Current</p>
                      <p className="text-base font-bold text-white">{report.goalNumbers.currentBodyFat}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-text-muted">Gap</p>
                      <p className="text-base font-bold text-accent">{report.goalNumbers.gap}%</p>
                    </div>
                  </div>
                )}
                {report.goal_progress && (
                  <p className="text-sm text-white leading-snug">{report.goal_progress}</p>
                )}
              </section>
            )}

            {report.coaching_insights.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-white text-xs font-semibold uppercase tracking-wider mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-accent" /> Coaching insights
                </h3>
                <Bullets items={report.coaching_insights} />
              </section>
            )}

            {report.recommended_next_actions.length > 0 && (
              <section>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="flex items-center gap-1.5 text-accent text-xs font-semibold uppercase tracking-wider">
                    <Target className="w-3.5 h-3.5" /> Recommended next actions
                  </h3>
                  <button
                    onClick={copySummary}
                    className="text-[11px] font-semibold text-accent flex items-center gap-1 hover:text-accent-hover"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <Bullets items={report.recommended_next_actions} />
              </section>
            )}

            {report.next_measurement_focus.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-white text-xs font-semibold uppercase tracking-wider mb-2">
                  <CalendarCheck className="w-3.5 h-3.5 text-accent" /> Next measurement focus
                </h3>
                <Bullets items={report.next_measurement_focus} />
              </section>
            )}

            {report.trainer_insight && (
              <section className="bg-surface-alt rounded-xl p-4">
                <h3 className="flex items-center gap-1.5 text-white text-xs font-semibold uppercase tracking-wider mb-2">
                  <MessageCircle className="w-3.5 h-3.5 text-accent" /> Trainer insight
                </h3>
                <p className="text-sm text-white leading-relaxed">{report.trainer_insight}</p>
              </section>
            )}

            <div className="border-t border-border pt-3 space-y-1">
              <p className="text-[11px] text-text-muted">{report.data_quality}</p>
              <p className="text-[11px] text-text-muted italic">{report.disclaimer}</p>
            </div>
          </div>
          </ErrorBoundary>
        )}
      </div>
    </Modal>
  );
};
