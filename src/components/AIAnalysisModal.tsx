import React, { useState } from 'react';
import { X, Sparkles, Check, TrendingUp, AlertTriangle, ListChecks, ArrowRight } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Client, AiReport, AiReportPeriod, AiReportGoal } from '../types';

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

const GOALS: { id: AiReportGoal; label: string }[] = [
  { id: 'gain_muscle', label: 'Gain muscle' },
  { id: 'lose_fat', label: 'Lose fat' },
];

export const AIAnalysisModal: React.FC<Props> = ({ client, onClose }) => {
  const [step, setStep] = useState(1);
  const [period, setPeriod] = useState<AiReportPeriod | null>(null);
  const [goal, setGoal] = useState<AiReportGoal | null>(null);
  const [targetBodyFat, setTargetBodyFat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiReport | null>(null);

  const handleGenerate = async () => {
    if (!period || !goal || loading) return;
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
        },
      });
      if (fnErr) throw fnErr;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate report');
      setReport(data.report as AiReport);
      setStep(4);
    } catch (err: any) {
      setError(err.message || "We couldn't generate the analysis right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            AI-Powered Analysis
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-2 rounded-full bg-surface-alt hover:bg-border text-text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step < 4 && (
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Step {step} of 3</p>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <h3 className="text-white font-semibold">How many measurements?</h3>
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    period === p.id ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-alt text-text-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => period && setStep(2)}
                disabled={!period}
                className="w-full mt-2 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <h3 className="text-white font-semibold">What is the goal?</h3>
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    goal === g.id ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-alt text-text-muted'
                  }`}
                >
                  {g.label}
                </button>
              ))}
              <div className="flex gap-2 mt-2">
                <button onClick={() => setStep(1)} className="flex-1 border border-border text-text-muted py-3 rounded-lg">
                  Back
                </button>
                <button
                  onClick={() => goal && setStep(3)}
                  disabled={!goal}
                  className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="text-white font-semibold">What's the target goal?</h3>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Target body fat % (optional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 15"
                  value={targetBodyFat}
                  onChange={(e) => setTargetBodyFat(e.target.value)}
                  className="w-full bg-surface-alt border-0 border-b-2 border-transparent focus:border-accent px-3 py-2.5 text-base text-white rounded-t transition-colors focus:outline-none"
                />
              </div>
              {error && (
                <div className="p-3 bg-danger-bg text-danger text-xs font-medium rounded-lg border border-danger/30">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 border border-border text-text-muted py-3 rounded-lg" disabled={loading}>
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    'Generate AI Report'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 4 && report && (
            <div className="space-y-4">
              <p className="text-white text-sm leading-relaxed">{report.summary}</p>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-alt rounded-lg p-2.5 text-center">
                  <span className="block text-[10px] uppercase text-text-muted mb-1">Weight</span>
                  <span className="text-xs text-white">{report.trend.weight}</span>
                </div>
                <div className="bg-surface-alt rounded-lg p-2.5 text-center">
                  <span className="block text-[10px] uppercase text-text-muted mb-1">Body Fat</span>
                  <span className="text-xs text-white">{report.trend.bodyFat}</span>
                </div>
                <div className="bg-surface-alt rounded-lg p-2.5 text-center">
                  <span className="block text-[10px] uppercase text-text-muted mb-1">Perimeters</span>
                  <span className="text-xs text-white">{report.trend.perimeters}</span>
                </div>
              </div>

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-accent text-xs font-semibold uppercase tracking-wider mb-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Goal Progress
                </div>
                <p className="text-sm text-white">{report.goalProgress}</p>
              </div>

              {report.positiveChanges.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-success text-xs font-semibold uppercase tracking-wider mb-1.5">
                    <Check className="w-3.5 h-3.5" /> Positive Changes
                  </div>
                  <ul className="space-y-1 text-sm text-white list-disc list-inside">
                    {report.positiveChanges.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              {report.areasToWatch.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Areas to Watch
                  </div>
                  <ul className="space-y-1 text-sm text-white list-disc list-inside">
                    {report.areasToWatch.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              {report.recommendations.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-accent text-xs font-semibold uppercase tracking-wider mb-1.5">
                    <ListChecks className="w-3.5 h-3.5" /> Recommendations
                  </div>
                  <ul className="space-y-1 text-sm text-white list-disc list-inside">
                    {report.recommendations.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              {report.nextSteps.length > 0 && (
                <div>
                  <div className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1.5">Next Steps</div>
                  <ul className="space-y-1 text-sm text-white list-disc list-inside">
                    {report.nextSteps.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-text-muted italic">{report.dataQuality}</p>
              <p className="text-[11px] text-text-muted border-t border-border pt-3">{report.disclaimer}</p>

              <button
                onClick={onClose}
                className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
