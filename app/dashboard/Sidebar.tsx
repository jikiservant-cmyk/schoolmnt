'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  GraduationCap, 
  Users, 
  Smartphone, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Clock,
  Fingerprint
} from 'lucide-react';

interface SidebarProps {
  schoolName: string;
  adminName: string;
  initials: string;
}

export default function Sidebar({ schoolName, adminName, initials }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/classes', label: 'Classes', shortLabel: 'Classes', icon: GraduationCap },
    { href: '/dashboard/people', label: 'People', shortLabel: 'People', icon: Users },
    { href: '/dashboard/devices', label: 'Devices', shortLabel: 'Devices', icon: Smartphone },
    { href: '/dashboard/attendance', label: 'Attendance', shortLabel: 'Logs', icon: Clock },
  ];

  const handleLinkClick = () => {
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            S
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 tracking-tight">
              SmartSkoolz
            </div>
            <div className="text-xs text-slate-500 truncate max-w-[140px]">
              {schoolName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/mark-attendance" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold active:scale-95 transition"
          >
            <Fingerprint className="w-4 h-4" />
            <span>Kiosk</span>
          </Link>
          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer transition active:scale-95"
            title={isMobileOpen ? "Close Menu" : "Account & Settings"}
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 shadow-lg px-2 flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={`flex flex-col items-center justify-center w-full h-full py-1 text-xs font-medium transition-all duration-150 ${
                isActive 
                  ? 'text-emerald-700 font-semibold' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}`}>
                <Icon className="w-5 h-5 shrink-0" />
              </div>
              <span className="mt-0.5 tracking-tight text-[11px]">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Aside Drawer (Mobile slide-over & Desktop sidebar) */}
      <aside 
        className={`bg-white border-r border-slate-200 flex flex-col justify-between p-5 shrink-0 transition-all duration-300 ease-in-out
          /* Mobile: Drawer layout */
          fixed inset-y-0 left-0 z-50 w-64 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          /* Desktop: Normal column */
          md:relative md:translate-x-0 md:h-screen md:sticky md:top-0 ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        {/* Collapse Toggle Button (Desktop only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 w-6 h-6 rounded-full items-center justify-center cursor-pointer transition shadow-xs z-50 hover:scale-105 active:scale-95"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="space-y-8 overflow-hidden">
          {/* Logo / Brand Header */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              S
            </div>
            <div className={`whitespace-nowrap overflow-hidden ${isCollapsed ? 'md:hidden' : 'block'}`}>
              <div className="font-bold text-base text-slate-900 tracking-tight">
                SmartSkoolz
              </div>
              <div className="text-xs text-slate-500 truncate max-w-[150px]">
                {schoolName}
              </div>
            </div>
          </div>

          {/* Navigation Items (Desktop) */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.href}
                  href={item.href} 
                  onClick={handleLinkClick}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title={(isCollapsed && !isMobileOpen) ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
                  <span className={`whitespace-nowrap ${isCollapsed ? 'md:hidden' : 'block'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Active Admin profile & Logout */}
        <div className="pt-4 border-t border-slate-200 space-y-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 uppercase shrink-0">
              {initials}
            </div>
            <div className={`min-w-0 flex-1 whitespace-nowrap overflow-hidden ${isCollapsed ? 'md:hidden' : 'block'}`}>
              <div className="text-xs font-semibold text-slate-900 truncate">{adminName}</div>
              <div className="text-[11px] text-slate-500 truncate">
                School Admin
              </div>
            </div>
          </div>

          <form action="/api/logout" method="POST">
            <button 
              type="submit" 
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-rose-600 transition duration-150 cursor-pointer"
              title={(isCollapsed && !isMobileOpen) ? "Sign Out" : undefined}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className={`whitespace-nowrap ${isCollapsed ? 'md:hidden' : 'block'}`}>
                Sign Out
              </span>
            </button>
          </form>

          <div className={`pt-1 text-center text-[11px] text-slate-400 ${isCollapsed ? 'md:hidden' : 'block'}`}>
            Na&apos;Jiki Attendance System
          </div>
        </div>
      </aside>
    </>
  );
}
