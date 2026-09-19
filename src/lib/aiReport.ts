import type { AiReport, AiGlanceTile, AiGoalProgress, AiReportLanguage } from '../types';

/**
 * The ONE place an Edge Function response becomes an AiReport.
 *
 * A provider can return a short array, a null section, or a field the schema
 * said was required. The UI must never crash on that, so every field is
 * coerced here and the renderer can then read it without guards.
 *
 * (A missing section previously reached the renderer as `undefined`, and
 * `report.whatsGoingWell.length` unmounted the whole React tree — a blank
 * screen. Normalising centrally is what prevents that class of bug.)
 */

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];

function glanceTiles(v: unknown): AiGlanceTile[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({
      label: str(t.label) || '—',
      unit: str(t.unit),
      from: typeof t.from === 'number' ? t.from : null,
      to: typeof t.to === 'number' ? t.to : 0,
      change: typeof t.change === 'number' ? t.change : null,
      changePct: typeof t.changePct === 'number' ? t.changePct : null,
      direction: (t.direction as AiGlanceTile['direction']) ?? 'none',
      good: typeof t.good === 'boolean' ? t.good : null,
      note: typeof t.note === 'string' ? t.note : null,
    }));
}

function goalNumbers(v: unknown): AiGoalProgress | null {
  if (!v || typeof v !== 'object') return null;
  const g = v as Record<string, unknown>;
  if (typeof g.targetBodyFat !== 'number' || typeof g.currentBodyFat !== 'number') return null;
  return {
    targetBodyFat: g.targetBodyFat,
    currentBodyFat: g.currentBodyFat,
    gap: typeof g.gap === 'number' ? g.gap : Math.abs(g.currentBodyFat - g.targetBodyFat),
    aboveTarget: g.aboveTarget === true,
  };
}

const LANGUAGES: AiReportLanguage[] = ['en', 'mr', 'mr_en'];

export function normalizeAiReport(raw: unknown): AiReport {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const meta = (r.meta && typeof r.meta === 'object' ? r.meta : {}) as Record<string, unknown>;
  const lang = LANGUAGES.includes(r.language as AiReportLanguage) ? (r.language as AiReportLanguage) : 'en';

  return {
    executive_summary: str(r.executive_summary),
    progress_highlights: strArray(r.progress_highlights),
    what_is_going_well: strArray(r.what_is_going_well),
    areas_to_watch: strArray(r.areas_to_watch),
    goal_progress: str(r.goal_progress),
    coaching_insights: strArray(r.coaching_insights),
    recommended_next_actions: strArray(r.recommended_next_actions),
    next_measurement_focus: strArray(r.next_measurement_focus),
    data_quality: str(r.data_quality),
    trainer_insight: str(r.trainer_insight),
    disclaimer: str(r.disclaimer),

    glance: glanceTiles(r.glance),
    goalNumbers: goalNumbers(r.goalNumbers),
    language: lang,
    periodLabel: str(r.periodLabel),
    periodStart: typeof r.periodStart === 'string' ? r.periodStart : null,
    periodEnd: typeof r.periodEnd === 'string' ? r.periodEnd : null,
    sessions: typeof r.sessions === 'number' ? r.sessions : 0,
    bodyFatSource: (r.bodyFatSource as AiReport['bodyFatSource']) ?? 'none',
    bodyFatMethod: typeof r.bodyFatMethod === 'string' ? r.bodyFatMethod : null,
    meta: {
      provider: typeof meta.provider === 'string' ? meta.provider : null,
      model: typeof meta.model === 'string' ? meta.model : null,
      cacheHit: meta.cacheHit === true,
      fallbackUsed: meta.fallbackUsed === true,
      latencyMs: typeof meta.latencyMs === 'number' ? meta.latencyMs : undefined,
      generatedAt: typeof meta.generatedAt === 'string' ? meta.generatedAt : undefined,
    },
  };
}

/** A report with no prose at all means the provider gave us nothing usable. */
export function isReportEmpty(r: AiReport): boolean {
  return (
    !r.executive_summary &&
    !r.trainer_insight &&
    r.progress_highlights.length === 0 &&
    r.what_is_going_well.length === 0 &&
    r.coaching_insights.length === 0
  );
}
