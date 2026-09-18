import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, ActiveScreen } from '../types';

interface Props {
  onNavigate: (screen: ActiveScreen) => void;
  onSelectClient: (client: Client) => void;
  trainerName?: string;
}

interface RecentActivityItem {
  id: string;
  kind: 'client' | 'measurement' | 'photo';
  clientName: string;
  clientId: string;
  description: string;
  at: string;
}

export const Dashboard: React.FC<Props> = ({
  onNavigate,
  onSelectClient,
  trainerName,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [needsUpdateClients, setNeedsUpdateClients] = useState<Client[]>([]);
  const [totalClientsCount, setTotalClientsCount] = useState<number>(0);
  const [checkinsDueCount, setCheckinsDueCount] = useState<number>(0);
  const [newPhotosCount, setNewPhotosCount] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client not initialized');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch all clients for this trainer
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      const clientList: Client[] = clientsData || [];
      setTotalClientsCount(clientList.length);

      // Fetch measurements for all clients to compute checkin dates
      const { data: measurementsData, error: measurementsError } = await supabase
        .from('measurements')
        .select('client_id, measured_on, weight, created_at')
        .order('measured_on', { ascending: false });

      if (measurementsError) throw measurementsError;

      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Group latest measurement date per client
      const latestMeasurementMap = new Map<string, Date>();
      (measurementsData || []).forEach((m: any) => {
        const dateStr = m.measured_on || m.created_at;
        if (dateStr) {
          const mDate = new Date(dateStr);
          if (!latestMeasurementMap.has(m.client_id) || mDate > latestMeasurementMap.get(m.client_id)!) {
            latestMeasurementMap.set(m.client_id, mDate);
          }
        }
      });

      const needsUpdateList: Client[] = [];
      let dueCount = 0;

      clientList.forEach((c) => {
        const lastDate = latestMeasurementMap.get(c.id);
        if (!lastDate) {
          dueCount++;
          needsUpdateList.push({
            ...c,
            last_measurement_days_ago: null,
            needs_update: true,
          });
        } else {
          const diffTime = Math.abs(now.getTime() - lastDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (lastDate < fourteenDaysAgo) {
            dueCount++;
            needsUpdateList.push({
              ...c,
              last_measurement_days_ago: diffDays,
              needs_update: true,
            });
          }
        }
      });

      setCheckinsDueCount(dueCount);
      setNeedsUpdateClients(needsUpdateList);
      setClients(clientList);

      // Fetch new progress photos count (last 14 days) + recent activity feed
      const { data: photosData, error: photosError } = await supabase
        .from('progress_photos')
        .select('id, client_id, angle, taken_on, taken_at, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      let recentPhotoItems: RecentActivityItem[] = [];
      if (!photosError && photosData) {
        const recentPhotos = photosData.filter((p: any) => {
          const pDate = new Date(p.taken_on || p.created_at);
          return pDate >= fourteenDaysAgo;
        });
        setNewPhotosCount(recentPhotos.length || photosData.length);

        const clientNameById = new Map(clientList.map((c) => [c.id, c.name]));
        recentPhotoItems = photosData.slice(0, 5).map((p: any) => ({
          id: `photo-${p.id}`,
          kind: 'photo' as const,
          clientName: clientNameById.get(p.client_id) || 'Client',
          clientId: p.client_id,
          description: `New ${p.angle?.replace('_', ' ') || ''} photo uploaded`.replace(/\s+/g, ' ').trim(),
          at: p.created_at || p.taken_at || p.taken_on,
        }));
      }

      // Build merged recent activity feed: recent clients + recent measurements + recent photos
      const recentClientItems: RecentActivityItem[] = clientList.slice(0, 5).map((c) => ({
        id: `client-${c.id}`,
        kind: 'client',
        clientName: c.name,
        clientId: c.id,
        description: 'New client added',
        at: c.created_at || '',
      }));

      const recentMeasurementItems: RecentActivityItem[] = (measurementsData || [])
        .slice(0, 5)
        .map((m: any, idx: number) => ({
          id: `measurement-${m.client_id}-${idx}`,
          kind: 'measurement' as const,
          clientName: clientList.find((c) => c.id === m.client_id)?.name || 'Client',
          clientId: m.client_id,
          description: 'Measurement logged',
          at: m.created_at || m.measured_on || '',
        }));

      const merged = [...recentClientItems, ...recentMeasurementItems, ...recentPhotoItems]
        .filter((item) => item.at)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 5);

      setRecentActivity(merged);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
    if (hour >= 17) timeGreeting = 'Good evening';

    if (trainerName) {
      const firstName = trainerName.split(' ')[0];
      return `${timeGreeting}, ${firstName}`;
    }
    return `${timeGreeting}, Trainer`;
  };

  return (
    <div className="px-5 py-6 max-w-4xl mx-auto space-y-6 pb-28">
      {/* Greeting Section */}
      <section className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-semibold text-white">
          {getGreeting()}
        </h2>
        <p className="text-base text-text-muted">
          Here's your overview for today.
        </p>
      </section>

      {error && (
        <div className="p-4 bg-danger-bg text-danger text-sm rounded-xl border border-danger/20 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={fetchDashboardData}
            className="text-xs font-bold uppercase tracking-wider underline hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('add_client')}
          className="bg-accent hover:bg-accent-hover text-white rounded-xl p-4 flex flex-col items-center gap-1.5 shadow-[0_4px_12px_rgba(255,106,26,0.25)] btn-press transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">person_add</span>
          <span className="text-xs font-semibold uppercase tracking-wider">New Client</span>
        </button>
        <button
          onClick={() => onNavigate('client_list')}
          className="bg-surface hover:bg-surface-alt text-white border border-border rounded-xl p-4 flex flex-col items-center gap-1.5 shadow-sm btn-press transition-colors"
        >
          <span className="material-symbols-outlined text-2xl text-accent">straighten</span>
          <span className="text-xs font-semibold uppercase tracking-wider">Add Measurement</span>
        </button>
        <button
          onClick={() => onNavigate('client_list')}
          className="bg-surface hover:bg-surface-alt text-white border border-border rounded-xl p-4 flex flex-col items-center gap-1.5 shadow-sm btn-press transition-colors"
        >
          <span className="material-symbols-outlined text-2xl text-accent">add_a_photo</span>
          <span className="text-xs font-semibold uppercase tracking-wider">Add Photo</span>
        </button>
        <button
          onClick={() => onNavigate('client_list')}
          className="bg-surface hover:bg-surface-alt text-white border border-border rounded-xl p-4 flex flex-col items-center gap-1.5 shadow-sm btn-press transition-colors"
        >
          <span className="material-symbols-outlined text-2xl text-accent">groups</span>
          <span className="text-xs font-semibold uppercase tracking-wider">View Clients</span>
        </button>
      </section>

      {/* Summary Bento Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Active Clients */}
        <div
          onClick={() => onNavigate('client_list')}
          className="bg-surface rounded-xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.25)] active:scale-[0.98] transition-transform cursor-pointer flex flex-col justify-between h-32 col-span-2 md:col-span-1 hover:border-accent"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Total Active Clients
            </span>
            <span className="material-symbols-outlined text-accent" data-weight="fill">
              groups
            </span>
          </div>
          <div className="text-5xl font-bold text-white">
            {loading ? '—' : totalClientsCount}
          </div>
        </div>

        {/* Check-ins Due */}
        <div
          onClick={() => onNavigate('client_list')}
          className="bg-surface rounded-xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.25)] active:scale-[0.98] transition-transform cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden group hover:border-accent"
        >
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Check-ins Due
            </span>
            <span className="material-symbols-outlined text-accent">
              assignment_late
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-white relative z-10">
            {loading ? '—' : checkinsDueCount}
          </div>
        </div>

        {/* New Photos */}
        <div
          onClick={() => onNavigate('client_list')}
          className="bg-surface rounded-xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.25)] active:scale-[0.98] transition-transform cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden group hover:border-accent"
        >
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              New Photos
            </span>
            <span className="material-symbols-outlined text-text-muted">
              photo_camera
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-white relative z-10">
            {loading ? '—' : newPhotosCount}
          </div>
        </div>
      </section>

      {/* Needs Update Section */}
      <section className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold text-white">Needs Update</h3>
          <p className="text-sm text-text-muted">Measurements &gt; 2 weeks old</p>
        </div>

        <div className="bg-surface rounded-xl border border-border shadow-[0_4px_12px_rgba(0,0,0,0.25)] overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-text-muted flex justify-center items-center gap-2">
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
              Loading client update status...
            </div>
          ) : needsUpdateClients.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-accent mb-2">
                check_circle
              </span>
              <p className="text-sm font-semibold text-white">All clients up to date!</p>
              <p className="text-xs text-text-muted mt-1">
                Every client has logged a measurement within the last 14 days.
              </p>
            </div>
          ) : (
            needsUpdateClients.map((client, idx) => {
              const isLast = idx === needsUpdateClients.length - 1;
              return (
                <div
                  key={client.id}
                  onClick={() => {
                    onSelectClient(client);
                    onNavigate('client_profile');
                  }}
                  className={`flex items-center justify-between p-4 hover:bg-surface-alt transition-colors cursor-pointer active:bg-surface-alt ${
                    !isLast ? 'border-b border-border' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center font-bold text-accent overflow-hidden shrink-0">
                      {client.profile_photo_path ? (
                        <img
                          src={client.profile_photo_path}
                          alt={client.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>
                          {client.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">
                        {client.name}
                      </p>
                      <p className="text-sm text-text-muted">
                        {client.last_measurement_days_ago !== null && client.last_measurement_days_ago !== undefined
                          ? `Last updated ${client.last_measurement_days_ago} days ago`
                          : 'No measurements logged yet'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-danger-bg text-danger rounded-full p-2 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">flag</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="space-y-3">
        <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
        <div className="bg-surface rounded-xl border border-border shadow-[0_4px_12px_rgba(0,0,0,0.25)] overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-text-muted">Loading activity...</div>
          ) : recentActivity.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">
              No recent activity yet — add a client to get started.
            </div>
          ) : (
            recentActivity.map((item, idx) => {
              const client = clients.find((c) => c.id === item.clientId);
              const icon =
                item.kind === 'client' ? 'person_add' : item.kind === 'photo' ? 'add_a_photo' : 'straighten';
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (client) {
                      onSelectClient(client);
                      onNavigate('client_profile');
                    }
                  }}
                  className={`flex items-center gap-3 p-4 hover:bg-surface-alt transition-colors ${
                    client ? 'cursor-pointer' : ''
                  } ${idx !== recentActivity.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center text-accent shrink-0">
                    <span className="material-symbols-outlined text-lg">{icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.clientName}</p>
                    <p className="text-xs text-text-muted">{item.description}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Floating Action Button */}
      <button
        onClick={() => onNavigate('add_client')}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-5 z-20 bg-accent text-white font-semibold text-xs uppercase tracking-wider px-6 py-3.5 rounded-full shadow-[0_4px_14px_rgba(255,106,26,0.35)] flex items-center space-x-2 active:scale-95 transition-all hover:bg-accent-hover md:bottom-8 md:right-8"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        <span>Add Client</span>
      </button>
    </div>
  );
};
