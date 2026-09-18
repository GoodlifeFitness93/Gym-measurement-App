import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';

interface AdminTrainer {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'trainer' | 'admin';
  is_active: boolean;
  created_at: string;
  email: string;
}

interface Props {
  adminId: string;
  adminName: string;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ adminId, adminName, onLogout }) => {
  const [trainers, setTrainers] = useState<AdminTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminTrainer | null>(null);

  const callFunction = async (payload: Record<string, unknown>) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error: fnError } = await supabase.functions.invoke('admin-manage-trainer', {
      body: payload,
    });
    if (fnError) throw fnError;
    if (!data?.success) throw new Error(data?.error || 'Request failed');
    return data;
  };

  const fetchTrainers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callFunction({ action: 'list' });
      setTrainers(data.trainers || []);
    } catch (err: any) {
      console.error('Error loading trainers:', err);
      setError(err.message || 'Failed to load trainers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, []);

  const handleToggleActive = async (trainer: AdminTrainer) => {
    const action = trainer.is_active ? 'deactivate' : 'activate';
    setBusyId(trainer.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await callFunction({ action, trainer_id: trainer.id });
      setActionSuccess(
        action === 'deactivate'
          ? `${trainer.full_name} has been deactivated.`
          : `${trainer.full_name} has been reactivated.`
      );
      setConfirmTarget(null);
      await fetchTrainers();
    } catch (err: any) {
      console.error('Admin action failed:', err);
      setActionError(err.message || 'Action failed.');
    } finally {
      setBusyId(null);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const activeTrainers = trainers.filter((t) => t.is_active);
  const inactiveTrainers = trainers.filter((t) => !t.is_active);

  const TrainerCard: React.FC<{ trainer: AdminTrainer }> = ({ trainer }) => {
    const isSelf = trainer.id === adminId;
    return (
      <div className="bg-surface rounded-xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-surface-alt flex items-center justify-center font-bold text-accent shrink-0">
            {trainer.full_name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-white truncate">
              {trainer.full_name}
              {trainer.role === 'admin' && (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-surface-alt text-accent px-1.5 py-0.5 rounded">
                  Admin
                </span>
              )}
              {isSelf && (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent px-1.5 py-0.5 rounded">
                  You
                </span>
              )}
            </p>
            <p className="text-xs text-text-muted truncate">{trainer.email || 'No email on file'}</p>
            {trainer.phone && <p className="text-xs text-text-muted">{trainer.phone}</p>}
          </div>
        </div>

        {!isSelf && trainer.role !== 'admin' && (
          <button
            onClick={() => setConfirmTarget(trainer)}
            disabled={busyId === trainer.id}
            className={`text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-lg btn-press shrink-0 ${
              trainer.is_active
                ? 'bg-danger-bg hover:bg-danger hover:text-white text-danger'
                : 'bg-accent/15 hover:bg-accent hover:text-white text-accent'
            }`}
          >
            {busyId === trainer.id ? 'Working...' : trainer.is_active ? 'Deactivate' : 'Activate'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-ink text-white font-['Inter',sans-serif]">
      <header className="w-full sticky top-0 z-20 bg-ink border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 w-full max-w-5xl mx-auto">
          <div>
            <h1 className="font-extrabold text-xl text-accent tracking-tight">Goodlife Fitness</h1>
            <p className="text-xs text-text-muted">Admin Dashboard</p>
          </div>
          <button
            onClick={onLogout}
            className="text-xs font-semibold uppercase tracking-wider bg-danger-bg hover:bg-danger hover:text-white text-danger px-4 py-2 rounded-lg transition-colors"
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-6 pb-16">
        <section>
          <h2 className="text-2xl font-semibold text-white">Welcome, {adminName.split(' ')[0]}</h2>
          <p className="text-sm text-text-muted">Manage trainer accounts for Goodlife Fitness.</p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-surface rounded-xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Trainers</span>
            <div className="text-3xl font-bold text-white mt-1">{loading ? '—' : trainers.length}</div>
          </div>
          <div className="bg-surface rounded-xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Active</span>
            <div className="text-3xl font-bold text-accent mt-1">{loading ? '—' : activeTrainers.length}</div>
          </div>
          <div className="bg-surface rounded-xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Inactive</span>
            <div className="text-3xl font-bold text-danger mt-1">{loading ? '—' : inactiveTrainers.length}</div>
          </div>
        </section>

        {(actionError || actionSuccess) && (
          <div
            className={`p-3 text-xs font-medium rounded-lg border ${
              actionError
                ? 'bg-danger-bg text-danger border-danger/20'
                : 'bg-accent/10 text-accent border-accent/20'
            }`}
          >
            {actionError || actionSuccess}
          </div>
        )}

        {error && (
          <div className="p-4 bg-danger-bg text-danger text-sm rounded-xl border border-danger/20 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={fetchTrainers} className="text-xs font-bold uppercase tracking-wider underline">
              Retry
            </button>
          </div>
        )}

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Active Trainers</h3>
          {loading ? (
            <div className="p-8 text-center text-sm text-text-muted">Loading trainers...</div>
          ) : activeTrainers.length === 0 ? (
            <div className="bg-surface rounded-xl p-6 text-center border border-border text-sm text-text-muted">
              No active trainers.
            </div>
          ) : (
            <div className="space-y-3">
              {activeTrainers.map((t) => (
                <TrainerCard key={t.id} trainer={t} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Inactive Trainers</h3>
          {loading ? null : inactiveTrainers.length === 0 ? (
            <div className="bg-surface rounded-xl p-6 text-center border border-border text-sm text-text-muted">
              No inactive trainers.
            </div>
          ) : (
            <div className="space-y-3">
              {inactiveTrainers.map((t) => (
                <TrainerCard key={t.id} trainer={t} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Confirmation Dialog */}
      {confirmTarget && (
        <Modal
          title={`${confirmTarget.is_active ? 'Deactivate' : 'Activate'} ${confirmTarget.full_name}?`}
          onClose={() => setConfirmTarget(null)}
          size="md"
          dismissOnBackdrop={false}
          footer={
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 border border-border text-text-muted py-3 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleActive(confirmTarget)}
                disabled={busyId === confirmTarget.id}
                className={`flex-1 font-semibold py-3 rounded-lg btn-press disabled:opacity-60 ${
                  confirmTarget.is_active
                    ? 'bg-danger text-white hover:bg-danger/80'
                    : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                {busyId === confirmTarget.id ? 'Working…' : confirmTarget.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          }
        >
          <p className="p-5 text-sm text-text-muted">
            {confirmTarget.is_active
              ? 'They will no longer be able to sign in to Goodlife Fitness. Their existing clients, measurements, and progress photos remain fully intact and are not deleted. You can reactivate this account at any time.'
              : 'They will regain access to Goodlife Fitness with their existing email and password. All of their clients, measurements, and progress photos are still available.'}
          </p>
        </Modal>
      )}
    </div>
  );
};
