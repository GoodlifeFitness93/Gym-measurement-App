import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, ActiveScreen } from '../types';

interface Props {
  onNavigate: (screen: ActiveScreen) => void;
  onSelectClient: (client: Client) => void;
}

export const ClientList: React.FC<Props> = ({ onNavigate, onSelectClient }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<'all' | 'active' | 'needs_update'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client not initialized');
      setLoading(false);
      return;
    }

    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (clientsError) throw clientsError;

      // Fetch measurements to compute check-in date and weight changes
      const { data: measurementsData, error: measurementsError } = await supabase
        .from('measurements')
        .select('client_id, weight, measured_at, date, created_at')
        .order('created_at', { ascending: true });

      if (measurementsError) throw measurementsError;

      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Group measurements per client
      const clientMeasurementsMap = new Map<string, any[]>();
      (measurementsData || []).forEach((m) => {
        if (!clientMeasurementsMap.has(m.client_id)) {
          clientMeasurementsMap.set(m.client_id, []);
        }
        clientMeasurementsMap.get(m.client_id)!.push(m);
      });

      const processedClients: Client[] = (clientsData || []).map((c) => {
        const mList = clientMeasurementsMap.get(c.id) || [];
        let weightChange: number | null = null;
        let lastDate: Date | null = null;
        let lastCheckinFormatted = 'No check-ins';
        let needsUpdate = true;

        if (mList.length > 0) {
          const firstM = mList[0];
          const lastM = mList[mList.length - 1];

          const startW = firstM.weight ?? c.starting_weight;
          const currW = lastM.weight;

          if (currW !== null && currW !== undefined && startW !== null && startW !== undefined) {
            weightChange = parseFloat((currW - startW).toFixed(1));
          }

          const rawDate = lastM.measured_at || lastM.date || lastM.created_at;
          if (rawDate) {
            lastDate = new Date(rawDate);
            needsUpdate = lastDate < fourteenDaysAgo;
            lastCheckinFormatted = lastDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
          }
        }

        return {
          ...c,
          last_checkin_date: lastCheckinFormatted,
          needs_update: needsUpdate,
          weight_change: weightChange,
          current_weight: mList.length > 0 ? mList[mList.length - 1].weight : c.starting_weight,
        };
      });

      setClients(processedClients);
    } catch (err: any) {
      console.error('Error fetching client list:', err);
      setError(err.message || 'Failed to load client list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Filter clients
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.goal_notes && c.goal_notes.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTag === 'active') {
      return !c.needs_update;
    }
    if (filterTag === 'needs_update') {
      return c.needs_update;
    }
    return true;
  });

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto pb-24 flex flex-col min-h-screen font-['Inter',sans-serif]">
      {/* Search & Filter Section */}
      <section className="px-4 py-3 sticky top-[57px] z-40 bg-[#f9f9ff]/95 backdrop-blur-sm border-b border-[#bdc9c6]/30">
        {/* Search Bar */}
        <div className="relative w-full mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-[#6e7977]">search</span>
          </div>
          <input
            type="text"
            placeholder="Search clients by name or goal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f0f3ff] text-[#111c2d] text-base border-b-2 border-transparent focus:border-[#005c55] focus:ring-0 focus:outline-none rounded-t-lg px-4 py-2.5 pl-10 transition-colors placeholder:text-[#bdc9c6]"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilterTag('all')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
              filterTag === 'all'
                ? 'bg-[#0f766e] text-[#a3faef]'
                : 'bg-white border border-[#bdc9c6] text-[#3e4947] hover:bg-[#e7eeff]'
            }`}
          >
            All ({clients.length})
          </button>
          <button
            onClick={() => setFilterTag('active')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
              filterTag === 'active'
                ? 'bg-[#0f766e] text-[#a3faef]'
                : 'bg-white border border-[#bdc9c6] text-[#3e4947] hover:bg-[#e7eeff]'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterTag('needs_update')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
              filterTag === 'needs_update'
                ? 'bg-[#0f766e] text-[#a3faef]'
                : 'bg-white border border-[#bdc9c6] text-[#3e4947] hover:bg-[#e7eeff]'
            }`}
          >
            Needs Update
          </button>
        </div>
      </section>

      {error && (
        <div className="mx-4 mt-4 p-4 bg-[#ffdad6] text-[#93000a] text-sm rounded-xl border border-[#ba1a1a]/20 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchClients} className="text-xs font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Client List */}
      <section className="flex-1 px-4 space-y-3 mt-3">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#6e7977] flex justify-center items-center gap-2">
            <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#005c55] border-t-transparent" />
            Loading client directory...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.02)] my-4">
            <span className="material-symbols-outlined text-4xl text-[#005c55] mb-2">
              group_add
            </span>
            <h3 className="text-lg font-semibold text-[#111c2d]">
              {searchQuery ? 'No matching clients found' : 'No clients yet — add your first client'}
            </h3>
            <p className="text-xs text-[#6e7977] mt-1 mb-4">
              {searchQuery ? 'Try clearing your search term.' : 'Start tracking client measurements, progress photos and reports.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => onNavigate('add_client')}
                className="bg-[#005c55] hover:bg-[#0f766e] text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider btn-press"
              >
                + Add Client
              </button>
            )}
          </div>
        ) : (
          filteredClients.map((client) => {
            const isNeed = client.needs_update;
            const wChange = client.weight_change;

            return (
              <article
                key={client.id}
                onClick={() => {
                  onSelectClient(client);
                  onNavigate('client_profile');
                }}
                className="bg-white rounded-xl border border-[#bdc9c6]/60 p-4 flex items-center gap-4 shadow-[0_4px_12px_rgba(15,118,110,0.02)] hover:shadow-[0_4px_16px_rgba(15,118,110,0.08)] active:scale-[0.99] transition-all cursor-pointer"
              >
                {/* Avatar with Status Dot */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full border border-[#dee8ff] overflow-hidden bg-[#d8e3fb] flex items-center justify-center font-bold text-[#005c55]">
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
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                      isNeed ? 'bg-[#ba1a1a]' : 'bg-[#006a61]'
                    }`}
                  />
                </div>

                {/* Client Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-[#111c2d] truncate pb-0.5">
                    {client.name}
                  </h2>
                  {isNeed ? (
                    <div className="flex items-center gap-1 text-sm text-[#ba1a1a]">
                      <span className="material-symbols-outlined text-[16px]">warning</span>
                      <span>Needs Update</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-[#3e4947]">
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      <span>Check-in: {client.last_checkin_date}</span>
                    </div>
                  )}
                </div>

                {/* Weight Change Badge */}
                <div className="shrink-0 flex flex-col items-end">
                  {wChange === null || wChange === undefined ? (
                    <div className="bg-[#d8e3fb] px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#3e4947]">
                        drag_handle
                      </span>
                      <span className="text-xs font-semibold text-[#3e4947] tracking-wider">
                        0.0kg
                      </span>
                    </div>
                  ) : wChange < 0 ? (
                    <div className="bg-[#86f2e4] px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#006f66]">
                        trending_down
                      </span>
                      <span className="text-xs font-semibold text-[#006f66] tracking-wider">
                        {wChange}kg
                      </span>
                    </div>
                  ) : wChange > 0 ? (
                    <div className="bg-[#ffdad6] px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#93000a]">
                        trending_up
                      </span>
                      <span className="text-xs font-semibold text-[#93000a] tracking-wider">
                        +{wChange}kg
                      </span>
                    </div>
                  ) : (
                    <div className="bg-[#d8e3fb] px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#3e4947]">
                        drag_handle
                      </span>
                      <span className="text-xs font-semibold text-[#3e4947] tracking-wider">
                        0.0kg
                      </span>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
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
