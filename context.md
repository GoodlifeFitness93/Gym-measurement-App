# Goodlife Fitness — Developer Context

> **Updated**: 2026-09-17 | **Source**: Full repository + live Supabase project inspection during the StartFit-style measurement workflow upgrade.
> This document is for AI coding agents (Claude Code, etc.) to understand the codebase before making changes.

**2026-09-17 upgrade summary**: black/orange theme (was teal/white "clinical"), a 7-step StartFit-style client creation wizard, configurable perimeters (11 body measurements) with an interactive male/female anatomy diagram and an 11-illustration Instructions modal, trainer-scoped custom measures (perimeter/fold), measurement session naming, and a fix for the Before/After photo slider that previously cropped uploaded photos. Body-composition **calculation** (US Navy, Jackson-Pollock, etc.) is intentionally **not implemented** — only the method *selection* is stored.

---

## 1. Project Overview

**Application Name**: Goodlife Fitness (formerly branded "FitTrack Pro" — that branding has been fully removed).
**Purpose**: A client management tool for personal trainers / fitness coaches at Goodlife Fitness. Trainers log in, manage clients, record body measurements over time, upload progress photos (4 angles), view measurement trends, and share progress reports via WhatsApp or clipboard. Admins manage trainer accounts (activate/deactivate).

**Current State**: Fully client-side React SPA (no server-side rendering) that connects directly to Supabase for authentication, database, and file storage, plus **one Supabase Edge Function** (`admin-manage-trainer`) for privileged admin operations. No other backend server.

---

## 2. Current Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | React | 19.0.1 |
| **Language** | TypeScript | ~5.8.2 |
| **Build Tool** | Vite | ^6.2.3 |
| **Styling** | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) | ^4.1.14 |
| **Backend/DB** | Supabase (Auth, PostgreSQL, Storage, Edge Functions) | `@supabase/supabase-js` ^2.112.3 |
| **ZIP generation** | `jszip` (Download All Photos) | ^3.10.1 |
| **Icons** | Google Material Symbols Outlined (CDN font, pre-existing screens) **+** `lucide-react` (all screens/components added in the 2026-09-17 upgrade) | — / ^0.546.0 |
| **Typography** | Inter (Google Fonts CDN) | — |

### Dependencies Removed (were unused)
`@google/genai`, `express`, `dotenv`, `@types/express` were declared in `package.json` but had zero imports anywhere in `src/`. They have been removed. `motion` remains installed but unused. `lucide-react` is now used (see above) — do not add another icon library.

### Two icon systems, intentionally
Pre-existing screens (`Header`, `BottomNav`, `Dashboard`, `AuthScreen`, `ClientList`, `SettingsScreen`, `AdminDashboard`, `ShareReportModal`) still use the Material Symbols font (`<span className="material-symbols-outlined">`). New components from the 2026-09-17 upgrade (`NewClientWizard`, `PerimeterInstructionsModal`, `AnatomyDiagram`, `ClientSettingsTab`, and the new parts of `AddMeasurementModal`) use `lucide-react` per that phase's spec. This was a deliberate scope cut — do not do a mechanical icon-library migration across the whole app without being asked; it's cosmetic and carries regression risk.

---

## 3. Architecture

### High-Level Flow

```
User (Browser)
  → App.tsx (root component, auth gating, role routing, navigation)
    → Trainer screens (Dashboard, ClientList, ClientProfile, etc.)
    → Admin screen (components/admin/AdminDashboard.tsx)
      → getSupabase() from lib/supabase.ts
        → Supabase Client (Auth, DB queries, Storage, Edge Function invoke)
          → Supabase-hosted PostgreSQL + Storage + Edge Functions
```

### Architecture Pattern
- **No router library** — navigation is state-driven via `activeScreen` state in `App.tsx` for the trainer app. The admin app is a separate top-level render branch (not part of `activeScreen`/`screenHistory`) gated purely by `trainerProfile.role`.
- **No global state management** — all state is React `useState` in individual components.
- **No service layer abstraction** — components call `getSupabase()` directly and make queries inline, except privileged trainer-account operations which go through the `admin-manage-trainer` Edge Function.
- **Single-file Supabase module** — `src/lib/supabase.ts` handles client initialization and env validation only (no more runtime credential override).

### Rendering Pipeline (in App.tsx)
1. **Not configured** (missing/invalid env vars) → minimal developer-facing "Configuration Error" screen. There is **no end-user credential entry form** anymore.
2. **Auth loading** → Loading spinner
3. **Not authenticated** → `AuthScreen` (login/signup)
4. **Trainer profile loading** → Loading spinner (avoids a flash of the wrong screen while role is resolved)
5. **`is_active === false`** → "Account Inactive" screen (message + sign out only)
6. **`role === 'admin'`** → `AdminDashboard` (trainer account management)
7. **`role === 'trainer'`** → Main trainer app shell (Header + active screen + BottomNav)

---

## 4. Project Structure

```
Gym-measurement-App/
├── index.html              → HTML entry, loads fonts, favicon, sets body classes
├── package.json            → Dependencies, scripts
├── vite.config.ts          → Vite + React + Tailwind v4 plugin config
├── tsconfig.json           → TypeScript config (bundler resolution, no emit)
├── metadata.json           → AI Studio project metadata (not app config)
├── .env.example            → Template for required env vars (Supabase URL/key only)
├── .env                    → Local dev credentials (gitignored, never committed)
├── .gitignore              → Standard ignores (.env*, node_modules, dist)
├── assets/
│   ├── icon.svg            → App icon/favicon (isolated so it can be swapped for a real logo later)
│   └── anatomy/
│       ├── male-front.svg, male-back.svg, female-front.svg, female-back.svg → interactive body diagrams
│       └── perimeter-instructions/  → 11 files (neck/shoulders/chest/biceps/forearm/waist/abdomen/hip/gluteus/thigh/calf.svg)
├── bun.lock / package-lock.json → Lock files
│
└── src/
    ├── main.tsx            → React root mount + env var validation logging
    ├── App.tsx             → Root component: auth gating, role routing, navigation state, screen routing
    ├── types.ts            → All TypeScript interfaces (Client, Measurement, TrainerProfile, ProgressPhoto, CustomMeasure, etc.)
    ├── index.css            → Tailwind import, `@theme` block (black/orange design tokens), custom utility classes
    ├── vite-env.d.ts        → Vite env type declarations
    │
    ├── lib/
    │   ├── supabase.ts     → Supabase client init + env validation (no credential override mechanism)
    │   ├── perimeters.ts   → Canonical 11-perimeter config (id/label/dbColumn) — single source of truth
    │   ├── bodyComposition.ts → Body-composition method options + `CALCULATION_DEFERRED` flag
    │   └── units.ts         → cm↔in / ft-in↔cm conversion helpers (canonical storage stays cm)
    │
    └── components/
        ├── AuthScreen.tsx           → Login / Sign-up form (trainer-only signup; friendly message for deactivated accounts)
        ├── Header.tsx               → Top navigation bar (desktop + mobile), trainer app only
        ├── BottomNav.tsx            → Mobile bottom tab bar, trainer app only
        ├── Dashboard.tsx            → Trainer "command center": quick actions, needs-attention list, recent activity
        ├── ClientList.tsx           → Searchable/filterable client directory
        ├── ClientProfile.tsx        → Client detail (Overview, Measurements, Photos, Notes, **Settings** tabs)
        ├── ClientSettingsTab.tsx    → Client Settings tab content: Profile edit + delete, Measurement Sessions, Fat Method, Perimeters, Custom Measures, Unit System
        ├── AddMeasurementModal.tsx  → Measurement entry: core metrics + gated Perimeters section (Instructions modal, anatomy diagram, cm/in toggle) + custom fold measures
        ├── PerimeterInstructionsModal.tsx → 11-illustration "how to measure" modal, opened from the Perimeters section
        ├── AnatomyDiagram.tsx       → Reusable male/female front/back body diagram with clickable hotspots that focus the matching perimeter input
        ├── MeasurementProgress.tsx  → Real, data-driven measurement trend charts + logs (primary bento metrics + secondary perimeter dropdown)
        ├── ShareReportModal.tsx     → Progress report preview + WhatsApp/copy sharing
        ├── SettingsScreen.tsx       → Trainer profile + preferences + logout (trainer-level, not the per-client Settings tab)
        ├── wizard/
        │   └── NewClientWizard.tsx  → 7-step client creation flow (Name → Biological Sex → Body Composition Method → Select Perimeters → Unit System → Height → Date of Birth)
        └── admin/
            └── AdminDashboard.tsx   → Admin-only: trainer list, activate/deactivate with confirmation
```

`src/components/SupabaseNotConfigured.tsx` and `src/components/AddClientModal.tsx` have both been **removed** — there is no public credential-entry screen, and client creation now goes through `wizard/NewClientWizard.tsx`.

---

## 5. Important Files

### `src/App.tsx`
- Root component. Controls entire app lifecycle: env check → auth check → trainer profile fetch → role/active-state gate → screen routing.
- Determines whether to render the trainer app, the `AdminDashboard`, or the "Account Inactive" screen based on `trainerProfile.role` / `trainerProfile.is_active`, both of which come from the database (never trusted from the client).
- **Caution**: Changing navigation logic, auth flow, or prop shapes here affects every screen. The `screenHistory` array and `handleBack()` function contain hardcoded navigation rules for sub-screens (unchanged from before).

### `src/lib/supabase.ts`
- Singleton Supabase client factory with straightforward env validation (`isSupabaseConfigured()`, `getSupabase()`).
- **No more `localStorage` override mechanism.** Credentials come only from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, set at build time.
- The client is cached in a module-level variable (`cachedClient`).

### `src/types.ts`
- `TrainerProfile` now includes `role: 'trainer' | 'admin'` and `is_active: boolean`.
- `ProgressPhoto.angle` is now `'front' | 'back' | 'right_side' | 'left_side' | 'side'` (`'side'` is a **legacy** value preserved for photos uploaded before the 4-angle system; never written by new uploads). `ProgressPhoto.taken_at` is the full editable timestamp; `taken_on` (date-only) is kept for backward compatibility.

### `src/components/ClientProfile.tsx`
- Largest component. Five tabs: Overview (real data-driven weight chart), Measurements (history list, now including the 5 additional perimeter columns), Photos (4-angle gallery + before/after), Notes, **Settings** (renders `ClientSettingsTab`).
- Photo upload: 4 explicit buttons (Front/Back/Right Side/Left Side) — the angle is fixed by which button was clicked, never typed. Each upload opens a small modal (now `max-h-[90vh] overflow-y-auto` — it used to be possible for the submit button to render below a short viewport, unreachable) with a file preview and an editable `datetime-local` input defaulting to "now".
- Before/After: explicit `<select>` pickers (not just first/last photo), with a warning if the two photos are different angles. The comparison slider is a native `<input type="range">` — draggable, touch-friendly, and keyboard-accessible by default, with a visible `aria-label` and percentage readout.
- **Before/After complete-image fix (2026-09-17)**: both the Before and After `<img>` now render `absolute inset-0 w-full h-full object-contain` inside a `bg-ink` letterboxed container (was `object-cover object-top`, which cropped any photo not matching a fixed aspect ratio). The "Before" image is revealed via `clip-path: inset(0 X% 0 0)` applied directly to the image itself, not a shrinking wrapper div — the old wrapper-clip approach also had a width-mismatch bug (a hardcoded `w-[500px]` Before image inside a wrapper narrower than 500px on small screens), which this fix removes as a side effect. If touching this again: never reintroduce `object-cover` here, and never give the two compared images different base sizing.
- Download All Photos: builds a ZIP client-side via `jszip`, organized `Client_Name/YYYY-MM-DD/Angle_HHmm.ext`, continues on individual photo fetch failures and reports which ones failed.

### `src/components/wizard/NewClientWizard.tsx`
- 7-step flow, single file with a `STEPS` array + switch (not one file per step). Inserts directly into `clients` on Finish with the extended schema (see §9). Step 4 (perimeters) defaults to all 11 selected. Step 5 (unit system) converts an already-entered height value live when switching metric/imperial so nothing silently gets reinterpreted.
- Only collects the 7 spec'd fields. Phone/email/starting weight are edited afterward via `ClientSettingsTab`'s Profile section, not during the wizard.

### `src/components/AddMeasurementModal.tsx`
- Core Metrics (weight/body fat) unchanged. Perimeters section renders only the client's `selected_perimeters` + any trainer custom measures of type `perimeter`, gated by `client.selected_perimeters` (an array on the `clients` row, editable in `ClientSettingsTab`).
- cm/in toggle: **converts already-entered values** when switched (see `handlePerimeterUnitChange`) — do not remove this; a naive unit-label swap without conversion would silently reinterpret a trainer's typed numbers under a different unit.
- Renders `<AnatomyDiagram>` (collapsible) — clicking a hotspot calls `onHotspotClick` which focuses + scrolls to the matching perimeter `<input>` via a `ref` map keyed by `PerimeterId`.
- "Instructions" button opens `<PerimeterInstructionsModal>` — does not lose any already-entered form values (it's a sibling overlay, not a re-render of the form).
- Custom fold-type measures render in a separate "Custom Folds" card below Perimeters.
- On submit: inserts into `measurements` (now including `session_name` and the 5 additional perimeter columns), then a second insert into `custom_measure_values` for any filled custom measure.

### `src/components/ClientSettingsTab.tsx`
- Profile (name/phone/email/sex/height/DOB/starting weight, Save Changes, Delete Client with a confirm dialog), Measurement Sessions (lists `measurements`, editable `session_name` per row, "Initial"/"Current" badges computed from date order — not stored), Fat Method (`clients.body_composition_method`), Perimeters (`clients.selected_perimeters` checkboxes), Custom Measures (CRUD on `custom_measures`, trainer-scoped), Unit System (`clients.unit_system`).
- **Delete Client**: deletes `progress_photos` storage objects, then `progress_photos`/`measurements`/`clients` rows in that order (all client-scoped app-level deletes — this is not relying on DB cascade for the `clients→measurements/progress_photos` FKs, since cascade behavior on those pre-existing FKs was never confirmed).

### `src/components/admin/AdminDashboard.tsx`
- Admin-only screen. Fetches the trainer list (with emails) via the `admin-manage-trainer` Edge Function's `list` action (emails live in `auth.users`, which the browser client cannot query directly).
- Activate/deactivate trainers via the same Edge Function, with a confirmation dialog. Never offers "Deactivate" for the logged-in admin's own row (server-side also rejects self-deactivation).

### `src/components/Dashboard.tsx`
- Trainer home screen, redesigned as a "command center": Quick Actions (New Client / Add Measurement / Add Photo / View Clients), summary stats, a "Needs Update" list (>14 days since last measurement, or none logged), and a "Recent Activity" feed merging recent clients/measurements/photos.

---

## 6. Application Routes / Pages

No URL-based router. Navigation is controlled by `activeScreen` state in `App.tsx` for the trainer app. The admin app (`AdminDashboard`) is a separate top-level branch, not part of this screen list.

| Screen Key | Component | Purpose |
|---|---|---|
| `dashboard` | `Dashboard` | Trainer home / command center |
| `client_list` | `ClientList` | Searchable client directory |
| `client_profile` | `ClientProfile` | Client detail (tabs: overview, measurements, photos, notes) |
| `add_measurement` | `AddMeasurementModal` | Log new measurement for selected client |
| `measurement_progress` | `MeasurementProgress` | Measurement trend chart for selected client |
| `share_report` | `ShareReportModal` | Preview and share progress report |
| `add_client` | `wizard/NewClientWizard` | 7-step new client creation flow |
| `settings` | `SettingsScreen` | Trainer profile, preferences, logout |

---

## 7. Major User Flows

### 7.1 Authentication & Role Routing
1. `App.tsx` calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange`.
2. If no session → `AuthScreen`. Sign-up always creates a `role='trainer'` profile (enforced by the `handle_new_trainer()` DB trigger — the client never sends a role). There is no public "register as admin" path.
3. If a trainer account has been deactivated, Supabase Auth rejects sign-in (banned user) and `AuthScreen` shows: *"Your Goodlife Fitness trainer account is currently inactive. Please contact the administrator."*
4. On successful auth → `App.tsx` fetches the `trainer_profiles` row and routes based on `role`/`is_active` (see Rendering Pipeline above).

### 7.2 Admin: Trainer Management
1. Admin signs in → routed straight to `AdminDashboard`.
2. Dashboard calls the `admin-manage-trainer` Edge Function with `{action: 'list'}` to fetch all trainers + their emails.
3. Deactivate/Activate → confirmation dialog → Edge Function call with `{action, trainer_id}` → Edge Function verifies caller is an active admin, rejects self-targeting, calls `supabase.auth.admin.updateUserById` (ban/unban) and updates `trainer_profiles.is_active`, all server-side with the service-role key (never exposed to the browser).

### 7.3 Client Management (unchanged)
1. **Create**: `AddClientModal` → inserts into `clients` table with `trainer_id = user.id` → navigates to `client_profile`.
2. **List**: `ClientList` → fetches `clients` + `measurements`, computes weight change and needs-update status.
3. **View**: `ClientProfile` → fetches measurements + progress photos, generates signed URLs for photos.

### 7.4 Measurement Entry (unchanged)
Form with unit toggle, date, weight, body fat, chest, waist, hips, neck, arm, thigh, notes → inserts into `measurements`.

### 7.5 Progress Photo Upload (4-angle system)
1. From `ClientProfile` photos tab, trainer clicks one of 4 angle buttons (Front/Back/Right Side/Left Side).
2. Native file picker opens; on file selection, a modal shows a preview and an editable `datetime-local` field (defaults to now).
3. Upload to Supabase Storage bucket `progress-photos` at path `{userId}/{clientId}/{timestamp}-{angle}.{ext}` (angle is one of `front`/`back`/`right_side`/`left_side`).
4. Insert record in `progress_photos` with `angle`, `taken_at` (full timestamp), `taken_on` (derived Asia/Kolkata date).

### 7.6 Before/After Comparison & Download All
- Trainer picks a Before and an After photo from `<select>` dropdowns (defaults: earliest photo / most recently uploaded photo). A native range-input slider compares them; a warning appears if the angles differ.
- "Download All Photos" builds a ZIP client-side (see `ClientProfile.tsx` notes above).

### 7.7 Share Progress Report (unchanged)
Plain-text summary comparing first/latest measurements, shared via WhatsApp deep link or clipboard. Footer branding now reads "Goodlife Fitness".

### 7.8 Settings / Logout
Trainer profile edit (name, phone, unit preference) → upsert to `trainer_profiles`. The previous "Supabase Connection" card (which displayed the masked key/URL) has been **removed** — no credentials are ever shown in the UI.

---

## 8. Data Flow

Unchanged from before for measurements/clients. Photo flow now includes the angle + timestamp handling described in 7.5–7.6. Admin trainer-list flow is described in 7.2.

---

## 9. Supabase & Database Architecture

### Client Initialization
- **File**: `src/lib/supabase.ts` — `getSupabase()` validates env vars, creates/caches a `SupabaseClient`.
- **Auth config**: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`.
- **No runtime credential override** — removed entirely.

### Environment Variables Required
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public API key

Both are safe to expose in the browser by design (public/anon key, not the service-role key). The service-role key is **only** used inside the `admin-manage-trainer` Edge Function via its auto-injected `SUPABASE_SERVICE_ROLE_KEY` environment variable — it is never a `VITE_*` variable and never reaches the frontend bundle.

### Tables

#### `trainer_profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, FK → `auth.users.id` |
| `full_name` | text | |
| `phone` | text, nullable | |
| `unit_preference` | text | `'metric'` \| `'imperial'`, default `'metric'` |
| `role` | text | `'trainer'` \| `'admin'`, default `'trainer'` — **new** |
| `is_active` | boolean | default `true` — **new** |
| `created_at` | timestamptz | default `now()` |

A trigger `on_auth_user_created` → `handle_new_trainer()` (SECURITY DEFINER, `search_path` pinned to `public`) auto-inserts a `trainer_profiles` row with `role='trainer', is_active=true` on every new `auth.users` signup.

#### `clients` — extended 2026-09-17
| Column | Type | Notes |
|---|---|---|
| `id`, `trainer_id`, `name`, `phone`, `email`, `starting_weight`, `goal_notes`, `profile_photo_path`, `created_at`, `updated_at` | — | unchanged |
| `biological_sex` | text, nullable | `'male'` \| `'female'` — **new**, drives which `AnatomyDiagram` renders |
| `date_of_birth` | date, nullable | **new** |
| `height_cm` | numeric, nullable | **new** — canonical cm; converted for display only |
| `unit_system` | text | `'metric'` \| `'imperial'`, default `'metric'` — **new**, per-client (separate from `trainer_profiles.unit_preference`, which is still unused elsewhere — see §18) |
| `body_composition_method` | text, nullable | `'automatic'` \| `'us_navy'` \| `'manual_bia'` \| `'jp3'` \| `'jp4'` \| `'jp7'` — **new**, selection only, no calculation engine |
| `selected_perimeters` | text[] | **new**, default = all 11 canonical ids from `src/lib/perimeters.ts`; drives which fields render in the Perimeters section |

#### `measurements` — extended 2026-09-17
| Column | Type | Notes |
|---|---|---|
| `id`, `client_id`, `trainer_id`, `measured_on`, `unit`, `weight`, `body_fat_percent`, `chest`, `waist`, `hips`, `neck`, `arm`, `thigh`, `notes`, `created_at` | — | unchanged. `arm` is displayed as **"Biceps"**, `hips` as **"Hip"** in the new perimeter UI — column names were NOT renamed, only relabeled in the frontend, so old data/queries keep working |
| `shoulders`, `forearm`, `abdomen`, `gluteus`, `calf` | numeric, nullable | **new** — the 5 perimeters not already covered by the original 6 columns |
| `session_name` | text, nullable | **new** — trainer-editable label ("Initial", "Week 4", "Current"); "Initial"/"Current" badges shown in `ClientSettingsTab` are *computed* from earliest/latest date, not stored |

#### `custom_measures` — new table 2026-09-17
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `trainer_id` | uuid | FK → `auth.users.id`, `ON DELETE CASCADE` |
| `name` | text | trainer-defined label |
| `measure_type` | text | `'perimeter'` \| `'fold'` |
| `unit` | text | default `'cm'`, free text |
| `created_at` | timestamptz | default `now()` |

Trainer-scoped (not per-client) — matches every other table's flat `trainer_id` RLS pattern, and lets a trainer define a custom measure once and reuse it across all their clients.

#### `custom_measure_values` — new table 2026-09-17
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `measurement_id` | uuid | FK → `measurements.id`, `ON DELETE CASCADE` |
| `custom_measure_id` | uuid | FK → `custom_measures.id`, `ON DELETE CASCADE` |
| `trainer_id` | uuid | FK → `auth.users.id`, `ON DELETE CASCADE` — denormalized for flat RLS, same pattern as every other table |
| `value` | numeric | |
| `created_at` | timestamptz | default `now()` |

#### `progress_photos`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid | FK → `clients.id` |
| `trainer_id` | uuid | FK → `auth.users.id` |
| `taken_on` | date | Legacy date-only field, kept for compatibility |
| `taken_at` | timestamptz | **New** — full editable timestamp, default `now()` |
| `angle` | text | `'front'` \| `'back'` \| `'right_side'` \| `'left_side'` \| `'side'` (legacy) |
| `storage_path` | text | Path in Supabase Storage |
| `created_at` | timestamptz | default `now()` |

### Row Level Security — VERIFIED (previous "not verified" note in this doc was overly cautious)
RLS is enabled and correctly configured on all 4 tables:
- `clients`, `measurements`, `progress_photos`: `ALL` policy `USING/WITH CHECK (auth.uid() = trainer_id)` — each trainer only sees their own data.
- `trainer_profiles`: `SELECT`/`UPDATE` policies scoped to `auth.uid() = id` (own profile), **plus** a `SELECT` policy for admins using a `SECURITY DEFINER` helper function `public.is_active_admin(uid)` that lets active admins see every trainer's profile. This helper function pattern is required — a naive self-referencing policy (`EXISTS (SELECT 1 FROM trainer_profiles WHERE ...)` inside its own USING clause) causes **infinite recursion / 500 errors** in PostgREST. Do not write admin RLS policies that query the same table directly in their own USING clause; always route through a `SECURITY DEFINER` helper.
- Storage (`storage.objects`, bucket `progress-photos`, private): policies scope `SELECT`/`INSERT`/`DELETE` to `(storage.foldername(name))[1] = auth.uid()::text` — trainers can only read/write their own folder. **Direct SQL `DELETE` on `storage.objects` is blocked by a Supabase trigger** (`storage.protect_delete()`) — always delete storage objects via the Storage API (`supabase.storage.from(...).remove(...)`), never via `execute_sql`.
- `custom_measures`, `custom_measure_values`: flat `ALL` policy `USING/WITH CHECK (auth.uid() = trainer_id)`, identical pattern to `clients`/`measurements`/`progress_photos`.

### Supabase Storage
- **Bucket**: `progress-photos` (private)
- **Path format**: `{trainer_user_id}/{client_id}/{timestamp}-{angle}.{ext}`
- **Signed URLs**: 1-hour expiry (`3600` seconds), regenerated on every `ClientProfile` load.

### Edge Functions
#### `admin-manage-trainer`
- Deployed with `verify_jwt: true`.
- Actions: `list` (returns all trainer profiles + emails, admin-only), `activate` / `deactivate` (`{trainer_id}`, admin-only, rejects self-targeting, calls `auth.admin.updateUserById` to ban/unban and updates `trainer_profiles.is_active`).
- Uses the auto-injected `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars — these are Supabase-managed secrets, never configured or exposed via the frontend.

### Migrations
Tracked from 2026-09-16 onward via Supabase's `apply_migration` (no `supabase/` CLI folder in this repo — the live project's migration history is the system of record). Prior schema (before this upgrade) was applied by hand with no migration history.

---

## 10. Environment Variables

| Variable | Purpose | Required? | Used By |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes | `src/lib/supabase.ts`, `src/main.tsx` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public API key | Yes | `src/lib/supabase.ts`, `src/main.tsx` |

`GEMINI_API_KEY` and `APP_URL` (AI-Studio artifacts, confirmed unused in source) have been removed from `.env.example`.

### Startup Validation Behavior
1. `src/main.tsx` logs env var presence/validity to console (diagnostic only).
2. `src/lib/supabase.ts` → `validateSupabaseConfig()` checks the URL scheme and a minimum key length.
3. `src/App.tsx` → if invalid, renders a minimal developer-facing error screen. **There is no end-user credential entry UI.**

---

## 11. Authentication & Authorization

### Auth Provider
Supabase Auth, email + password, for both trainers and admins (no separate admin auth system, no second password).

### Role Model
- `trainer_profiles.role`: `'trainer'` (default, all public signups) or `'admin'` (manually provisioned — see below).
- `trainer_profiles.is_active`: gates both application access (`App.tsx` check) and actual sign-in (Supabase Auth ban, enforced by the `admin-manage-trainer` Edge Function).
- Authorization is enforced **server-side**: RLS policies for data isolation, the Edge Function's own admin check for privileged operations. The frontend routing (`App.tsx`) is a UX convenience, not a security boundary — a trainer cannot reach admin screens or data even if they manipulated client state, because RLS and the Edge Function both independently verify role/active-status from the database.

### Provisioning the first Admin
There is no public "register as admin" flow, by design. To make an account an admin: the person signs up normally (creating a `role='trainer'` row), then someone with database access runs:
```sql
UPDATE trainer_profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = '<their email>');
```

### Password Reset
Not implemented. The login screen's "Reset?" link shows an alert instructing the user to contact an administrator or use the Supabase dashboard (unchanged from before).

---

## 12. Core Business Logic

- **"Needs Update" rule**: unchanged — >14 days since last measurement, or none logged.
- **Weight Change Calculation**: unchanged.
- **Measurement Entry Validation**: unchanged — no negative values, only date required.
- **Client Creation Validation**: unchanged.
- **Trainer Profile Default**: `role='trainer'`, `is_active=true`, `unit_preference='metric'` on signup (set by the DB trigger, not client-supplied).
- **Progress Report Generation**: unchanged logic; footer branding now "Goodlife Fitness".
- **Photo Angle**: now a direct 1:1 mapping from the clicked upload button (`front`/`back`/`right_side`/`left_side`) — no string-matching against a dropdown label anymore. `'side'` only appears on legacy pre-upgrade rows.
- **Charts are now real, data-driven** (previously static/hardcoded): both the `ClientProfile` overview chart and `MeasurementProgress` chart compute points from actual `measurements` rows, normalized to the SVG viewBox, with an explicit empty state when there's fewer than 2 data points in range.

---

## 13. State Management

Unchanged: no global state library, all `useState`, each screen fetches its own data on mount.

---

## 14. Important Dependencies

| Dependency | Purpose |
|---|---|
| `react` / `react-dom` (^19.0.1) | UI framework |
| `@supabase/supabase-js` (^2.112.3) | Backend client — Auth, DB queries, Storage, Edge Function invoke |
| `jszip` (^3.10.1) | **New** — client-side ZIP generation for Download All Photos |
| `tailwindcss` (^4.1.14) + `@tailwindcss/vite` | Styling |
| `vite` (^6.2.3) + `@vitejs/plugin-react` | Build tooling |
| `typescript` (~5.8.2) | Type checking (`tsc --noEmit`) |
| `motion` (^12.23.24) | Still unused — available if needed |
| `lucide-react` (^0.546.0) | Still unused — available if needed |

`@google/genai`, `express`, `dotenv`, `@types/express` have been **removed** (confirmed zero imports).

---

## 15. Development Commands

| Command | Script | Purpose |
|---|---|---|
| `npm run dev` | `vite --port=3000 --host=0.0.0.0` | Dev server |
| `npm run build` | `vite build` | Production build to `dist/` |
| `npm run preview` | `vite preview` | Preview production build |
| `npm run clean` | `rm -rf dist server.js` | Unix-only, unchanged pre-existing quirk |
| `npm run lint` | `tsc --noEmit` | Type checking |

No test runner configured.

---

## 16. Build & Deployment

- **Tool**: Vite 6, output to `dist/`.
- **Deployment platform**: Vercel, project linked to GitHub repo `GoodlifeFitness93/Gym-measurement-App`, auto-deploys on push to `main`.
- **Required env vars in Vercel**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (inlined at build time by Vite — must be set in the Vercel project's environment variables, not just locally).
- **Supabase project**: `qptgngpgrftrabpxwhmh` ("GoodlifeFitness Measurement App", ap-southeast-1).
- No URL-based routing, so no special SPA rewrite rules are needed.

---

## 17. Coding Conventions

Named-export `React.FC<Props>` components (except `App.tsx`), interfaces in `src/types.ts`, snake_case DB columns / screen keys, component-local error state with retry banners.

### Theme system (2026-09-17 — replaces the old hardcoded teal palette)
`src/index.css` now has a Tailwind v4 `@theme` block defining real color utilities — this is the **only** place color tokens are defined; there is still no `tailwind.config.*` file (Tailwind v4 config is CSS-first):
```
--color-ink            → bg-ink / text-ink       (page background, near-black)
--color-surface        → bg-surface               (card backgrounds)
--color-surface-alt    → bg-surface-alt            (inputs, nested/hover surfaces)
--color-border         → border-border
--color-accent         → bg-accent / text-accent / border-accent   (Goodlife orange — buttons, active states, highlights)
--color-accent-hover   → bg-accent-hover
--color-text-muted     → text-text-muted           (secondary/label text; primary text just uses text-white)
--color-danger         → text-danger / bg-danger
--color-danger-bg      → bg-danger-bg              (error banners)
--color-success        → text-success / bg-success
```
Use these utilities for any new UI — do not reintroduce arbitrary hex classes (`text-[#005c55]` etc.), and do not add a second token system. Orange is an accent, not a fill color — avoid solid-orange large surfaces (nav pills, backgrounds); prefer `accent/10`–`accent/15` tints for "selected" states, reserving solid `bg-accent` for primary CTAs. The `.input-clinical` utility class still exists and now points at the dark tokens.

---

## 18. Fragile / High-Risk Areas

1. **Navigation State in App.tsx** — unchanged risk, same pattern.
2. **Admin RLS policy recursion footgun** — see §9. Any future admin-visibility policy on `trainer_profiles` (or similar self-referencing check) must go through a `SECURITY DEFINER` helper function, not a raw subquery on the same table, or PostgREST will return 500s.
3. **Photo Signed URL Expiry** — unchanged, 1-hour expiry, no refresh mechanism for long-open tabs.
4. **No Pagination** — unchanged, `select('*')` on everything.
5. **Unit Preference Not Applied Globally** — unchanged pre-existing issue (out of scope for this upgrade): `unit_preference` is stored but measurements always display kg/cm regardless.
6. **Clean Command Unix-Only** — unchanged.
7. **Legacy `'side'` photo angle** — old rows use `angle='side'` with no way to determine left vs. right. The UI labels these "Side (Legacy)"; do not attempt to auto-reclassify them.
8. **Two per-account unit fields that don't sync** — `trainer_profiles.unit_preference` (unused everywhere, pre-existing bug, still out of scope) and `clients.unit_system` (new, actually drives the wizard/perimeters/height cm↔in conversion). Don't assume they're the same thing or try to unify them without being asked — that's a larger refactor than this phase's scope.
9. **Before/After slider image sizing** — both compared images must always use identical base sizing (`absolute inset-0 w-full h-full object-contain`); only the Before image's `clip-path` differs. Do not give either image a different width/positioning strategy — see the ClientProfile.tsx note in §5 for the exact bug this caused before.
10. **Upload/confirmation modals need `max-h-[Xvh] overflow-y-auto`** — on short viewports a `fixed inset-0 ... flex items-center justify-center` overlay with unconstrained content height renders its bottom (often the submit button) off-screen with no way to scroll to it. Every new modal in this app should include a max-height + internal scroll, not just centering.

Resolved by earlier upgrades (previously listed here, no longer applicable): the public Supabase credential-entry screen, hardcoded/fake chart data, and the `localStorage` credential override mechanism have all been removed.

---

## 19. Known Unknowns

| Unknown | Impact |
|---|---|
| Email confirmation settings | Depends on Supabase project auth settings; both auto-confirm and confirmation-required flows are handled in `AuthScreen.tsx`. |
| Profile photo upload | `client.profile_photo_path` exists in the schema but there is still no upload UI for it — unchanged from before. |
| `photo_url` legacy column | No longer referenced by the frontend (removed along with the old signed-URL fallback logic), but may still exist in the DB as a legacy column. |
| Leaked-password protection | Currently disabled at the Supabase Auth level (flagged by the security advisor) — a dashboard setting, not something this codebase controls. |
| `clients→measurements`/`clients→progress_photos` FK cascade behavior | Never confirmed whether these pre-existing FKs have `ON DELETE CASCADE`. `ClientSettingsTab`'s Delete Client flow does NOT rely on it — it explicitly deletes photos/storage objects, measurements, then the client row, in that order. If you add another client-delete path, follow the same explicit order rather than assuming cascade. |
| Anatomy diagram hotspot coordinates | Approximate percentage positions in `AnatomyDiagram.tsx`, tuned to look right on the specific silhouette SVGs in `assets/anatomy/`. If those SVGs are ever redrawn with different proportions, the hotspot coordinates will need re-tuning — they are not computed from the SVG geometry. |

---

## 20. Rules for Future Development

1. Preserve the existing navigation pattern (`activeScreen` state in `App.tsx`) for the trainer app. Admin screens live outside that state machine, gated by `trainerProfile.role`.
2. Always use `getSupabase()` from `src/lib/supabase.ts`. Never create a new Supabase client instance directly, and never re-introduce a `localStorage` credential override.
3. Always call `supabase.auth.getUser()` before mutations to get the current `trainer_id`. Never trust a client-supplied role or trainer_id for privileged operations — route those through the `admin-manage-trainer` Edge Function (or a new Edge Function following the same pattern) so the check happens server-side.
4. Follow the existing color palette — use the `@theme` tokens in `src/index.css` (§17), not arbitrary hex classes.
5. Keep all TypeScript interfaces in `src/types.ts`.
6. Maintain Supabase column name compatibility; update queries and `types.ts` together.
7. Do not add URL-based routing without understanding the full navigation flow.
8. Never hardcode Supabase credentials, and never put the service-role key in a `VITE_*` variable or any frontend-reachable code — privileged operations belong in Edge Functions.
9. RLS is enforced and verified (see §9) — do not add redundant client-side `trainer_id` filters, but also do not weaken existing policies. Any new admin-visibility policy must use a `SECURITY DEFINER` helper function to avoid RLS recursion.
10. Test on mobile viewport (320–768px) — `BottomNav` on `md:hidden`, desktop nav on `md:flex`.
11. Follow the existing error pattern: component-local `error` state with retry banners, no toasts/global error handlers without explicit instruction.
12. If modifying the 4-angle photo system, preserve the legacy `'side'` angle value for old rows — never delete or silently reclassify historical photo records.
13. Body-composition **calculation** (US Navy, Jackson-Pollock formulas, BIA) is explicitly deferred — do not implement a formula or display a computed body-fat number unless specifically asked. `clients.body_composition_method` only stores the trainer's selected method.
14. The 11 canonical perimeters live in `src/lib/perimeters.ts` (id/label/dbColumn) — reuse this config for any new perimeter-related UI rather than hardcoding the list again. Custom measures are trainer-scoped (`custom_measures.trainer_id`), not per-client.
15. Any unit-toggle control (cm/in, metric/imperial) that sits next to already-entered numeric values must convert those values when the toggle changes (see `AddMeasurementModal.handlePerimeterUnitChange` and the wizard's `handleUnitChange`) — a label-only swap silently reinterprets the trainer's data.
