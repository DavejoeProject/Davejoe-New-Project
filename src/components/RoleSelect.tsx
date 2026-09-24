import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  ChevronDown,
  Check,
  ShieldCheck,
  SlidersHorizontal,
  ClipboardCheck,
  HardHat,
  PackageCheck,
  Receipt,
  Hammer,
} from 'lucide-react';

export interface RoleDefinition {
  slug: string;
  name: string;
  description: string;
  isActive: boolean;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    slug: 'management',
    name: 'Management / CEO',
    description: 'Executive management access',
    isActive: true,
    icon: ShieldCheck,
  },
  {
    slug: 'admin',
    name: 'Admin',
    description: 'Administrative operations',
    isActive: false,
    icon: SlidersHorizontal,
  },
  {
    slug: 'technical',
    name: 'Technical Inspection / QC',
    description: 'Inspection and quality control',
    isActive: false,
    icon: ClipboardCheck,
  },
  {
    slug: 'supervisor',
    name: 'Site Supervisor',
    description: 'Site execution and supervision',
    isActive: false,
    icon: HardHat,
  },
  {
    slug: 'procurement',
    name: 'Procurement & Logistics',
    description: 'Materials and logistics',
    isActive: false,
    icon: PackageCheck,
  },
  {
    slug: 'accounts',
    name: 'Accounts',
    description: 'Finance and project accounts',
    isActive: false,
    icon: Receipt,
  },
  {
    slug: 'artisan',
    name: 'Artisan / Workforce',
    description: 'Workforce and field operations',
    isActive: false,
    icon: Hammer,
  },
];

interface RoleSelectProps {
  value: string; // role slug or name
  onChange: (selectedSlug: string, selectedName: string) => void;
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

  // Find currently selected role definition by slug or name
  const selectedRole = ROLE_DEFINITIONS.find(
    (r) =>
      r.slug === value ||
      r.name.toLowerCase() === value.toLowerCase() ||
      (value.toLowerCase().includes('ceo') && r.slug === 'management') ||
      (value.toLowerCase().includes('artisan') && r.slug === 'artisan') ||
      (value.toLowerCase().includes('admin') && r.slug === 'admin') ||
      (value.toLowerCase().includes('account') && r.slug === 'accounts') ||
      (value.toLowerCase().includes('supervisor') && r.slug === 'supervisor') ||
      (value.toLowerCase().includes('procurement') && r.slug === 'procurement') ||
      (value.toLowerCase().includes('technical') && r.slug === 'technical')
  ) || null;

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
        const currentIndex = ROLE_DEFINITIONS.findIndex(
          (r) => r.slug === selectedRole?.slug
        );
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
      setFocusedIndex((prev) => (prev < ROLE_DEFINITIONS.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : ROLE_DEFINITIONS.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < ROLE_DEFINITIONS.length) {
        const item = ROLE_DEFINITIONS[focusedIndex];
        onChange(item.slug, item.name);
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const handleSelect = (item: RoleDefinition) => {
    onChange(item.slug, item.name);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const SelectedIcon = selectedRole ? selectedRole.icon : Users;

  return (
    <div className="w-full relative" ref={dropdownRef}>
      {/* Label: Sign in as */}
      <label
        id="role-label"
        htmlFor="role-trigger"
        className="block text-xs font-semibold text-slate-800 mb-1.5"
      >
        Sign in as
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
            const idx = ROLE_DEFINITIONS.findIndex(
              (r) => r.slug === selectedRole?.slug
            );
            setFocusedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`w-full h-11 px-3.5 pl-10 pr-10 text-left bg-white border rounded-lg text-sm flex items-center justify-between transition-all duration-150 outline-none ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : isOpen
              ? 'border-[#01875F] ring-2 ring-[#01875F]/20'
              : 'border-slate-200 hover:border-slate-300 focus:border-[#01875F] focus:ring-2 focus:ring-[#01875F]/20'
        } ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
      >
        {/* Left Professional User/Team Icon */}
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
          <SelectedIcon className="w-[18px] h-[18px]" strokeWidth={1.8} />
        </span>

        {/* Selected value or placeholder */}
        <div className="flex items-center gap-2 truncate">
          <span
            className={`truncate select-none ${
              selectedRole ? 'text-slate-800 font-medium' : 'text-slate-400 font-normal'
            }`}
          >
            {selectedRole ? selectedRole.name : 'Select your role'}
          </span>
          {selectedRole && !selectedRole.isActive && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
              Coming soon
            </span>
          )}
        </div>

        {/* Right Chevron Icon */}
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center transition-transform duration-200">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#01875F]' : ''
            }`}
            strokeWidth={2}
          />
        </span>
      </button>

      {/* Custom Polished Dropdown List */}
      {isOpen && (
        <div
          role="listbox"
          aria-labelledby="role-label"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white border border-slate-200/90 rounded-xl shadow-[0_12px_32px_-8px_rgba(15,23,42,0.12)] py-1.5 max-h-80 overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150 divide-y divide-slate-100"
        >
          {ROLE_DEFINITIONS.map((roleItem, idx) => {
            const isSelected = selectedRole?.slug === roleItem.slug;
            const isFocused = focusedIndex === idx;
            const ItemIcon = roleItem.icon;

            return (
              <div
                key={roleItem.slug}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(roleItem)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-[#01875F]/8 text-slate-900'
                    : isFocused
                      ? 'bg-slate-50 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {/* Left side: Icon + Title & Description */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#01875F] text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:text-slate-700'
                    }`}
                  >
                    <ItemIcon className="w-4 h-4" strokeWidth={1.9} />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13.5px] truncate ${isSelected ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                        {roleItem.name}
                      </span>
                      {!roleItem.isActive && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <span className="text-[11.5px] text-slate-400 truncate">
                      {roleItem.description}
                    </span>
                  </div>
                </div>

                {/* Right side: Checkmark if selected */}
                {isSelected && (
                  <Check
                    className="w-4 h-4 text-[#01875F] shrink-0"
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
