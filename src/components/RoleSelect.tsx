import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Check } from 'lucide-react';

export const ROLES = [
  'Management / CEO',
  'Admin / Client & Workforce Coordinator',
  'Technical Inspection & QC Officer',
  'Site Supervisor',
  'Procurement & Logistics',
  'Accounts',
  'Artisan / Workforce',
] as const;

export type RoleType = (typeof ROLES)[number];

interface RoleSelectProps {
  value: string;
  onChange: (role: string) => void;
  error?: string;
  disabled?: boolean;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        const currentIndex = ROLES.indexOf(value as RoleType);
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < ROLES.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : ROLES.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < ROLES.length) {
        onChange(ROLES[focusedIndex]);
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const selectRole = (role: string) => {
    onChange(role);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <label
        id="role-label"
        htmlFor="role-trigger"
        className="block text-xs font-semibold text-slate-800 mb-1.5"
      >
        Role
      </label>

      {/* Trigger Button */}
      <button
        ref={buttonRef}
        id="role-trigger"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="role-label role-trigger"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            const idx = ROLES.indexOf(value as RoleType);
            setFocusedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`w-full h-11 px-3.5 pl-10 pr-10 text-left bg-white border rounded-lg text-sm flex items-center justify-between transition-all duration-150 outline-none ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : isOpen
              ? 'border-[#18B892] ring-2 ring-[#18B892]/20'
              : 'border-slate-200 hover:border-slate-300 focus:border-[#18B892] focus:ring-2 focus:ring-[#18B892]/20'
        } ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
      >
        {/* Left User Icon */}
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
          <User className="w-[18px] h-[18px]" strokeWidth={1.8} />
        </span>

        {/* Selected value or placeholder */}
        <span
          className={`truncate select-none ${
            value ? 'text-slate-800 font-medium' : 'text-slate-400 font-normal'
          }`}
        >
          {value || 'Select your role'}
        </span>

        {/* Right Chevron Icon */}
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center transition-transform duration-200">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#18B892]' : ''
            }`}
            strokeWidth={2}
          />
        </span>
      </button>

      {/* Floating Dropdown Listbox */}
      {isOpen && (
        <div
          role="listbox"
          aria-labelledby="role-label"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white border border-slate-200/90 rounded-xl shadow-lg shadow-slate-900/8 py-1.5 max-h-60 overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {ROLES.map((role, idx) => {
            const isSelected = value === role;
            const isFocused = focusedIndex === idx;

            return (
              <div
                key={role}
                role="option"
                aria-selected={isSelected}
                onClick={() => selectRole(role)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`px-3.5 py-2.5 text-xs sm:text-sm cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-[#18B892]/10 text-[#18B892] font-semibold'
                    : isFocused
                      ? 'bg-slate-50 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{role}</span>
                {isSelected && (
                  <Check
                    className="w-4 h-4 text-[#18B892] shrink-0 ml-2"
                    strokeWidth={2.5}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};
