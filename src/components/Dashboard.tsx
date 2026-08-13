import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, ActiveScreen } from '../types';

interface Props {
  onNavigate: (screen: ActiveScreen) => void;
  onSelectClient: (client: Client) => void;
  trainerName?: string;
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
        .select('client_id, measured_at, date, weight, created_at')
        .order('created_at', { ascending: false });

      if (measurementsError) throw measurementsError;

      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Group latest measurement date per client
      const latestMeasurementMap = new Map<string, Date>();
      (measurementsData || []).forEach((m: any) => {
        const dateStr = m.measured_at || m.date || m.created_at;
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

      // Fetch new progress photos count (last 14 days)
      const { data: photosData, error: photosError } = await supabase
        .from('progress_photos')
        .select('id, taken_at, created_at');

      if (!photosError && photosData) {
        const recentPhotos = photosData.filter((p: any) => {
          const pDate = new Date(p.taken_at || p.created_at);
          return pDate >= fourteenDaysAgo;
        });
        setNewPhotosCount(recentPhotos.length || photosData.length);
      }
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
        <h2 className="text-2xl md:text-3xl font-semibold text-[#111c2d]">
          {getGreeting()}
        </h2>
        <p className="text-base text-[#3e4947]">
          Here's your overview for today.
        </p>
      </section>

      {error && (
        <div className="p-4 bg-[#ffdad6] text-[#93000a] text-sm rounded-xl border border-[#ba1a1a]/20 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={fetchDashboardData}
            className="text-xs font-bold uppercase tracking-wider underline hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Bento Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Active Clients */}
        <div
          onClick={() => onNavigate('client_list')}
          className="bg-white rounded-xl border border-[#bdc9c6]/60 p-4 shadow-[0_4px_12px_rgba(15,118,110,0.05)] active:scale-[0.98] transition-transform cursor-pointer flex flex-col justify-between h-32 col-span-2 md:col-span-1 hover:border-[#005c55]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#3e4947] uppercase tracking-wider">
              Total Active Clients
            </span>
            <span className="material-symbols-outlined text-[#005c55]" data-weight="fill">
              groups
            </span>
          </div>
          <div className="text-5xl font-bold text-[#111c2d]">
            {loading ? '—' : totalClientsCount}
          </div>
        </div>

        {/* Check-ins Due */}
        <div
          onClick={() => onNavigate('client_list')}
          className="bg-white rounded-xl border border-[#bdc9c6]/60 p-4 shadow-[0_4px_12px_rgba(15,118,110,0.05)] active:scale-[0.98] transition-transform cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden group hover:border-[#005c55]"
        >
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-semibold text-[#3e4947] uppercase tracking-wider">
              Check-ins Due
            </span>
            <span className="material-symbols-outlined text-[#006a61]">
              assignment_late
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-[#111c2d] relative z-10">
            {loading ? '—' : checkinsDueCount}
          </div>
        </div>

        {/* New Photos */}
        <div
          onClick={() => onNavigate('client_list')}
          className="bg-white rounded-xl border border-[#bdc9c6]/60 p-4 shadow-[0_4px_12px_rgba(15,118,110,0.05)] active:scale-[0.98] transition-transform cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden group hover:border-[#005c55]"
        >
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-semibold text-[#3e4947] uppercase tracking-wider">
              New Photos
            </span>
            <span className="material-symbols-outlined text-[#4d5255]">
              photo_camera
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-[#111c2d] relative z-10">
            {loading ? '—' : newPhotosCount}
          </div>
        </div>
      </section>

      {/* Needs Update Section */}
      <section className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold text-[#111c2d]">Needs Update</h3>
          <p className="text-sm text-[#3e4947]">Measurements &gt; 2 weeks old</p>
        </div>

        <div className="bg-white rounded-xl border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#6e7977] flex justify-center items-center gap-2">
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[#005c55] border-t-transparent" />
              Loading client update status...
            </div>
          ) : needsUpdateClients.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-[#005c55] mb-2">
                check_circle
              </span>
              <p className="text-sm font-semibold text-[#111c2d]">All clients up to date!</p>
              <p className="text-xs text-[#6e7977] mt-1">
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
                  className={`flex items-center justify-between p-4 hover:bg-[#f0f3ff] transition-colors cursor-pointer active:bg-[#e7eeff] ${
                    !isLast ? 'border-b border-[#bdc9c6]/40' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-[#d8e3fb] flex items-center justify-center font-bold text-[#005c55] overflow-hidden shrink-0">
                      {client.avatar_url ? (
                        <img
                          src={client.avatar_url}
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
                      <p className="text-base font-semibold text-[#111c2d]">
                        {client.name}
                      </p>
                      <p className="text-sm text-[#3e4947]">
                        {client.last_measurement_days_ago !== null && client.last_measurement_days_ago !== undefined
                          ? `Last updated ${client.last_measurement_days_ago} days ago`
                          : 'No measurements logged yet'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#ffdad6] text-[#93000a] rounded-full p-2 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">flag</span>
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
        className="fixed bottom-24 right-5 z-40 bg-[#005c55] text-white font-semibold text-xs uppercase tracking-wider px-6 py-3.5 rounded-full shadow-[0_4px_14px_rgba(0,92,85,0.35)] flex items-center space-x-2 active:scale-95 transition-all hover:bg-[#0f766e] md:bottom-8 md:right-8"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        <span>Add Client</span>
      </button>
    </div>
  );
};
