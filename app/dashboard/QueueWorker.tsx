'use client';

import { useState, useTransition } from 'react';
import { Mail, RefreshCw, Send, CheckCircle, Clock, AlertTriangle, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { processPendingNotificationsAction } from './actions';

interface NotificationItem {
  id: string;
  recipient_phone_snapshot: string | null;
  message: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  provider_response?: string | null;
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'unknown';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey: string, sampleDateStr: string): string {
  const now = new Date();
  const todayKey = getDateKey(now.toISOString());
  
  const y = new Date(now);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterdayKey = getDateKey(y.toISOString());

  const sampleDate = new Date(sampleDateStr);
  const formatted = sampleDate.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  if (dateKey === todayKey) {
    return `Today (${formatted})`;
  } else if (dateKey === yesterdayKey) {
    return `Yesterday (${formatted})`;
  } else {
    return formatted;
  }
}

export default function QueueWorker({ 
  notifications: initialNotifications 
}: { 
  notifications: NotificationItem[] 
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Group notifications by date key YYYY-MM-DD
  const groupsMap: Record<string, { label: string; dateKey: string; items: NotificationItem[] }> = {};

  initialNotifications.forEach((n) => {
    const key = getDateKey(n.created_at);
    if (!groupsMap[key]) {
      groupsMap[key] = {
        dateKey: key,
        label: formatDateLabel(key, n.created_at),
        items: []
      };
    }
    groupsMap[key].items.push(n);
  });

  const sortedKeys = Object.keys(groupsMap).sort((a, b) => b.localeCompare(a));
  const todayKey = getDateKey(new Date().toISOString());

  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (sortedKeys.length > 0) {
      if (sortedKeys.includes(todayKey)) {
        initial.add(todayKey);
      } else {
        initial.add(sortedKeys[0]);
      }
    }
    return initial;
  });

  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleRunWorker = () => {
    setError(null);
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await processPendingNotificationsAction();
        if (res && res.error) {
          setError(res.error);
        } else if (res) {
          setFeedback(res.message || 'Queue processed.');
          setTimeout(() => setFeedback(null), 5000);
        }
      } catch (err: any) {
        setError(err?.message || 'A worker dispatch network error occurred. Please try again.');
      }
    });
  };

  const pendingCount = initialNotifications.filter(n => n.status === 'pending').length;

  return (
    <div className="bg-meridian-panel border border-meridian-border rounded-2xl p-6 space-y-6">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-meridian-border">
        <div>
          <h3 className="font-serif text-lg font-medium text-meridian-text-1 flex items-center gap-2">
            <Mail className="w-5 h-5 text-meridian-gold" />
            Outbound SMS Logs by Date
          </h3>
          <p className="text-[11px] text-meridian-text-3 font-mono mt-0.5">
            Organized Notification Queue &middot; school.notifications
          </p>
        </div>
        
        {/* Queue Status Badge */}
        {pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-semibold text-meridian-gold bg-[#FCF5E3] border border-meridian-gold/30 rounded-lg">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            {pendingCount} PENDING
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-semibold text-meridian-gain bg-[#E1EAD9] border border-meridian-gain/30 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5" />
            QUEUE CLEAR
          </span>
        )}
      </div>

      {/* Queue telemetry notice */}
      {pendingCount > 0 ? (
        <div className="p-3.5 bg-meridian-gold/10 border border-meridian-gold/30 rounded-xl flex items-start gap-2.5 animate-fade-in">
          <Clock className="w-4 h-4 text-meridian-gold shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="text-xs font-mono font-semibold text-meridian-gold uppercase">
              {pendingCount} SMS Notification{pendingCount > 1 ? 's' : ''} Pending in Database!
            </p>
            <p className="text-[11px] text-meridian-text-2 mt-0.5">
              The biometrics terminal wrote the attendance fact and queued these alerts for delivery.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-meridian-panel-raised/40 border border-meridian-border/50 rounded-xl flex items-start gap-2.5">
          <CheckCircle className="w-4 h-4 text-meridian-gain shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-mono font-semibold text-meridian-gain uppercase">
              Outbound Queue is Clear
            </p>
            <p className="text-[11px] text-meridian-text-3 mt-0.5">
              All messages processed successfully. Test this by using the <strong className="font-mono text-[10px] text-meridian-gold bg-meridian-panel px-1 py-0.2 rounded border border-meridian-border">Terminal Emulator</strong> to clock in a student.
            </p>
          </div>
        </div>
      )}

      {/* Success & error banners */}
      {feedback && (
        <div className="p-3 text-xs font-mono text-meridian-gain bg-[#E1EAD9] border border-[#CBD8C1] rounded-lg animate-fade-in">
          {feedback}
        </div>
      )}
      {error && (
        <div className="p-3 text-xs font-mono text-meridian-loss bg-[#F7EBE8] border border-[#EAC2BA] rounded-lg animate-fade-in">
          {error}
        </div>
      )}

      {/* Grouped Queue Items */}
      {sortedKeys.length > 0 ? (
        <div className="space-y-3">
          {sortedKeys.map((key) => {
            const group = groupsMap[key];
            const isOpen = openKeys.has(key);
            const isToday = key === todayKey;
            const groupSent = group.items.filter(i => i.status === 'sent').length;
            const groupPending = group.items.filter(i => i.status === 'pending').length;

            return (
              <div 
                key={key} 
                className="border border-meridian-border rounded-xl overflow-hidden bg-meridian-panel-raised/20 transition-all duration-150"
              >
                {/* Date Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleKey(key)}
                  className={`w-full flex items-center justify-between p-4 text-left transition-colors cursor-pointer select-none ${
                    isOpen 
                      ? 'bg-meridian-panel-raised/80 border-b border-meridian-border' 
                      : 'hover:bg-meridian-panel-raised/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg border ${
                      isToday 
                        ? 'bg-meridian-gold/15 text-meridian-gold border-meridian-gold/30' 
                        : 'bg-meridian-deep text-meridian-text-3 border-meridian-border'
                    }`}>
                      <Calendar className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-medium text-sm text-meridian-text-1" suppressHydrationWarning>
                          {group.label}
                        </span>
                        {isToday && (
                          <span className="text-[9px] font-mono uppercase tracking-wider bg-meridian-gold/20 text-meridian-gold border border-meridian-gold/40 px-1.5 py-0.2 rounded font-semibold">
                            Today
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-meridian-text-3 mt-0.5">
                        {group.items.length} Message{group.items.length > 1 ? 's' : ''} &middot; {groupSent} Dispatched {groupPending > 0 ? `· ${groupPending} Pending` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-meridian-text-3 bg-meridian-deep border border-meridian-border px-2.5 py-1 rounded-full">
                      {group.items.length} SMS
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-meridian-text-2" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-meridian-text-3" />
                    )}
                  </div>
                </button>

                {/* Notifications List inside Date Group */}
                {isOpen && (
                  <div className="p-4 space-y-2 bg-meridian-panel max-h-96 overflow-y-auto">
                    {group.items.map((n) => {
                      const isPendingItem = n.status === 'pending';
                      const isSentItem = n.status === 'sent';
                      
                      let providerMeta = null;
                      if (n.provider_response) {
                        try {
                          providerMeta = JSON.parse(n.provider_response);
                        } catch {
                          // Fallback if not JSON
                        }
                      }

                      return (
                        <div 
                          key={n.id} 
                          className={`p-3.5 rounded-xl border transition-colors duration-150 ${
                            isPendingItem 
                              ? 'bg-[#FCFAF2] border-meridian-gold/20' 
                              : 'bg-meridian-panel-raised/40 border-meridian-border/50'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-mono font-bold text-meridian-text-2 bg-meridian-deep px-2 py-0.5 rounded border border-meridian-border">
                                  {n.recipient_phone_snapshot || 'Unknown Phone'}
                                </span>
                                <span className="text-[10px] font-mono text-meridian-text-3" suppressHydrationWarning>
                                  Queued: {new Date(n.created_at).toLocaleTimeString('en-US', { hour12: true })}
                                </span>
                                {isSentItem && n.sent_at && (
                                  <span className="text-[10px] font-mono text-meridian-text-3" suppressHydrationWarning>
                                    Sent: {new Date(n.sent_at).toLocaleTimeString('en-US', { hour12: true })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-meridian-text-1 italic font-serif">
                                &ldquo;{n.message}&rdquo;
                              </p>
                              
                              {providerMeta && (
                                <div className="flex flex-wrap items-center gap-x-2 text-[9px] font-mono text-meridian-text-3 mt-1.5 pt-1.5 border-t border-meridian-border/40">
                                  <span>Gateway: <span className="text-meridian-text-2">{providerMeta.provider}</span></span>
                                  <span>&bull;</span>
                                  <span>ID: <span className="text-meridian-text-2 font-semibold">{providerMeta.message_id}</span></span>
                                  <span>&bull;</span>
                                  <span>Charge: <span className="text-meridian-text-2">{providerMeta.cost}</span></span>
                                </div>
                              )}
                            </div>

                            <div className="shrink-0">
                              {isPendingItem ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono font-semibold tracking-wider text-meridian-gold bg-[#FCF5E3] border border-meridian-gold/30 rounded-lg animate-pulse">
                                  <Clock className="w-3 h-3" />
                                  PENDING
                                </span>
                              ) : isSentItem ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono font-semibold tracking-wider text-meridian-gain bg-[#E1EAD9] border border-meridian-gain/30 rounded-lg">
                                  <CheckCircle className="w-3 h-3" />
                                  DISPATCHED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono font-semibold tracking-wider text-meridian-loss bg-[#F7EBE8] border border-meridian-loss/30 rounded-lg">
                                  <AlertTriangle className="w-3 h-3" />
                                  FAILED
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 px-4 border border-dashed border-meridian-border rounded-xl font-mono text-xs text-meridian-text-3">
          No notification events logged in database.
        </div>
      )}

    </div>
  );
}
