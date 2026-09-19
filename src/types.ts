export interface TrainerProfile {
  id: string;
  full_name: string;
  phone?: string | null;
  unit_preference: 'metric' | 'imperial';
  role: 'trainer' | 'admin';
  is_active: boolean;
  created_at?: string;
}

export type PhotoAngle = 'front' | 'back' | 'right_side' | 'left_side' | 'side';

export interface ProgressPhoto {
  id?: string;
  client_id: string;
  trainer_id: string;
  taken_on: string; // date YYYY-MM-DD (legacy, kept for compatibility)
  taken_at?: string; // full timestamp (ISO), editable
  angle: PhotoAngle; // 'side' is a legacy value from before the 4-angle system
  storage_path: string;
  created_at?: string;
  signed_url?: string | null;
}

export type BiologicalSex = 'male' | 'female';

export type BodyCompositionMethod =
  | 'automatic'
  | 'us_navy'
  | 'manual_bia'
  | 'jp3'
  | 'jp4'
  | 'jp7';

export interface Client {
  id: string;
  trainer_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  starting_weight?: number | null;
  goal_notes?: string | null;
  profile_photo_path?: string | null;
  created_at?: string;
  updated_at?: string;
  // StartFit-style profile configuration
  biological_sex?: BiologicalSex | null;
  date_of_birth?: string | null; // date YYYY-MM-DD
  height_cm?: number | null;
  unit_system: 'metric' | 'imperial';
  body_composition_method?: BodyCompositionMethod | null;
  selected_perimeters: string[]; // PerimeterId[]
  // Computed fields
  last_checkin_date?: string | null;
  last_measurement_days_ago?: number | null;
  weight_change?: number | null;
  current_weight?: number | null;
  needs_update?: boolean;
}

export interface Measurement {
  id?: string;
  client_id: string;
  trainer_id: string;
  measured_on: string; // date YYYY-MM-DD
  unit: 'metric' | 'imperial';
  session_name?: string | null;
  weight?: number | null;
  body_fat_percent?: number | null;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  neck?: number | null;
  arm?: number | null; // Biceps
  thigh?: number | null;
  shoulders?: number | null;
  forearm?: number | null;
  abdomen?: number | null;
  gluteus?: number | null;
  calf?: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface CustomMeasure {
  id: string;
  trainer_id: string;
  name: string;
  measure_type: 'perimeter' | 'fold';
  unit: string;
  created_at?: string;
}

export interface CustomMeasureValue {
  id?: string;
  measurement_id: string;
  custom_measure_id: string;
  trainer_id: string;
  value: number;
}

export type AiReportPeriod = '2w' | '1m' | '3m' | '6m';
export type AiReportGoal = 'gain_muscle' | 'lose_fat';
export type AiReportLanguage = 'en' | 'mr' | 'mr_en';

/**
 * One "Progress at a glance" tile. Computed server-side from real measurements
 * and returned alongside the model's prose, so the numbers shown can never be
 * altered by generation or translation.
 */
export interface AiGlanceTile {
  label: string;
  unit: string;
  from: number | null;
  to: number;
  change: number | null;
  changePct: number | null;
  direction: 'increase' | 'decrease' | 'no change' | 'none';
  good: boolean | null;
  note: string | null;
}

export interface AiGoalProgress {
  targetBodyFat: number;
  currentBodyFat: number;
  gap: number;
  aboveTarget: boolean;
}

/** Provider trace. Internal/debug only — not shown in the trainer UI. */
export interface AiReportMeta {
  provider: string | null;
  model: string | null;
  cacheHit: boolean;
  fallbackUsed?: boolean;
  latencyMs?: number;
  generatedAt?: string;
}

/**
 * The canonical AI report contract.
 *
 * Field names match the Edge Function response exactly (snake_case for the
 * model-written prose, camelCase for server-computed values) so there is one
 * shape, not a client-side rename layer that can drift. Cached and fresh
 * responses return this identical shape.
 *
 * Always build one via `normalizeAiReport()` — never trust a raw response.
 */
export interface AiReport {
  // Model-written prose (11 required sections).
  executive_summary: string;
  progress_highlights: string[];
  what_is_going_well: string[];
  areas_to_watch: string[];
  goal_progress: string;
  coaching_insights: string[];
  recommended_next_actions: string[];
  next_measurement_focus: string[];
  data_quality: string;
  trainer_insight: string;
  disclaimer: string;

  // Server-computed — never produced or altered by a model.
  glance: AiGlanceTile[];
  goalNumbers: AiGoalProgress | null;
  language: AiReportLanguage;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  sessions: number;
  bodyFatSource: 'measured' | 'estimated' | 'none';
  bodyFatMethod: string | null;
  meta: AiReportMeta;
}

export type ActiveScreen =
  | 'dashboard'
  | 'client_list'
  | 'client_profile'
  | 'add_measurement'
  | 'measurement_progress'
  | 'share_report'
  | 'add_client'
  | 'settings';
