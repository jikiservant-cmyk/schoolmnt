'use client';

import { useState, useEffect, useMemo } from 'react';
import { getAttendanceData, topUpBalance } from './actions';
import { 
  Clock, 
  Wallet, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  MessageSquare, 
  Calendar, 
  User, 
  Send, 
  Search, 
  X,
  CreditCard,
  Sparkles,
  ChevronRight,
  Smartphone,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function AttendancePage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Wallet / Top Up state
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpStep, setTopUpStep] = useState<'form' | 'waiting' | 'success'>('form');
  const [topUpAmount, setTopUpAmount] = useState<string>('50000');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [topUpMessage, setTopUpMessage] = useState('');
  const [initialBalance, setInitialBalance] = useState<number>(0);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  // Poll for balance updates when waiting for Mobile Money PIN confirmation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (showTopUpModal && topUpStep === 'waiting') {
      interval = setInterval(async () => {
        const data = await getAttendanceData();
        if (data?.school?.settings) {
          setSchool(data.school);
          const currentBal = data.school.settings.balance || 0;
          if (currentBal > initialBalance) {
            setTopUpStep('success');
            setTopUpMessage(`Payment received! New balance: ${currentBal.toLocaleString()} UGX`);
            if (interval) clearInterval(interval);
          }
        }
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showTopUpModal, topUpStep, initialBalance]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getAttendanceData();
      if (data.error) {
        setError(data.error);
      } else {
        setLogs(data.logs || []);
        setSchool(data.school || null);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const openTopUpModal = () => {
    setTopUpStep('form');
    setError(null);
    setInitialBalance(school?.settings?.balance || 0);
    setShowTopUpModal(true);
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(topUpAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!phoneNumber || phoneNumber.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

    setIsToppingUp(true);
    setError(null);
    const startBal = school?.settings?.balance || 0;
    setInitialBalance(startBal);

    try {
      const result = await topUpBalance(amountNum, phoneNumber);
      if (result.error) {
        setError(result.error);
      } else {
        setTopUpMessage(result.message || 'Prompt sent to your phone.');
        setTopUpStep('waiting');
      }
    } catch (err) {
      setError('An unexpected error occurred during top up.');
    } finally {
      setIsToppingUp(false);
    }
  };

  const handleQuickAmount = (amount: number) => {
    setTopUpAmount(amount.toString());
  };

  // Filter logs first
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const personName = log.people?.full_name || '';
      const matchesSearch = personName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

  // Group logs by date (YYYY-MM-DD)
  const groupedLogs = useMemo(() => {
    const map: { [key: string]: any[] } = {};
    
    filteredLogs.forEach(log => {
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
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    return Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const dayLogs = map[dateKey];
        const [y, m, d] = dateKey.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);

        let label = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        let badge = '';

        if (dateKey === todayKey) {
          label = 'Today';
          badge = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        } else if (dateKey === yesterdayKey) {
          label = 'Yesterday';
          badge = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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
  }, [filteredLogs]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin text-meridian-gold">
          <RefreshCw className="w-8 h-8" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const currentBalance = school?.settings?.balance || 0;
  const approxSMSCount = Math.floor(currentBalance / 50);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
      
      {/* Top Header Row with Wallet Section on the Top Right */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-meridian-panel border border-meridian-border p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-meridian-gold text-xs font-mono uppercase tracking-wider mb-1">
            <Clock className="w-4 h-4" /> Attendance & SMS Tracking
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-meridian-text-1">
            Attendance Logs
          </h1>
          <p className="text-sm text-meridian-text-3 mt-1 max-w-xl">
            Real-time daily attendance check-ins and parent SMS dispatch logs.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <a 
              href="/mark-attendance" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-meridian-border bg-meridian-background rounded-md text-xs font-medium text-meridian-text-1 hover:bg-meridian-panel-raised transition cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-meridian-text-3" />
              Open Terminal
            </a>
            <button
              onClick={() => {
                const url = `${window.location.origin}/mark-attendance`;
                navigator.clipboard.writeText(url);
                alert("Terminal link copied to clipboard! You can now paste and send this to teachers.");
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-meridian-gold/30 bg-meridian-gold/10 rounded-md text-xs font-medium text-meridian-gold hover:bg-meridian-gold/20 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Copy Link for Teachers
            </button>
          </div>
        </div>

        {/* Top-Right Wallet Section */}
        <div className="bg-[#1E3226] border border-[#2e4738] text-white p-4 sm:p-5 rounded-xl shadow-md flex flex-wrap sm:flex-nowrap items-center justify-between gap-5 min-w-[300px]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-meridian-gold/20 border border-meridian-gold/30 flex items-center justify-center text-meridian-gold shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-meridian-border flex items-center gap-1">
                <span>SMS Wallet Balance</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-white flex items-baseline gap-1.5 mt-0.5">
                <span>{currentBalance.toLocaleString()}</span>
                <span className="text-xs font-medium text-meridian-border">UGX</span>
              </div>
              <div className="text-[11px] text-meridian-gold flex items-center gap-1 mt-0.5 font-mono">
                <MessageSquare className="w-3 h-3" />
                <span>~{approxSMSCount.toLocaleString()} SMS credits</span>
              </div>
            </div>
          </div>

          <button
            onClick={openTopUpModal}
            className="w-full sm:w-auto px-4 py-2.5 bg-meridian-gold hover:bg-meridian-gold-dim text-white font-medium text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Top Up</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-meridian-panel-raised/50 p-4 rounded-xl border border-meridian-border">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-meridian-text-3" />
          <input
            type="text"
            placeholder="Search student or staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-meridian-border rounded-lg bg-meridian-background text-meridian-text-1 focus:outline-none focus:ring-1 focus:ring-meridian-gold"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 bg-meridian-background p-1 rounded-lg border border-meridian-border text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'all' ? 'bg-meridian-text-1 text-white shadow-xs' : 'text-meridian-text-3 hover:text-meridian-text-1'}`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'present' ? 'bg-meridian-gain text-white shadow-xs' : 'text-meridian-text-3 hover:text-meridian-text-1'}`}
            >
              Present
            </button>
            <button
              onClick={() => setStatusFilter('late')}
              className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'late' ? 'bg-meridian-gold text-white shadow-xs' : 'text-meridian-text-3 hover:text-meridian-text-1'}`}
            >
              Late
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-2 border border-meridian-border rounded-lg bg-meridian-background hover:bg-meridian-panel text-meridian-text-2 transition flex items-center justify-center cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Grouped by Date */}
      <div className="space-y-6">
        {groupedLogs.length > 0 ? (
          groupedLogs.map((group) => (
            <div key={group.dateKey} className="bg-meridian-panel border border-meridian-border rounded-xl shadow-xs overflow-hidden">
              {/* Date Header */}
              <div className="px-6 py-4 bg-meridian-panel-raised border-b border-meridian-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-meridian-text-1" />
                  <h2 className="font-serif font-medium text-lg text-meridian-text-1">
                    {group.label}
                  </h2>
                  {group.badge && (
                    <span className="px-2.5 py-0.5 text-xs font-mono font-medium bg-meridian-gold/20 text-meridian-text-1 border border-meridian-gold/30 rounded-full">
                      {group.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="px-2.5 py-1 bg-meridian-background rounded-md border border-meridian-border text-meridian-text-2">
                    Total: <strong className="text-meridian-text-1">{group.logs.length}</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-meridian-gain/10 border border-meridian-gain/20 text-meridian-gain rounded-md">
                    Present: <strong>{group.presentCount}</strong>
                  </span>
                  {group.lateCount > 0 && (
                    <span className="px-2.5 py-1 bg-meridian-gold/10 border border-meridian-gold/20 text-meridian-gold rounded-md">
                      Late: <strong>{group.lateCount}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Day Logs Content */}
              <div className="p-4 sm:p-6">
                {/* Mobile Card View */}
                <div className="space-y-3 md:hidden">
                  {group.logs.map((log) => {
                    const logTime = log.occurred_at 
                      ? new Date(log.occurred_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : '—';

                    return (
                      <div key={log.id} className="p-3.5 rounded-xl border border-meridian-border bg-meridian-panel-raised/40 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-meridian-border/50 flex items-center justify-center text-meridian-text-1 font-medium text-xs shrink-0">
                              <User className="w-4 h-4 text-meridian-text-2" />
                            </div>
                            <div>
                              <div className="font-medium text-meridian-text-1 text-sm">{log.people?.full_name || 'Unknown'}</div>
                              <div className="text-[10px] uppercase font-mono text-meridian-text-3">{log.people?.role || 'Student'}</div>
                            </div>
                          </div>
                          
                          <span className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md border inline-flex items-center gap-1 shrink-0 ${
                            log.status === 'present' 
                              ? 'bg-meridian-gain/10 border-meridian-gain/30 text-meridian-gain' 
                              : log.status === 'late'
                              ? 'bg-meridian-gold/10 border-meridian-gold/30 text-meridian-gold'
                              : 'bg-meridian-loss/10 border-meridian-loss/30 text-meridian-loss'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              log.status === 'present' ? 'bg-meridian-gain' : log.status === 'late' ? 'bg-meridian-gold' : 'bg-meridian-loss'
                            }`}></span>
                            {log.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-meridian-border/50 text-meridian-text-2">
                          <span className="text-[11px] text-meridian-text-3">{(log.attendance_type || 'check_in').replace(/_/g, ' ').toUpperCase()}</span>
                          <span className="text-meridian-text-1 font-semibold" suppressHydrationWarning>{logTime}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-meridian-gain">
                          <Send className="w-3 h-3 text-meridian-gain" />
                          <span>SMS Sent to Parent</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-meridian-text-2">
                    <thead className="bg-meridian-background/50 text-meridian-text-3 text-[11px] uppercase font-mono tracking-wider border-b border-meridian-border">
                      <tr>
                        <th className="px-6 py-3">Person</th>
                        <th className="px-6 py-3">Time</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Parent Notification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-meridian-border/60">
                      {group.logs.map((log) => {
                        const logTime = log.occurred_at 
                          ? new Date(log.occurred_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : '—';

                        return (
                          <tr key={log.id} className="hover:bg-meridian-panel-raised/80 transition">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-meridian-border/50 flex items-center justify-center text-meridian-text-1 font-medium text-xs">
                                  <User className="w-4 h-4 text-meridian-text-2" />
                                </div>
                                <div>
                                  <div className="font-medium text-meridian-text-1">{log.people?.full_name || 'Unknown'}</div>
                                  <div className="text-[10px] uppercase font-mono text-meridian-text-3">{log.people?.role || 'Student'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-meridian-text-1" suppressHydrationWarning>
                              {logTime}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md border inline-flex items-center gap-1 ${
                                log.status === 'present' 
                                  ? 'bg-meridian-gain/10 border-meridian-gain/30 text-meridian-gain' 
                                  : log.status === 'late'
                                  ? 'bg-meridian-gold/10 border-meridian-gold/30 text-meridian-gold'
                                  : 'bg-meridian-loss/10 border-meridian-loss/30 text-meridian-loss'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  log.status === 'present' ? 'bg-meridian-gain' : log.status === 'late' ? 'bg-meridian-gold' : 'bg-meridian-loss'
                                }`}></span>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono uppercase text-meridian-text-2">
                              {(log.attendance_type || 'check_in').replace(/_/g, ' ')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-xs font-mono text-meridian-gain">
                                <Send className="w-3.5 h-3.5 text-meridian-gain" />
                                <span>SMS Sent to Parent</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-meridian-panel border border-meridian-border rounded-xl p-12 text-center space-y-3">
            <Clock className="w-10 h-10 text-meridian-text-3 mx-auto" />
            <h3 className="font-serif text-lg text-meridian-text-1">No attendance logs found</h3>
            <p className="text-xs text-meridian-text-3 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters to see attendance records.'
                : 'Clock-in entries recorded by school staff will appear here grouped by day.'}
            </p>
          </div>
        )}
      </div>

      {/* Top Up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-meridian-panel border border-meridian-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-meridian-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-meridian-gold/20 flex items-center justify-center text-meridian-gold">
                  {topUpStep === 'waiting' ? (
                    <Smartphone className="w-5 h-5 animate-pulse" />
                  ) : topUpStep === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-meridian-gain" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-serif text-lg font-medium text-meridian-text-1">
                    {topUpStep === 'waiting' 
                      ? 'Enter PIN on Mobile Phone' 
                      : topUpStep === 'success' 
                        ? 'Payment Approved' 
                        : 'Top Up SMS Balance'}
                  </h3>
                  <p className="text-xs text-meridian-text-3">
                    {topUpStep === 'waiting'
                      ? 'Authorization prompt dispatched to your device'
                      : topUpStep === 'success'
                        ? 'Funds successfully added to school wallet'
                        : 'Add funds to send automated parent notifications'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowTopUpModal(false)}
                className="p-1 rounded-lg text-meridian-text-3 hover:text-meridian-text-1 hover:bg-meridian-border/50 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Summary Banner */}
            <div className="bg-[#1E3226] text-white p-4 rounded-xl border border-[#2e4738] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-meridian-border uppercase">Current Available Balance</div>
                <div className="text-xl font-bold font-mono text-white mt-0.5">
                  {currentBalance.toLocaleString()} <span className="text-xs font-normal text-meridian-border">UGX</span>
                </div>
              </div>
              <div className="text-right text-xs font-mono text-meridian-gold">
                ~{approxSMSCount.toLocaleString()} SMS
              </div>
            </div>

            {/* ERROR ALERT IF ANY */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: FORM */}
            {topUpStep === 'form' && (
              <form onSubmit={handleTopUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-meridian-text-2 uppercase tracking-wider mb-2">
                    Select Quick Amount (UGX)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[10000, 20000, 50000, 100000, 200000, 500000].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => handleQuickAmount(amount)}
                        className={`py-2 px-3 text-xs font-mono rounded-lg border transition cursor-pointer ${
                          topUpAmount === amount.toString()
                            ? 'bg-meridian-gold text-white border-meridian-gold font-bold shadow-xs'
                            : 'bg-meridian-background border-meridian-border text-meridian-text-1 hover:border-meridian-gold'
                        }`}
                      >
                        {amount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="topup-amount" className="block text-xs font-medium text-meridian-text-2 uppercase tracking-wider mb-2">
                    Custom Amount (UGX)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-meridian-text-3 text-xs font-mono">UGX</span>
                    </div>
                    <input
                      type="number"
                      id="topup-amount"
                      min="1000"
                      step="1000"
                      required
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="block w-full pl-14 pr-3 py-2.5 border border-meridian-border rounded-xl bg-meridian-background text-meridian-text-1 text-sm font-mono focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition"
                      placeholder="50000"
                    />
                  </div>
                  <p className="text-[11px] text-meridian-text-3 mt-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-meridian-gold" />
                    Provides approx {Math.floor((parseInt(topUpAmount) || 0) / 50).toLocaleString()} SMS messages to parents.
                  </p>
                </div>

                <div>
                  <label htmlFor="phone-number" className="block text-xs font-medium text-meridian-text-2 uppercase tracking-wider mb-2">
                    Mobile Money Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-meridian-text-3 text-xs font-mono">+256</span>
                    </div>
                    <input
                      type="tel"
                      id="phone-number"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="block w-full pl-14 pr-3 py-2.5 border border-meridian-border rounded-xl bg-meridian-background text-meridian-text-1 text-sm font-mono focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition"
                      placeholder="700000000"
                    />
                  </div>
                  <p className="text-[11px] text-meridian-text-3 mt-1.5 flex items-center gap-1">
                    You will receive a Mobile Money USSD prompt on your phone to complete payment.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="flex-1 py-2.5 border border-meridian-border rounded-xl text-xs font-medium text-meridian-text-2 hover:bg-meridian-panel-raised transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isToppingUp}
                    className="flex-1 py-2.5 bg-meridian-gold hover:bg-meridian-gold-dim text-white rounded-xl text-xs font-medium shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isToppingUp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm Top Up</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: WAITING FOR MOBILE MONEY PIN PROMPT */}
            {topUpStep === 'waiting' && (
              <div className="space-y-4 py-2 animate-fade-in text-center">
                {/* Visual Phone Radar Icon */}
                <div className="relative flex items-center justify-center py-3">
                  <div className="absolute w-20 h-20 bg-meridian-gold/20 rounded-full animate-ping" />
                  <div className="relative w-16 h-16 rounded-full bg-meridian-gold/10 border border-meridian-gold flex items-center justify-center text-meridian-gold shadow-lg">
                    <Smartphone className="w-8 h-8 animate-bounce" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="font-serif text-base font-semibold text-meridian-text-1">
                    Check Phone: Enter Mobile Money PIN
                  </h4>
                  <p className="text-xs text-meridian-text-2 max-w-xs mx-auto leading-relaxed">
                    A payment prompt of <strong className="text-meridian-gold font-mono">{parseInt(topUpAmount).toLocaleString()} UGX</strong> has been sent to <strong className="text-meridian-text-1 font-mono">+256 {phoneNumber}</strong>.
                  </p>
                </div>

                {/* Instructions Box */}
                <div className="bg-meridian-background/80 border border-meridian-border rounded-xl p-3.5 text-left text-xs space-y-2 text-meridian-text-2">
                  <div className="font-medium text-meridian-text-1 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-meridian-gold" />
                    <span>How to complete payment:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-meridian-text-3">
                    <li>Unlock your mobile phone screen.</li>
                    <li>Look for the USSD prompt asking to authorize <strong className="text-meridian-text-1">{parseInt(topUpAmount).toLocaleString()} UGX</strong>.</li>
                    <li>Enter your <strong>Mobile Money PIN</strong> and tap OK / Send.</li>
                  </ol>
                </div>

                {/* Live Polling Status */}
                <div className="flex items-center justify-center gap-2 text-xs font-mono text-meridian-gold bg-meridian-gold/10 py-2.5 px-3 rounded-xl border border-meridian-gold/30">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>Listening for Mobile Money confirmation...</span>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="flex-1 py-2.5 border border-meridian-border rounded-xl text-xs font-medium text-meridian-text-3 hover:text-meridian-text-1 hover:bg-meridian-panel-raised transition cursor-pointer"
                  >
                    Close Window
                  </button>

                  <button
                    type="button"
                    onClick={() => loadData()}
                    className="flex-1 py-2.5 bg-meridian-gold hover:bg-meridian-gold-dim text-white rounded-xl text-xs font-medium shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Check Balance Now</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS */}
            {topUpStep === 'success' && (
              <div className="space-y-4 py-3 animate-fade-in text-center">
                <div className="w-14 h-14 bg-meridian-gain/20 border border-meridian-gain/40 rounded-full flex items-center justify-center text-meridian-gain mx-auto shadow-md">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="font-serif text-lg font-semibold text-meridian-text-1">
                    Top Up Successful!
                  </h4>
                  <p className="text-xs text-meridian-gain font-medium">
                    {topUpMessage || `Successfully added ${parseInt(topUpAmount).toLocaleString()} UGX to school balance.`}
                  </p>
                </div>

                <div className="bg-meridian-gain/10 border border-meridian-gain/20 rounded-xl p-3 text-xs text-meridian-text-2">
                  <span>Your new school SMS balance is </span>
                  <strong className="text-meridian-gain font-mono text-sm">{currentBalance.toLocaleString()} UGX</strong>.
                </div>

                <button
                  type="button"
                  onClick={() => setShowTopUpModal(false)}
                  className="w-full py-2.5 bg-meridian-gold hover:bg-meridian-gold-dim text-white rounded-xl text-xs font-medium shadow-sm transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

