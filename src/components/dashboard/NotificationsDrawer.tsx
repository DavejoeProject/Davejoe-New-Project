import React from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, Package, ShieldAlert, ArrowRight } from 'lucide-react';
import { NavigationModule } from './Sidebar';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
  type: 'alert' | 'approval' | 'qc' | 'info';
  module: NavigationModule;
}

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSelectNotification: (item: NotificationItem) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onSelectNotification,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-sm h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#01875F]" />
            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
            {notifications.filter((n) => n.unread).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                {notifications.filter((n) => n.unread).length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="text-[11px] font-semibold text-[#01875F] hover:underline cursor-pointer"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectNotification(item);
                onClose();
              }}
              className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer text-left flex gap-3 ${
                item.unread ? 'bg-[#01875F]/5' : ''
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {item.type === 'alert' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                {item.type === 'qc' && <ShieldAlert className="w-4 h-4 text-red-500" />}
                {item.type === 'approval' && <Package className="w-4 h-4 text-[#01875F]" />}
                {item.type === 'info' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">{item.title}</h4>
                  <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
          Davejoe Operational Alert System
        </div>
      </div>
    </div>
  );
};
