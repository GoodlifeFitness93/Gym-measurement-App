import React, { useEffect, useRef, useState } from 'react';
import { pushBackHandler, removeBackHandler } from './lib/backStack';
import { isSupabaseConfigured, getSupabase } from './lib/supabase';
import { AuthScreen } from './components/AuthScreen';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { ClientList } from './components/ClientList';
import { ClientProfile } from './components/ClientProfile';
import { AddMeasurementModal } from './components/AddMeasurementModal';
import { MeasurementProgress } from './components/MeasurementProgress';
import { ShareReportModal } from './components/ShareReportModal';
import { NewClientWizard } from './components/wizard/NewClientWizard';
import { SettingsScreen } from './components/SettingsScreen';
import { ActiveScreen, Client, TrainerProfile, Measurement } from './types';
import type { ChartableMetric } from './components/MeasurementProgress';

export default function App() {
  const [configured, setConfigured] = useState<boolean>(isSupabaseConfigured());
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // App navigation state. `screenHistory` is the single source of truth — the
  // last entry is the visible screen. Android/browser Back pops it.
  const [screenHistory, setScreenHistory] = useState<ActiveScreen[]>(['dashboard']);
  const activeScreen = screenHistory[screenHistory.length - 1];
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [progressMetric, setProgressMetric] = useState<ChartableMetric | undefined>(undefined);
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);

  // Check auth & profile
  useEffect(() => {
    if (!configured) {
      setAuthLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setConfigured(false);
      setAuthLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      setSession(initSession);
      if (initSession?.user) {
        fetchTrainerProfile(initSession.user.id);
      }
      setAuthLoading(false);
    }).catch((err) => {
      console.error('Session get error:', err);
      setAuthLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        if (currentSession?.user) {
          fetchTrainerProfile(currentSession.user.id);
        } else {
          setTrainerProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [configured]);

  const fetchTrainerProfile = async (userId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data } = await supabase
        .from('trainer_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setTrainerProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch trainer profile:', err);
    }
  };

  // Drill down one level (Client -> Weight -> Measurement detail ...).
  const navigateTo = (screen: ActiveScreen) => {
    setScreenHistory((prev) => {
      // Navigating to a screen already in the stack means "go back to it"
      // (e.g. Cancel on Add Measurement -> Client Profile), never a new level.
      const idx = prev.lastIndexOf(screen);
      if (idx !== -1) return idx === prev.length - 1 ? prev : prev.slice(0, idx + 1);
      return [...prev, screen];
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Bottom-nav / header tabs are roots: they reset the stack instead of
  // stacking endlessly, so Back from a tab root exits rather than looping.
  const navigateRoot = (screen: ActiveScreen) => {
    setScreenHistory([screen]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setScreenHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Android system Back / browser Back pops one screen while internal history
  // exists. Modals register their own handler on top of this one.
  const backRef = useRef(handleBack);
  backRef.current = handleBack;
  const depthRef = useRef(screenHistory.length);
  depthRef.current = screenHistory.length;
  const deep = screenHistory.length > 1;

  useEffect(() => {
    if (!deep) return;
    const id = pushBackHandler(() => {
      backRef.current();
      return depthRef.current > 2; // stay registered while still nested
    });
    return () => removeBackHandler(id);
  }, [deep]);

  // Render 1: Supabase Credentials Missing (developer-facing only; never shown to end users)
  if (!configured) {
    return (
      <div className="min-h-screen bg-ink flex flex-col justify-center items-center p-6 text-white text-center gap-2">
        <span className="material-symbols-outlined text-4xl text-danger">error</span>
        <p className="text-sm font-semibold text-danger">Configuration Error</p>
        <p className="text-xs text-text-muted max-w-sm">
          The application is missing required environment configuration. Check the server/deployment logs for details.
        </p>
      </div>
    );
  }

  // Render 2: Auth Check Loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-ink flex flex-col justify-center items-center p-6 text-white">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-accent border-t-transparent" />
          <p className="text-sm font-semibold text-accent">Loading Goodlife Fitness...</p>
        </div>
      </div>
    );
  }

  // Render 3: Unauthenticated -> Login / Signup
  if (!session) {
    return <AuthScreen onSuccess={() => setConfigured(true)} />;
  }

  // Render 4: Trainer profile still loading (avoids a flash of the wrong screen)
  if (!trainerProfile) {
    return (
      <div className="min-h-screen bg-ink flex flex-col justify-center items-center p-6 text-white">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-accent border-t-transparent" />
      </div>
    );
  }

  // Render 5: Deactivated Account
  if (!trainerProfile.is_active) {
    return (
      <div className="min-h-screen bg-ink flex flex-col justify-center items-center p-6 text-white text-center gap-3">
        <span className="material-symbols-outlined text-4xl text-danger">lock</span>
        <h1 className="text-lg font-semibold text-danger">Account Inactive</h1>
        <p className="text-sm text-text-muted max-w-sm">
          Your Goodlife Fitness trainer account is currently inactive. Please contact the administrator.
        </p>
        <button
          onClick={async () => {
            const supabase = getSupabase();
            if (supabase) await supabase.auth.signOut().catch(() => null);
            setSession(null);
            setTrainerProfile(null);
          }}
          className="mt-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-lg btn-press"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Render 6: Admin App
  if (trainerProfile.role === 'admin') {
    return (
      <AdminDashboard
        adminId={trainerProfile.id}
        adminName={trainerProfile.full_name}
        onLogout={async () => {
          const supabase = getSupabase();
          if (supabase) await supabase.auth.signOut().catch(() => null);
          setSession(null);
          setTrainerProfile(null);
        }}
      />
    );
  }

  // Render 7: Authenticated Trainer App
  const showBack = activeScreen !== 'dashboard';

  return (
    <div className="min-h-screen bg-ink text-white flex flex-col font-['Inter',sans-serif]">
      {/* Top Header */}
      <Header
        activeScreen={activeScreen}
        onNavigate={navigateRoot}
        onBack={handleBack}
        showBack={showBack}
      />

      {/* Main Screen Router. `pb-bottom-nav` keeps the last row of every screen
          clear of the fixed mobile navigation. */}
      <main className="flex-1 w-full max-w-7xl mx-auto pb-bottom-nav">
        {activeScreen === 'dashboard' && (
          <Dashboard
            onNavigate={navigateTo}
            onSelectClient={(c) => setSelectedClient(c)}
            trainerName={trainerProfile?.full_name || session?.user?.user_metadata?.full_name}
          />
        )}

        {activeScreen === 'client_list' && (
          <ClientList
            onNavigate={navigateTo}
            onSelectClient={(c) => setSelectedClient(c)}
          />
        )}

        {activeScreen === 'client_profile' && selectedClient && (
          <ClientProfile
            client={selectedClient}
            onNavigate={navigateTo}
            onRefreshClient={() => {
              // Refresh client state if needed
            }}
            onEditMeasurement={(m) => {
              setEditingMeasurement(m);
              navigateTo('add_measurement');
            }}
            onAddMeasurement={() => {
              setEditingMeasurement(null);
              navigateTo('add_measurement');
            }}
            onViewProgress={(metric) => {
              setProgressMetric(metric);
              navigateTo('measurement_progress');
            }}
          />
        )}

        {activeScreen === 'add_measurement' && selectedClient && (
          <AddMeasurementModal
            client={selectedClient}
            editMeasurement={editingMeasurement}
            onNavigate={(screen) => {
              setEditingMeasurement(null);
              navigateTo(screen);
            }}
            onSuccess={() => {
              setEditingMeasurement(null);
              handleBack();
            }}
          />
        )}

        {activeScreen === 'measurement_progress' && selectedClient && (
          <MeasurementProgress
            client={selectedClient}
            initialMetric={progressMetric}
            onNavigate={navigateTo}
          />
        )}

        {activeScreen === 'share_report' && selectedClient && (
          <ShareReportModal
            client={selectedClient}
            onNavigate={navigateTo}
          />
        )}

        {activeScreen === 'add_client' && (
          <NewClientWizard
            onNavigate={navigateTo}
            onSuccess={(newClient) => {
              setSelectedClient(newClient);
            }}
          />
        )}

        {activeScreen === 'settings' && (
          <SettingsScreen
            onNavigate={navigateTo}
            onLogout={() => {
              setSession(null);
            }}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeScreen={activeScreen}
        onNavigate={navigateRoot}
      />
    </div>
  );
}
