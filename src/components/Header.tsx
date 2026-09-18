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
    <header className="w-full sticky top-0 z-20 bg-ink border-b border-border shadow-sm transition-transform duration-200">
      <div className="flex items-center justify-between px-4 py-3 w-full max-w-7xl mx-auto">
        {showBack ? (
          <button
            onClick={onBack}
            className="text-text-muted hover:bg-surface-alt rounded-full p-1.5 flex items-center justify-center transition-colors active:scale-95"
            aria-label="Go back"
          >
            <span className="material-symbols-outlined text-accent text-2xl">
              arrow_back
            </span>
          </button>
        ) : (
          <div className="w-9" />
        )}

        <h1
          onClick={() => onNavigate('dashboard')}
          className="font-extrabold text-xl md:text-2xl text-accent tracking-tight text-center cursor-pointer flex-1"
        >
          Goodlife Fitness
        </h1>

        {/* Desktop Nav Cluster */}
        <nav className="hidden md:flex items-center gap-6 mr-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`text-xs font-semibold uppercase tracking-wider transition-colors pb-1 ${
              activeScreen === 'dashboard'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-accent'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('client_list')}
            className={`text-xs font-semibold uppercase tracking-wider transition-colors pb-1 ${
              activeScreen === 'client_list' || activeScreen === 'client_profile'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-accent'
            }`}
          >
            Clients
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={`text-xs font-semibold uppercase tracking-wider transition-colors pb-1 ${
              activeScreen === 'settings'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-accent'
            }`}
          >
            Settings
          </button>
        </nav>

        <button
          onClick={() => onNavigate('settings')}
          className="text-text-muted hover:bg-surface-alt rounded-full p-1.5 flex items-center justify-center transition-colors active:scale-95"
          aria-label="Settings and Profile"
        >
          <span className="material-symbols-outlined text-accent text-2xl">
            account_circle
          </span>
        </button>
      </div>
    </header>
  );
};
