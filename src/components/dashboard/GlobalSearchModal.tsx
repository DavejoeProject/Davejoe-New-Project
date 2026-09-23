import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FolderKanban, Package, Users, ShieldCheck, FileText, ArrowRight } from 'lucide-react';
import { ProjectItem } from '../../services/dashboardService';
import { NavigationModule } from './Sidebar';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectItem[];
  onSelectProject: (proj: ProjectItem) => void;
  onSelectModule: (module: NavigationModule) => void;
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
        else {
          // Open search triggered by parent or hook
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Matching entities
  const matchingProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.location.toLowerCase().includes(query.toLowerCase())
  );

  const materialsList = [
    { name: 'Portland Cement 42.5N', module: 'materials' as const, category: 'Civil Materials' },
    { name: 'High-Tensile TMT Rebar (16mm)', module: 'materials' as const, category: 'Structural Steel' },
    { name: 'Italian Porcelain Floor Tiles', module: 'materials' as const, category: 'Finishing' },
  ].filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));

  const workforceList = [
    { name: 'Engr. Babatunde Lawal', role: 'Site Supervisor (Riverside)', module: 'workforce' as const },
    { name: 'Arch. Fatima Aliyu', role: 'Site Supervisor (Sunset)', module: 'workforce' as const },
    { name: 'Musa Ibrahim', role: 'Trade Lead (Masons)', module: 'workforce' as const },
  ].filter((w) => w.name.toLowerCase().includes(query.toLowerCase()) || w.role.toLowerCase().includes(query.toLowerCase()));

  const hasResults =
    matchingProjects.length > 0 || materialsList.length > 0 || workforceList.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, materials, people, reports..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400 font-medium"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-4">
          {query.trim() === '' ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Type to quickly find active projects, site materials, supervisors, or QC reports.
            </div>
          ) : !hasResults ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No matching records found for "{query}".
            </div>
          ) : (
            <>
              {/* Projects Section */}
              {matchingProjects.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Projects ({matchingProjects.length})
                  </div>
                  <div className="space-y-1">
                    {matchingProjects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p);
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

              {/* Materials Section */}
              {materialsList.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Materials & Procurement
                  </div>
                  <div className="space-y-1">
                    {materialsList.map((m) => (
                      <div
                        key={m.name}
                        onClick={() => {
                          onSelectModule('materials');
                          onClose();
                        }}
                        className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between cursor-pointer group transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-bold text-slate-900 group-hover:text-[#01875F]">
                            {m.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{m.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workforce Section */}
              {workforceList.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Workforce Personnel
                  </div>
                  <div className="space-y-1">
                    {workforceList.map((w) => (
                      <div
                        key={w.name}
                        onClick={() => {
                          onSelectModule('workforce');
                          onClose();
                        }}
                        className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between cursor-pointer group transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4 text-teal-600" />
                          <span className="text-xs font-bold text-slate-900 group-hover:text-[#01875F]">
                            {w.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{w.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Press ESC to close</span>
          <span>Davejoe Operations Index</span>
        </div>
      </div>
    </div>
  );
};
