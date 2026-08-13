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
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 rounded-t-xl bg-white border-t border-[#bdc9c6]/50 shadow-[0_-4px_12px_rgba(15,118,110,0.05)]">
      <div className="flex justify-around items-center h-16 w-full px-4 pb-safe">
        {/* Dashboard */}
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-full transition-all duration-150 active:scale-90 ${
            isDashboard
              ? 'bg-[#86f2e4] text-[#006f66] w-20'
              : 'text-[#3e4947] hover:text-[#005c55]'
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
              ? 'bg-[#86f2e4] text-[#006f66] w-20'
              : 'text-[#3e4947] hover:text-[#005c55]'
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
              ? 'bg-[#86f2e4] text-[#006f66] w-20'
              : 'text-[#3e4947] hover:text-[#005c55]'
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
