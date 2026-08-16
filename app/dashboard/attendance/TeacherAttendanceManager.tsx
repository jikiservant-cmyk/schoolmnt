'use client';

import React, { useState, useMemo } from 'react';
import { 
  Briefcase, 
  Clock, 
  Search, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  UserCheck, 
  Smartphone, 
  X,
  Phone,
  Send,
  User,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { markTeacherAttendanceAction } from './actions';

interface TeacherAttendanceManagerProps {
  logs: any[];
  teachers: any[];
  onRefresh: () => void;
}

export default function TeacherAttendanceManager({
  logs,
  teachers,
  onRefresh
}: TeacherAttendanceManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late'>('all');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [customStatus, setCustomStatus] = useState<'present' | 'late'>('present');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Filter logs for teachers/staff only
  const teacherLogs = useMemo(() => {
    return logs.filter(log => {
      const role = log.people?.role;
      return role === 'teacher' || role === 'admin';
    });
  }, [logs]);

  // Filtered by search and status
  const filteredTeacherLogs = useMemo(() => {
    return teacherLogs.filter(log => {
      const name = log.people?.full_name || '';
      const phone = log.people?.phone || '';
      const uid = log.people?.device_user_id || '';
      const q = searchTerm.toLowerCase();

      const matchesSearch = 
        name.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q) ||
        uid.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [teacherLogs, searchTerm, statusFilter]);

  // Group logs by date (YYYY-MM-DD)
  const groupedTeacherLogs = useMemo(() => {
    const map: { [key: string]: any[] } = {};

    filteredTeacherLogs.forEach(log => {
      if (!log.occurred_at) return;
      const dateObj = new Date(log.occurred_at);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(log);
    });

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    return Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const dayLogs = map[dateKey];
        const dateObj = new Date(dateKey + 'T00:00:00');

        let label = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        let badge = '';
        if (dateKey === todayKey) {
          badge = 'Today';
        } else if (dateKey === yesterdayKey) {
          badge = 'Yesterday';
        }

        const presentCount = dayLogs.filter(l => l.status === 'present').length;
        const lateCount = dayLogs.filter(l => l.status === 'late').length;

        return {
          dateKey,
          label,
          badge,
          logs: dayLogs,
          presentCount,
          lateCount
        };
      });
  }, [filteredTeacherLogs]);

  const handleRecordTeacherClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) return;

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      const res = await markTeacherAttendanceAction(selectedTeacherId, customStatus);
      if (res.error) {
        setActionMessage(res.error);
      } else {
        setShowCheckInModal(false);
        setSelectedTeacherId('');
        onRefresh();
      }
    } catch {
      setActionMessage('Failed to record teacher attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Filter and Action Bar */}
      <div className="bg-white border border-[#e7e7ea] p-4 rounded-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#929297]" />
          <input
            type="text"
            placeholder="Search teacher by name or UID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-xs border border-[#e1e1e5] rounded-[9px] bg-[#fafafa] focus:bg-white text-[#171719] placeholder:text-[#96969b] focus:outline-none focus:border-[#007aff] transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#929297] hover:text-[#171719]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-[#f5f5f7] p-1 rounded-[9px] border border-[#e7e7ea] text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-[6px] transition text-xs font-medium cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-[#171719] shadow-2xs font-semibold'
                  : 'text-[#85858a] hover:text-[#171719]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1 rounded-[6px] transition text-xs font-medium cursor-pointer ${
                statusFilter === 'present'
                  ? 'bg-white text-[#30b357] shadow-2xs font-semibold'
                  : 'text-[#85858a] hover:text-[#171719]'
              }`}
            >
              Present
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('late')}
              className={`px-3 py-1 rounded-[6px] transition text-xs font-medium cursor-pointer ${
                statusFilter === 'late'
                  ? 'bg-white text-[#f5a30a] shadow-2xs font-semibold'
                  : 'text-[#85858a] hover:text-[#171719]'
              }`}
            >
              Late
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (teachers.length > 0) {
                setSelectedTeacherId(teachers[0].id);
              }
              setShowCheckInModal(true);
            }}
            className="h-9 px-3 bg-[#007aff] hover:bg-[#0062cc] text-white rounded-[9px] text-xs font-medium flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Clock In Faculty</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="w-9 h-9 border border-[#e1e1e5] rounded-[9px] bg-white hover:bg-[#f7f7f8] text-[#5e5e63] transition flex items-center justify-center cursor-pointer shadow-2xs"
            title="Refresh faculty attendance logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Date-Grouped Teacher Attendance Logs */}
      <div className="space-y-5">
        {groupedTeacherLogs.length > 0 ? (
          groupedTeacherLogs.map((group) => (
            <div 
              key={group.dateKey} 
              className="bg-white border border-[#e7e7ea] rounded-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden"
            >
              {/* Date Header */}
              <div className="px-5 py-3.5 bg-[#fafafa] border-b border-[#f1f1f4] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#85858a]" />
                  <h2 className="font-bold text-xs text-[#171719]">
                    {group.label}
                  </h2>
                  {group.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#edf5ff] text-[#007aff] rounded-full">
                      {group.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 bg-white rounded-md border border-[#e7e7ea] text-[#85858a] text-[11px]">
                    Total Checked-In: <strong className="text-[#171719]">{group.logs.length}</strong>
                  </span>
                  <span className="px-2.5 py-0.5 bg-[#edf9f0] border border-[#d2f4d9] text-[#2da94f] rounded-md text-[11px]">
                    On-Time: <strong>{group.presentCount}</strong>
                  </span>
                  {group.lateCount > 0 && (
                    <span className="px-2.5 py-0.5 bg-[#fff5e7] border border-[#ffe0b2] text-[#f5a30a] rounded-md text-[11px]">
                      Late: <strong>{group.lateCount}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Table Container with Horizontal Scrolling */}
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#f1f1f4] text-[10px] uppercase font-semibold tracking-wider text-[#929297]">
                      <th className="py-3 px-5 whitespace-nowrap">Faculty Member</th>
                      <th className="py-3 px-4 whitespace-nowrap">Arrival Time</th>
                      <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 whitespace-nowrap">Verification Source</th>
                      <th className="py-3 px-4 whitespace-nowrap">Hardware UID</th>
                      <th className="py-3 px-5 whitespace-nowrap text-right">Contact Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f7f7f9]">
                    {group.logs.map((log) => {
                      const logTime = log.occurred_at 
                        ? new Date(log.occurred_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                        : '—';
                      
                      const personName = log.people?.full_name || 'Faculty Member';
                      const initials = personName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase();

                      return (
                        <tr key={log.id} className="hover:bg-[#fbfbfd] transition">
                          <td className="py-3 px-5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#171719] text-white flex items-center justify-center font-bold text-[10px]">
                                {initials}
                              </div>
                              <div>
                                <div className="font-semibold text-[#171719] text-xs">{personName}</div>
                                <div className="text-[10px] text-[#007aff] font-medium capitalize">
                                  {log.people?.role === 'admin' ? 'School Administrator' : 'Teacher / Faculty'}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-[#171719]" suppressHydrationWarning>
                            {logTime}
                          </td>
                          
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                              log.status === 'present'
                                ? 'bg-[#edf9f0] text-[#2da94f]'
                                : log.status === 'late'
                                ? 'bg-[#fff5e7] text-[#f5a30a]'
                                : 'bg-[#fff0ef] text-[#ef4444]'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                log.status === 'present' ? 'bg-[#30b357]' : log.status === 'late' ? 'bg-[#f5a30a]' : 'bg-[#ef4444]'
                              }`} />
                              <span className="capitalize">{log.status === 'present' ? 'On-Time' : 'Late Arrival'}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-xs text-[#5e5e63]">
                            <span className="capitalize">
                              {(log.attendance_type || 'ZKTeco Clock-In').replace(/_/g, ' ')}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-[#85858a]">
                            {log.people?.device_user_id || 'ZK-100'}
                          </td>

                          <td className="py-3 px-5 whitespace-nowrap text-right text-xs text-[#85858a] font-mono">
                            {log.people?.phone || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white border border-[#e7e7ea] rounded-[14px] p-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-2">
            <Briefcase className="w-8 h-8 text-[#929297] mx-auto" />
            <h3 className="text-sm font-bold text-[#171719]">No teacher attendance recorded yet</h3>
            <p className="text-xs text-[#85858a] max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search query or status filter.'
                : 'Teachers clocking in via the biometric scanner, kiosk terminal, or manual register will automatically appear here grouped by day.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (teachers.length > 0) setSelectedTeacherId(teachers[0].id);
                  setShowCheckInModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#007aff] text-white rounded-[8px] text-xs font-medium shadow-2xs hover:bg-[#0062cc] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Clock In Faculty Now</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clock In Teacher Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-[#171719]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e7e7ea] rounded-[16px] max-w-md w-full p-6 shadow-2xl space-y-4 relative animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f1f4]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#edf5ff] border border-[#d6e7ff] flex items-center justify-center text-[#007aff]">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#171719]">
                    Record Faculty Clock-In
                  </h3>
                  <p className="text-[11px] text-[#85858a]">
                    Register attendance arrival for a faculty member
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCheckInModal(false)}
                className="p-1 rounded-lg text-[#929297] hover:text-[#171719] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionMessage && (
              <div className="bg-[#fff0ef] border border-[#fbd1cf] text-[#ef4444] text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionMessage}</span>
              </div>
            )}

            <form onSubmit={handleRecordTeacherClockIn} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#171719] mb-1.5">
                  Select Teacher / Faculty Member
                </label>
                <select
                  required
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-[#e1e1e5] rounded-[9px] text-xs text-[#171719] focus:outline-none focus:border-[#007aff]"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.role}) {t.device_user_id ? `— UID: ${t.device_user_id}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#171719] mb-1.5">
                  Arrival Status (Automatic based on 8:00 AM cutoff)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomStatus('present')}
                    className={`py-2 px-3 rounded-[8px] text-xs font-medium border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      customStatus === 'present'
                        ? 'bg-[#edf9f0] border-[#30b357] text-[#2da94f] font-semibold shadow-2xs'
                        : 'bg-white border-[#e1e1e5] text-[#5e5e63]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#30b357]" />
                    <span>On-Time (Present)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomStatus('late')}
                    className={`py-2 px-3 rounded-[8px] text-xs font-medium border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      customStatus === 'late'
                        ? 'bg-[#fff5e7] border-[#f5a30a] text-[#f5a30a] font-semibold shadow-2xs'
                        : 'bg-white border-[#e1e1e5] text-[#5e5e63]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-[#f5a30a]" />
                    <span>Late Arrival</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="flex-1 h-9 border border-[#e1e1e5] rounded-[8px] text-xs font-medium text-[#5e5e63] hover:bg-[#f7f7f8] transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-9 bg-[#007aff] hover:bg-[#0062cc] text-white rounded-[8px] text-xs font-medium shadow-2xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Clock-In</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
