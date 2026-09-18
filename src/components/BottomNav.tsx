import React from 'react';
import { ActiveScreen } from '../types';

interface Props {
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
}

export const BottomNav: React.FC<Props> = ({ activeScreen, onNavigate }) => {
  const isDashboard = activeScreen === 'dashboard';
  const isClients = activeScreen === 'client_list' || activeScreen === 'client_profile';
  const isSettings = activeScreen === 'settings';

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 w-full z-20 rounded-t-xl bg-surface border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.25)] pb-safe"
    >
      <div className="flex justify-around items-center h-16 w-full px-4">
        {/* Dashboard */}
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-full transition-all duration-150 active:scale-90 ${
            isDashboard
              ? 'bg-accent/15 text-accent w-20'
              : 'text-text-muted hover:text-accent'
          }`}
        >
          <span
            className="material-symbols-outlined text-xl mb-0.5"
            style={{ fontVariationSettings: isDashboard ? "'FILL' 1" : "'FILL' 0" }}
          >
            dashboard
          </span>
          <span className="text-[11px] font-semibold tracking-wider">
            Dashboard
          </span>
        </button>

        {/* Clients */}
        <button
          onClick={() => onNavigate('client_list')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-full transition-all duration-150 active:scale-90 ${
            isClients
              ? 'bg-accent/15 text-accent w-20'
              : 'text-text-muted hover:text-accent'
          }`}
        >
          <span
            className="material-symbols-outlined text-xl mb-0.5"
            style={{ fontVariationSettings: isClients ? "'FILL' 1" : "'FILL' 0" }}
          >
            groups
          </span>
          <span className="text-[11px] font-semibold tracking-wider">
            Clients
          </span>
        </button>

        {/* Settings */}
        <button
          onClick={() => onNavigate('settings')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-full transition-all duration-150 active:scale-90 ${
            isSettings
              ? 'bg-accent/15 text-accent w-20'
              : 'text-text-muted hover:text-accent'
          }`}
        >
          <span
            className="material-symbols-outlined text-xl mb-0.5"
            style={{ fontVariationSettings: isSettings ? "'FILL' 1" : "'FILL' 0" }}
          >
            settings
          </span>
          <span className="text-[11px] font-semibold tracking-wider">
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
};
