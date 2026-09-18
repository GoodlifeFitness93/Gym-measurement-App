import { createClient } from "jsr:@supabase/supabase-js@2";

/* ════════════════════════════════════════════════════════════════════════
   MODEL CONFIGURATION — the only place model IDs live.

   Every ID below was read from each provider's live model list on
   2026-09-18 (see the `ai-model-probe` throwaway function in git history),
   not from memory. If a provider retires one, change it here only.

   Groq and OpenRouter are both OpenAI-compatible /chat/completions, so they
   share one adapter. Gemini keeps its own existing call shape.
   ════════════════════════════════════════════════════════════════════════ */

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Kept for backwards compatibility with the previously deployed function.
const GEMINI_MODEL_OVERRIDE = Deno.env.get("GEMINI_MODEL");

const REPORT_VERSION = "v5";

interface ProviderEntry {
  provider: "groq" | "openrouter" | "gemini";
  model: string;
  kind: "openai" | "gemini";
  url: string;
  key: string | undefined;
}

const PROVIDERS: ProviderEntry[] = [
  {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    kind: "openai",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: GROQ_API_KEY,
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-20b",
    kind: "openai",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: GROQ_API_KEY,
  },
  {
    provider: "openrouter",
    model: "qwen/qwen3.8-27b:free",
    kind: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: OPENROUTER_API_KEY,
  },
  {
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash-0731:free",
    kind: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: OPENROUTER_API_KEY,
  },
  {
    provider: "gemini",
    model: GEMINI_MODEL_OVERRIDE ?? "gemini-3.8-flash",
    kind: "gemini",
    url: "",
    key: GEMINI_API_KEY,
  },
  {
    provider: "gemini",
    model: "gemini-3.6-flash",
    kind: "gemini",
    url: "",
    key: GEMINI_API_KEY,
  },
].filter((p) => !!p.key) as ProviderEntry[];

const ATTEMPT_TIMEOUT_MS = 25_000;
const BACKOFF_MS = 400;

/* ──────────────────────────── plumbing ──────────────────────────── */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

const PERIOD_DAYS: Record<string, number> = { "2w": 14, "1m": 30, "3m": 90, "6m": 180 };
const PERIOD_LABEL: Record<string, string> = {
  "2w": "the last two weeks",
  "1m": "the last month",
  "3m": "the last three months",
  "6m": "the last six months",
};

const PERIMETER_FIELDS: { key: string; label: string }[] = [
  { key: "neck", label: "Neck" },
  { key: "shoulders", label: "Shoulders" },
  { key: "chest", label: "Chest" },
  { key: "arm", label: "Biceps" },
  { key: "forearm", label: "Forearm" },
  { key: "waist", label: "Waist" },
  { key: "abdomen", label: "Abdomen" },
  { key: "hips", label: "Hip" },
  { key: "gluteus", label: "Gluteus" },
  { key: "thigh", label: "Thigh" },
  { key: "calf", label: "Calf" },
];

/* ─────────────────────── canonical report schema ─────────────────────── */

const STRING_ARRAY = { type: "array", items: { type: "string" } };

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    executive_summary: { type: "string" },
    progress_highlights: STRING_ARRAY,
    what_is_going_well: STRING_ARRAY,
    areas_to_watch: STRING_ARRAY,
    goal_progress: { type: "string" },
    coaching_insights: STRING_ARRAY,
    recommended_next_actions: STRING_ARRAY,
    next_measurement_focus: STRING_ARRAY,
    data_quality: { type: "string" },
    trainer_insight: { type: "string" },
    disclaimer: { type: "string" },
  },
  required: [
    "executive_summary",
    "progress_highlights",
    "what_is_going_well",
    "areas_to_watch",
    "goal_progress",
    "coaching_insights",
    "recommended_next_actions",
    "next_measurement_focus",
    "data_quality",
    "trainer_insight",
    "disclaimer",
  ],
};

// Gemini's responseSchema is a restricted JSON-Schema subset and rejects
// `additionalProperties` with a 400. Without this both Gemini entries fail,
// which silently kills the last-resort tier.
const GEMINI_SCHEMA: Record<string, unknown> = { ...REPORT_SCHEMA };
delete GEMINI_SCHEMA.additionalProperties;

const STRING_FIELDS = [
  "executive_summary",
  "goal_progress",
  "data_quality",
  "trainer_insight",
  "disclaimer",
] as const;

const ARRAY_FIELDS = [
  "progress_highlights",
  "what_is_going_well",
  "areas_to_watch",
  "coaching_insights",
  "recommended_next_actions",
  "next_measurement_focus",
] as const;

/** Never trust raw model output — every response is checked before it is saved. */
function validateReport(r: unknown): r is Record<string, unknown> {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  for (const f of STRING_FIELDS) {
    if (typeof o[f] !== "string" || (o[f] as string).trim().length === 0) return false;
  }
  for (const f of ARRAY_FIELDS) {
    if (!Array.isArray(o[f]) || (o[f] as unknown[]).some((x) => typeof x !== "string")) return false;
  }
  return true;
}

/* ──────────────────── verified numeric fact computation ──────────────────── */

interface Fact {
  label: string;
  unit: string;
  sessions: number;
  start: number;
  startDate: string;
  latest: number;
  latestDate: string;
  previous?: number;
  previousDate?: string;
  change?: number;
  changePct?: number | null;
  changeSincePrevious?: number;
  trend?: string;
  note?: string;
}

/**
 * Builds starting / previous / latest + verified deltas for one metric.
 * A single data point yields a `note` and no change fields, so the model
 * physically cannot narrate a trend that does not exist.
 */
function metricFact(label: string, unit: string, values: { date: string; value: number }[]): Fact | null {
  if (values.length === 0) return null;
  const start = values[0];
  const latest = values[values.length - 1];

  if (values.length === 1) {
    return {
      label,
      unit,
      sessions: 1,
      start: start.value,
      startDate: start.date,
      latest: latest.value,
      latestDate: latest.date,
      note: "only one measurement — no change or trend can be calculated",
    };
  }

  const previous = values[values.length - 2];
  const change = round(latest.value - start.value, 2);
  const fact: Fact = {
    label,
    unit,
    sessions: values.length,
    start: start.value,
    startDate: start.date,
    latest: latest.value,
    latestDate: latest.date,
    previous: previous.value,
    previousDate: previous.date,
    change,
    changePct: start.value !== 0 ? round((change / start.value) * 100, 1) : null,
    changeSincePrevious: round(latest.value - previous.value, 2),
  };

  if (values.length >= 3) {
    // Direction is only called a "trend" once there are enough points for one.
    let up = 0, down = 0;
    for (let i = 1; i < values.length; i++) {
      const d = values[i].value - values[i - 1].value;
      if (d > 0) up++;
      else if (d < 0) down++;
    }
    fact.trend = up > 0 && down > 0
      ? "fluctuating"
      : change > 0
      ? "consistently increasing"
      : change < 0
      ? "consistently decreasing"
      : "flat";
  } else {
    fact.trend = "two measurements only — simple change, not yet a trend";
  }

  return fact;
}

// US Navy circumference method (Hodgdon & Beckett), used only when the trainer
// did not record a measured body-fat percentage.
function usNavyBodyFat(
  sex: string | null,
  heightCm: number | null,
  neck: number | null,
  waist: number | null,
  hip: number | null,
): number | null {
  if (!sex || !heightCm || !neck || !waist) return null;
  let bf: number;
  if (sex === "male") {
    const g = waist - neck;
    if (g <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(g) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!hip) return null;
    const g = waist + hip - neck;
    if (g <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(g) + 0.221 * Math.log10(heightCm)) - 450;
  }
  if (!isFinite(bf) || bf <= 0 || bf > 70) return null;
  return round(bf, 1);
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/** "Progress at a glance" tile, built from facts so the UI never parses prose. */
function glanceTile(fact: Fact | null, lowerIsBetter: boolean | null) {
  if (!fact) return null;
  if (fact.change == null) {
    return {
      label: fact.label,
      unit: fact.unit,
      from: null,
      to: fact.latest,
      change: null,
      changePct: null,
      direction: "none",
      good: null,
      note: "Only one measurement — no change yet",
    };
  }
  const good = lowerIsBetter === null || fact.change === 0 ? null : lowerIsBetter ? fact.change < 0 : fact.change > 0;
  return {
    label: fact.label,
    unit: fact.unit,
    from: fact.start,
    to: fact.latest,
    change: fact.change,
    changePct: fact.changePct ?? null,
    direction: fact.change > 0 ? "increase" : fact.change < 0 ? "decrease" : "no change",
    good,
    note: null,
  };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ──────────────────────── provider runner ──────────────────────── */

interface RunResult {
  ok: boolean;
  report?: Record<string, unknown>;
  provider?: string;
  model?: string;
  fallbackUsed?: boolean;
  latencyMs?: number;
  attempts: { provider: string; model: string; error: string }[];
}

/**
 * Walks the provider chain once each, in order. The NEXT model is the retry —
 * a failing provider is never hammered. Any failure (429, 5xx, timeout,
 * malformed JSON, schema violation) simply moves to the next entry.
 */
async function runProviders(system: string, user: string): Promise<RunResult> {
  const attempts: RunResult["attempts"] = [];
  const started = Date.now();

  for (let i = 0; i < PROVIDERS.length; i++) {
    const p = PROVIDERS[i];
    const t0 = Date.now();
    try {
      const raw = p.kind === "openai" ? await callOpenAiCompatible(p, system, user) : await callGemini(p, system, user);

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Some models wrap JSON in prose or a code fence; salvage the object.
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("no JSON object in response");
        parsed = JSON.parse(m[0]);
      }

      if (!validateReport(parsed)) throw new Error("schema validation failed");

      return {
        ok: true,
        report: parsed as Record<string, unknown>,
        provider: p.provider,
        model: p.model,
        fallbackUsed: i > 0,
        latencyMs: Date.now() - started,
        attempts,
      };
    } catch (e) {
      // Model id + reason only. Keys are never logged.
      const msg = String(e instanceof Error ? e.message : e).slice(0, 300);
      console.error(`AI attempt failed [${p.provider}/${p.model}] after ${Date.now() - t0}ms: ${msg}`);
      attempts.push({ provider: p.provider, model: p.model, error: msg });
      if (i < PROVIDERS.length - 1) await sleep(BACKOFF_MS);
    }
  }

  return { ok: false, attempts };
}

async function callOpenAiCompatible(p: ProviderEntry, system: string, user: string): Promise<string> {
  const res = await fetch(p.url, {
    method: "POST",
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${p.key}`,
      "Content-Type": "application/json",
      ...(p.provider === "openrouter"
        ? { "HTTP-Referer": "https://gym-measurement-app-tyyq.vercel.app", "X-Title": "Goodlife Fitness" }
        : {}),
    },
    body: JSON.stringify({
      model: p.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "trainer_report", strict: true, schema: REPORT_SCHEMA },
      },
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const text = j?.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty completion");
  return text;
}

async function callGemini(p: ProviderEntry, system: string, user: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent?key=${p.key}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
          temperature: 0.4,
        },
      }),
    },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty completion");
  return text;
}

/* ──────────────────────────── prompts ──────────────────────────── */

const SYSTEM_PROMPT =
  `You are a senior fitness progress-analysis assistant supporting an experienced trainer.

Do not act as a generic motivational chatbot.
Use only the verified client data supplied to you.
Do not invent missing measurements.
Do not calculate unsupported facts — every number you cite must already appear in the data.
Identify meaningful patterns, inconsistencies, missing information, and practical next actions.
Your job is to help the trainer see what the raw measurements do not immediately reveal.

Never give medical diagnoses. Never claim certainty the data does not support.
Return only JSON matching the required schema. No markdown, no headings, no asterisks.`;

const LANGUAGE_RULE: Record<string, string> = {
  en:
    "Write in simple, plain English a busy gym trainer reads instantly. Short sentences. Explain any technical term in the same sentence in ordinary words.",
  mr:
    "Write in natural Marathi (Devanagari script), the way a Marathi-speaking gym trainer in Pune or Mumbai actually talks. Keep common gym/fitness terms in English (weight, body fat, muscle, BMI, waist, chest, protein, training, diet, reps, sets, cardio, measurement) — do not translate them into formal or academic Marathi. All numbers, units and dates stay in Western digits exactly as supplied.",
  mr_en:
    'Write in Marathi mixed with English, the way a Marathi-speaking gym trainer in Pune or Mumbai actually talks. Natural Marathi sentence structure in Devanagari, but keep common gym/fitness terms in English. Example of the right voice: "Weight कमी झाला आहे आणि waist measurement मध्ये पण चांगली improvement दिसत आहे." All numbers, units and dates stay in Western digits exactly as supplied.',
};

/* ──────────────────────────── handler ──────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  if (PROVIDERS.length === 0) {
    return jsonResponse(
      {
        success: false,
        error: "AI analysis is not configured yet. Ask an administrator to set GROQ_API_KEY, OPENROUTER_API_KEY or GEMINI_API_KEY.",
      },
      503,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ success: false, error: "Missing Authorization header" }, 401);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerErr } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (callerErr || !callerData?.user) return jsonResponse({ success: false, error: "Invalid or expired session" }, 401);
  const trainerId = callerData.user.id;

  let body: {
    client_id?: string;
    period?: string;
    goal?: string;
    target_body_fat?: number | null;
    language?: string;
    force?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { client_id, period, goal, target_body_fat, force } = body;
  const language = body.language === "mr_en" ? "mr_en" : body.language === "mr" ? "mr" : "en";

  if (!client_id || !period || !PERIOD_DAYS[period]) {
    return jsonResponse({ success: false, error: "Valid client_id and period are required" }, 400);
  }
  if (goal !== "gain_muscle" && goal !== "lose_fat") {
    return jsonResponse({ success: false, error: "goal must be 'gain_muscle' or 'lose_fat'" }, 400);
  }

  const { data: client, error: clientErr } = await adminClient
    .from("clients")
    .select("id, name, trainer_id, biological_sex, date_of_birth, height_cm, body_composition_method, goal_notes")
    .eq("id", client_id)
    .maybeSingle();
  if (clientErr || !client || client.trainer_id !== trainerId) {
    return jsonResponse({ success: false, error: "Client not found" }, 404);
  }

  const cutoff = new Date(Date.now() - PERIOD_DAYS[period] * 86400000).toISOString().slice(0, 10);
  const { data: measurements, error: mErr } = await adminClient
    .from("measurements")
    .select(
      "measured_on, weight, body_fat_percent, chest, waist, hips, neck, arm, thigh, shoulders, forearm, abdomen, gluteus, calf",
    )
    .eq("client_id", client_id)
    .gte("measured_on", cutoff)
    .order("measured_on", { ascending: true });
  if (mErr) return jsonResponse({ success: false, error: `Failed to load measurements: ${mErr.message}` }, 500);

  const heightCm = client.height_cm as number | null;
  const sex = client.biological_sex as string | null;

  /* ---------- Build VERIFIED_CLIENT_ANALYSIS. The app owns every number. ---------- */

  // Body fat per session: a trainer-entered value always wins over the estimate.
  let bodyFatSource: "measured" | "estimated" | "none" = "none";
  let bodyFatMethod: string | null = null;
  const fatSeries: { date: string; value: number }[] = [];

  for (const m of measurements ?? []) {
    if (m.body_fat_percent != null) {
      fatSeries.push({ date: m.measured_on, value: m.body_fat_percent });
      bodyFatSource = "measured";
      bodyFatMethod = client.body_composition_method === "manual_bia" ? "bioimpedance" : "entered by trainer";
    } else {
      // For men the Navy protocol measures at the navel = this app's "Abdomen".
      const waistForNavy = sex === "male" ? (m.abdomen ?? m.waist) : m.waist;
      const est = usNavyBodyFat(sex, heightCm, m.neck, waistForNavy, m.hips);
      if (est != null) {
        fatSeries.push({ date: m.measured_on, value: est });
        if (bodyFatSource === "none") {
          bodyFatSource = "estimated";
          bodyFatMethod = "US Navy";
        }
      }
    }
  }

  const weightFact = metricFact(
    "Weight",
    "kg",
    (measurements ?? []).filter((m) => m.weight != null).map((m) => ({ date: m.measured_on, value: m.weight })),
  );
  const fatFact = metricFact("Body Fat", "%", fatSeries);

  const perimeterFacts = PERIMETER_FIELDS.map((p) =>
    metricFact(
      p.label,
      "cm",
      (measurements ?? [])
        .filter((m: Record<string, any>) => m[p.key] != null)
        .map((m: Record<string, any>) => ({ date: m.measured_on, value: m[p.key] })),
    )
  ).filter((f): f is Fact => f !== null);

  const recordedPerimeters = new Set(perimeterFacts.map((f) => f.label));
  const missingPerimeters = PERIMETER_FIELDS.map((p) => p.label).filter((l) => !recordedPerimeters.has(l));

  let bmiFact: Fact | null = null;
  if (heightCm) {
    const h = heightCm / 100;
    bmiFact = metricFact(
      "BMI",
      "",
      (measurements ?? [])
        .filter((m) => m.weight != null)
        .map((m) => ({ date: m.measured_on, value: round(m.weight / (h * h), 1) })),
    );
  }

  const sessions = measurements?.length ?? 0;
  const firstDate = sessions > 0 ? measurements![0].measured_on : null;
  const lastDate = sessions > 0 ? measurements![sessions - 1].measured_on : null;

  const spanDays = firstDate && lastDate
    ? Math.round((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000)
    : 0;
  const avgGapDays = sessions > 1 ? Math.round(spanDays / (sessions - 1)) : null;

  const trendCapability = sessions === 0
    ? "none — no measurements in this period"
    : sessions === 1
    ? "single measurement — state values only, do NOT describe any change or trend"
    : sessions === 2
    ? "two measurements — simple change comparison only, do NOT call it a trend"
    : "multiple measurements — trend interpretation is supported";

  const goalProgress = target_body_fat != null && fatFact
    ? {
      targetBodyFat: target_body_fat,
      currentBodyFat: fatFact.latest,
      gap: round(Math.abs(fatFact.latest - target_body_fat), 1),
      aboveTarget: fatFact.latest > target_body_fat,
    }
    : null;

  const analysis = {
    client: {
      name: client.name,
      age: ageFrom(client.date_of_birth as string | null),
      biologicalSex: sex,
      heightCm,
      goal: goal === "gain_muscle" ? "Gain muscle" : "Lose fat",
      targetBodyFatPercent: target_body_fat ?? null,
      trainerNotes: (client.goal_notes as string | null) ?? null,
    },
    history: {
      period: PERIOD_LABEL[period],
      sessions,
      firstSession: firstDate ? fmtDate(firstDate) : null,
      latestSession: lastDate ? fmtDate(lastDate) : null,
      spanDays,
      averageDaysBetweenSessions: avgGapDays,
    },
    weight: weightFact,
    bodyFat: fatFact ? { ...fatFact, source: bodyFatSource, method: bodyFatMethod } : null,
    bmi: bmiFact,
    perimeters: perimeterFacts,
    // The gap to target must be supplied, not derived. A model asked to
    // subtract 18 from 19.1 produced "0.9" in testing.
    goalProgress,
    dataQuality: {
      sessions,
      trendCapability,
      bodyFatSource,
      bodyFatMethod,
      missingPerimeters,
      heightRecorded: heightCm != null,
      biologicalSexRecorded: sex != null,
      measurementCadence: avgGapDays == null
        ? "not enough sessions to judge cadence"
        : `roughly every ${avgGapDays} days`,
    },
  };

  /* ---------- Cache first: fingerprint every input, then look it up ---------- */

  const fingerprint = (await sha256Hex(
    JSON.stringify({
      v: REPORT_VERSION,
      client_id,
      period,
      goal,
      target: target_body_fat ?? null,
      language,
      analysis,
    }),
  )).slice(0, 48);

  if (!force) {
    const { data: cached } = await adminClient
      .from("ai_reports")
      .select("report, provider, model, created_at")
      .eq("client_id", client_id)
      .eq("cache_key", fingerprint)
      .maybeSingle();

    if (cached) {
      return jsonResponse({
        success: true,
        cached: true,
        report: {
          ...(cached.report as Record<string, unknown>),
          meta: {
            provider: cached.provider,
            model: cached.model,
            cacheHit: true,
            generatedAt: cached.created_at,
          },
        },
      });
    }
  }

  // Server-computed presentation values, attached after generation so no model
  // (or translation) can alter a number the trainer reads.
  const keyPerimeter = perimeterFacts
    .filter((p) => p.change != null)
    .sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!))[0] ?? perimeterFacts[0] ?? null;

  const glance = [
    glanceTile(weightFact, goal === "lose_fat" ? true : null),
    glanceTile(fatFact, true),
    glanceTile(keyPerimeter, goal === "lose_fat" ? true : null),
  ].filter((t) => t !== null);

  const serverFields = {
    language,
    reportVersion: REPORT_VERSION,
    periodLabel: PERIOD_LABEL[period],
    periodStart: firstDate ? fmtDate(firstDate) : null,
    periodEnd: lastDate ? fmtDate(lastDate) : null,
    sessions,
    glance,
    goalNumbers: goalProgress,
    bodyFatSource,
    bodyFatMethod,
  };

  // No measurements: answer without spending an AI call.
  if (sessions === 0) {
    const report = {
      ...serverFields,
      executive_summary: `No measurements were logged for ${client.name} in ${PERIOD_LABEL[period]}, so there is nothing to analyse for this period.`,
      progress_highlights: [],
      what_is_going_well: [],
      areas_to_watch: ["No measurement data exists in the selected period."],
      goal_progress: "Goal progress cannot be assessed without any measurements.",
      coaching_insights: ["Take a full baseline measurement so future sessions have something to compare against."],
      recommended_next_actions: [`Record a full measurement session for ${client.name}.`],
      next_measurement_focus: ["Weight, neck, waist and abdomen — the minimum needed for a body-fat estimate."],
      data_quality: "Insufficient — zero sessions in the selected period.",
      trainer_insight: "Nothing is being tracked in this window. A baseline is the first priority.",
      disclaimer: "This is fitness-progress analysis, not medical advice.",
      meta: { provider: null, model: null, cacheHit: false, fallbackUsed: false, latencyMs: 0 },
    };
    return jsonResponse({ success: true, cached: false, report });
  }

  /* ---------- Generate ---------- */

  const userPrompt = `${LANGUAGE_RULE[language]}

Analyse this client and return the report JSON.

Rules for this data set:
- Trend capability: ${trendCapability}.
- Body fat is ${bodyFatSource}${bodyFatMethod ? ` (${bodyFatMethod})` : ""}. ${
    bodyFatSource === "estimated"
      ? "Say once that it is a tape-measurement estimate, not a scan or lab measurement. Never present it as exact."
      : ""
  }
- Only discuss metrics present below. A metric carrying "note" has one data point — say a trend cannot be read for it.
- Cite real numbers and dates from the data (e.g. "88 kg on 20 Jun 2026 to 84.5 kg on 16 Sep 2026").
- NEVER do arithmetic. Every difference, percentage and gap you need is already a field in the data (change, changePct, changeSincePrevious, goalProgress.gap, spanDays). Quote those fields verbatim. Do not subtract, add or average anything yourself.
- areas_to_watch: report only real gaps such as missing perimeters, thin history or conflicting directions. Do not manufacture problems.
- recommended_next_actions: 2 to 5 concrete actions grounded in these numbers. Never generic advice like "eat healthy" or "stay motivated".
- coaching_insights is the most valuable section: surface patterns the raw numbers do not show at a glance.

VERIFIED_CLIENT_ANALYSIS:
${JSON.stringify(analysis)}`;

  const run = await runProviders(SYSTEM_PROMPT, userPrompt);

  if (!run.ok) {
    console.error(`All ${PROVIDERS.length} provider attempts failed`, JSON.stringify(run.attempts));
    return jsonResponse(
      {
        success: false,
        error: "The AI service is temporarily unavailable. Please try again in a moment.",
      },
      503,
    );
  }

  const report = {
    ...run.report,
    ...serverFields,
    meta: {
      provider: run.provider,
      model: run.model,
      cacheHit: false,
      fallbackUsed: run.fallbackUsed,
      latencyMs: run.latencyMs,
    },
  };

  // Upsert so an explicit Regenerate replaces the row for the same fingerprint.
  // ponytail: no distributed lock — the fingerprint + unique index make a
  // duplicate concurrent generation idempotent rather than corrupting state.
  const { error: cacheErr } = await adminClient.from("ai_reports").upsert({
    client_id,
    trainer_id: trainerId,
    period,
    goal,
    target_body_fat: target_body_fat ?? null,
    cache_key: fingerprint,
    report,
    provider: run.provider,
    model: run.model,
    report_version: REPORT_VERSION,
    language,
    fallback_used: run.fallbackUsed,
    latency_ms: run.latencyMs,
  }, { onConflict: "client_id,cache_key" });

  if (cacheErr) console.error("Failed to cache report:", cacheErr.message);

  return jsonResponse({ success: true, cached: false, report });
});
