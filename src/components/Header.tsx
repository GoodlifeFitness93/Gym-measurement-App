import React from 'react';
import { ActiveScreen } from '../types';

interface Props {
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  onBack?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<Props> = ({
  activeScreen,
  onNavigate,
  onBack,
  showBack = false,
}) => {
  return (
    <header className="w-full sticky top-0 z-50 bg-[#f9f9ff] border-b border-[#bdc9c6]/50 shadow-sm transition-transform duration-200">
      <div className="flex items-center justify-between px-4 py-3 w-full max-w-7xl mx-auto">
        {showBack ? (
          <button
            onClick={onBack}
            className="text-[#3e4947] hover:bg-[#e7eeff] rounded-full p-1.5 flex items-center justify-center transition-colors active:scale-95"
            aria-label="Go back"
          >
            <span className="material-symbols-outlined text-[#005c55] text-2xl">
              arrow_back
            </span>
          </button>
        ) : (
          <div className="w-9" />
        )}

        <h1
          onClick={() => onNavigate('dashboard')}
          className="font-extrabold text-xl md:text-2xl text-[#005c55] tracking-tight text-center cursor-pointer flex-1"
        >
          FitTrack Pro
        </h1>

        {/* Desktop Nav Cluster */}
        <nav className="hidden md:flex items-center gap-6 mr-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`text-xs font-semibold uppercase tracking-wider transition-colors pb-1 ${
              activeScreen === 'dashboard'
                ? 'text-[#005c55] border-b-2 border-[#005c55]'
                : 'text-[#3e4947] hover:text-[#005c55]'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('client_list')}
            className={`text-xs font-semibold uppercase tracking-wider transition-colors pb-1 ${
              activeScreen === 'client_list' || activeScreen === 'client_profile'
                ? 'text-[#005c55] border-b-2 border-[#005c55]'
                : 'text-[#3e4947] hover:text-[#005c55]'
            }`}
          >
            Clients
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={`text-xs font-semibold uppercase tracking-wider transition-colors pb-1 ${
              activeScreen === 'settings'
                ? 'text-[#005c55] border-b-2 border-[#005c55]'
                : 'text-[#3e4947] hover:text-[#005c55]'
            }`}
          >
            Settings
          </button>
        </nav>

        <button
          onClick={() => onNavigate('settings')}
          className="text-[#3e4947] hover:bg-[#e7eeff] rounded-full p-1.5 flex items-center justify-center transition-colors active:scale-95"
          aria-label="Settings and Profile"
        >
          <span className="material-symbols-outlined text-[#005c55] text-2xl">
            account_circle
          </span>
        </button>
      </div>
    </header>
  );
};
