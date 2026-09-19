import type {
  AiReport,
  AiMetric,
  AiGoalProgress,
  AiReportLanguage,
  AiTrainerAttention,
  AiDataConfidence,
} from '../types';

/**
 * The ONE place an Edge Function response becomes an AiReport.
 *
 * A provider can return a short array, a null section, or omit a field the
 * schema said was required. The UI must never crash on that, so every field is
 * coerced here and the renderer can then read it without guards.
 *
 * (A missing section once reached the renderer as `undefined`, and
 * `report.whatsGoingWell.length` unmounted the whole React tree — a blank
 * screen. Normalising centrally is what prevents that class of bug.)
 */

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const strArray = (v: unknown, max = 8): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max)
    : [];

const DIRECTIONS: AiMetric['direction'][] = ['increase', 'decrease', 'flat', 'none'];

function metrics(v: unknown): AiMetric[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .filter((m) => typeof m.value === 'number' && isFinite(m.value as number))
    .map((m) => ({
      label: str(m.label) || '—',
      value: m.value as number,
      unit: str(m.unit),
      change: typeof m.change === 'number' && isFinite(m.change) ? m.change : null,
      direction: DIRECTIONS.includes(m.direction as AiMetric['direction'])
        ? (m.direction as AiMetric['direction'])
        : 'none',
      good: typeof m.good === 'boolean' ? m.good : null,
      note: typeof m.note === 'string' && m.note.trim() ? m.note.trim() : null,
      source: typeof m.source === 'string' && m.source.trim() ? m.source.trim() : null,
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

const SEVERITIES: AiTrainerAttention['severity'][] = ['info', 'warning', 'critical'];

function attention(v: unknown): AiTrainerAttention {
  const a = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    title: str(a.title),
    summary: str(a.summary),
    severity: SEVERITIES.includes(a.severity as AiTrainerAttention['severity'])
      ? (a.severity as AiTrainerAttention['severity'])
      : 'info',
  };
}

const LEVELS: AiDataConfidence['level'][] = ['high', 'moderate', 'limited'];

/**
 * The level is computed server-side; the model only writes the reason. Models
 * still sometimes open with "Confidence is moderate because ...", which can
 * contradict the computed level shown beside it. Strip that opener so only the
 * explanation remains.
 */
function cleanReason(raw: string): string {
  const cleaned = raw
    .replace(/^(data\s+)?confidence\s+(is|level\s+is)\s+\w+[,;]?\s*(because|as|since|due to|given)?\s*/i, '')
    .trim();
  if (!cleaned) return raw;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function confidence(v: unknown): AiDataConfidence {
  const c = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const reason = str(c.reason);
  return {
    level: LEVELS.includes(c.level as AiDataConfidence['level'])
      ? (c.level as AiDataConfidence['level'])
      : 'limited',
    reason: reason ? cleanReason(reason) : '',
  };
}

const LANGUAGES: AiReportLanguage[] = ['en', 'mr', 'mr_en'];

export function normalizeAiReport(raw: unknown): AiReport {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const meta = (r.meta && typeof r.meta === 'object' ? r.meta : {}) as Record<string, unknown>;
  const lang = LANGUAGES.includes(r.language as AiReportLanguage) ? (r.language as AiReportLanguage) : 'en';

  return {
    trainer_attention: attention(r.trainer_attention),
    what_we_know: strArray(r.what_we_know, 4),
    what_we_dont_know: strArray(r.what_we_dont_know, 3),
    trainer_insight: str(r.trainer_insight),
    next_check_in: strArray(r.next_check_in, 4),
    data_confidence: confidence(r.data_confidence),

    current_state: metrics(r.current_state),
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

/** No prose at all means the provider gave us nothing usable. */
export function isReportEmpty(r: AiReport): boolean {
  return (
    !r.trainer_insight &&
    !r.trainer_attention.summary &&
    r.what_we_know.length === 0 &&
    r.next_check_in.length === 0
  );
}
