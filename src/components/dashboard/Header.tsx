import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, User, Settings, Shield, LogOut } from 'lucide-react';
import { ASSETS } from '../../assets/projectImages';
import { NavigationModule } from './Sidebar';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onSelectModule: (module: NavigationModule) => void;
  onLogout: () => void;
  userName?: string;
  userRole?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenNotifications,
  unreadNotificationsCount,
  onSelectModule,
  onLogout,
  userName = 'Mayowa',
  userRole = 'CEO',
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Global Search Bar (Matching Reference Image) */}
      <div className="flex-1 max-w-md">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full h-10 px-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-lg text-left text-sm text-slate-500 flex items-center gap-2.5 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#01875F]/20"
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
          <span className="truncate text-[13px] text-slate-400 group-hover:text-slate-600">
            Search projects, materials, people, etc...
          </span>
          <span className="hidden sm:inline-block ml-auto text-[11px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
            ⌘K
          </span>
        </button>
      </div>

      {/* Right Controls: Notifications & User Profile */}
      <div className="flex items-center gap-3 sm:gap-4 ml-4">
        {/* Notification Bell */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          title="Notifications"
          aria-label="View notifications"
        >
          <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </button>

        {/* User Profile Area */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1 sm:pl-1 sm:pr-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none"
            aria-expanded={profileDropdownOpen}
          >
            {/* Avatar Photo */}
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              <img
                src={ASSETS.mayowaAvatar}
                alt={userName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image loading fails
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-[#01875F] text-white font-bold text-xs">
                M
              </span>
            </div>

            {/* User Name & Role */}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[13.5px] font-bold text-slate-900 leading-tight">
                {userName}
              </span>
              <span className="text-[11px] font-medium text-slate-400 leading-tight">
                {userRole}
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Signed in as
                </p>
                <p className="text-sm font-bold text-slate-800 truncate">{userName} ({userRole})</p>
                <p className="text-xs text-slate-500 font-mono">Davejoe Executive Office</p>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectModule('profile');
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs sm:text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>My Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectModule('settings');
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs sm:text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Account Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectModule('settings');
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs sm:text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>Security & RLS Access</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs sm:text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
