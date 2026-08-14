export interface TrainerProfile {
  id: string;
  full_name: string;
  phone?: string | null;
  unit_preference: 'metric' | 'imperial';
  created_at?: string;
}

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
  weight?: number | null;
  body_fat_percent?: number | null;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  neck?: number | null;
  arm?: number | null;
  thigh?: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface ProgressPhoto {
  id?: string;
  client_id: string;
  trainer_id: string;
  taken_on: string; // date YYYY-MM-DD
  angle: 'front' | 'side' | 'back';
  storage_path: string;
  created_at?: string;
  signed_url?: string | null;
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
