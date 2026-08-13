export interface TrainerProfile {
  id: string;
  full_name: string;
  phone?: string | null;
  default_unit: 'metric' | 'imperial';
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
  avatar_url?: string | null;
  created_at?: string;
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
  measured_at?: string;
  date?: string;
  weight?: number | null;
  body_fat_percent?: number | null;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  neck?: number | null;
  arm?: number | null;
  thigh?: number | null;
  notes?: string | null;
  unit?: 'metric' | 'imperial';
  created_at?: string;
}

export interface ProgressPhoto {
  id?: string;
  client_id: string;
  trainer_id: string;
  storage_path: string;
  photo_url?: string | null;
  signed_url?: string | null;
  tag: string; // 'Anterior (Front)', 'Lateral (Side)', 'Posterior (Back)', 'front', etc.
  taken_at?: string;
  created_at?: string;
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
