import React, { useEffect, useState } from 'react';
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

export default function App() {
  const [configured, setConfigured] = useState<boolean>(isSupabaseConfigured());
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // App navigation state
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('dashboard');
  const [screenHistory, setScreenHistory] = useState<ActiveScreen[]>(['dashboard']);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
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

  const navigateTo = (screen: ActiveScreen) => {
    setActiveScreen(screen);
    setScreenHistory((prev) => [...prev, screen]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (activeScreen === 'share_report' || activeScreen === 'add_measurement' || activeScreen === 'measurement_progress') {
      setActiveScreen('client_profile');
    } else if (activeScreen === 'client_profile') {
      setActiveScreen('client_list');
    } else if (screenHistory.length > 1) {
      const newHistory = [...screenHistory];
      newHistory.pop(); // remove current
      const prevScreen = newHistory[newHistory.length - 1] || 'dashboard';
      setScreenHistory(newHistory);
      setActiveScreen(prevScreen);
    } else {
      setActiveScreen('dashboard');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        onNavigate={navigateTo}
        onBack={handleBack}
        showBack={showBack}
      />

      {/* Main Screen Router */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
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
              setActiveScreen('client_profile');
            }}
          />
        )}

        {activeScreen === 'measurement_progress' && selectedClient && (
          <MeasurementProgress
            client={selectedClient}
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
        onNavigate={navigateTo}
      />
    </div>
  );
}
