import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FolderKanban, ArrowRight } from 'lucide-react';
import { ProjectItem } from '../../services/dashboardService';
import { DashboardNavKey, SIDEBAR_SECTIONS } from './Sidebar';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectItem[];
  onSelectProject?: (proj: ProjectItem) => void;
  onSelectModule: (module: DashboardNavKey) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  projects,
  onSelectProject,
  onSelectModule,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmed = query.trim().toLowerCase();

  // 1. Matching Real Projects from DB
  const matchingProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(trimmed) ||
      p.location.toLowerCase().includes(trimmed)
  );

  // 2. Matching Navigation Modules
  const matchingModules: { key: DashboardNavKey; label: string; section: string; icon: React.ElementType }[] = [];
  if (trimmed) {
    for (const sec of SIDEBAR_SECTIONS) {
      for (const item of sec.items) {
        if (item.label.toLowerCase().includes(trimmed) || sec.title.toLowerCase().includes(trimmed)) {
          matchingModules.push({
            key: item.key,
            label: item.label,
            section: sec.title,
            icon: item.icon,
          });
        }
      }
    }
  }

  const hasResults = matchingProjects.length > 0 || matchingModules.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search modules, sections, projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400 font-medium"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {trimmed === '' ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Type to navigate to modules, projects, materials, workforce, or financial control.
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching records found for "{query}".
            </div>
          ) : (
            <>
              {/* Navigation Modules */}
              {matchingModules.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    Modules &amp; Workspace
                  </div>
                  <div className="space-y-1">
                    {matchingModules.map((m) => {
                      const Icon = m.icon;
                      return (
                        <div
                          key={m.key}
                          onClick={() => {
                            onSelectModule(m.key);
                            onClose();
                          }}
                          className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between cursor-pointer group transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-[#01875F]" />
                            <div>
                              <span className="text-xs font-bold text-slate-900 group-hover:text-[#01875F]">
                                {m.label}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-2">
                                {m.section}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#01875F]" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Projects Section */}
              {matchingProjects.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    Projects ({matchingProjects.length})
                  </div>
                  <div className="space-y-1">
                    {matchingProjects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (onSelectProject) onSelectProject(p);
                          onSelectModule('all-projects');
                          onClose();
                        }}
                        className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between cursor-pointer group transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FolderKanban className="w-4 h-4 text-[#01875F]" />
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-[#01875F]">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-2">{p.location}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
