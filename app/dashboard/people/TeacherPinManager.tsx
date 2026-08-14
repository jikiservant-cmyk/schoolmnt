'use client';

import { useState } from 'react';
import { KeyRound, Copy, Check, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { resetTeacherPinAction } from './actions';

interface TeacherPinManagerProps {
  personId: string;
  fullName: string;
}

export default function TeacherPinManager({ personId, fullName }: TeacherPinManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    setIsPending(true);
    setErrorMsg(null);
    try {
      const res = await resetTeacherPinAction(personId);
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.success && res.newPin) {
        setGeneratedPin(res.newPin);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to reset passcode');
    } finally {
      setIsPending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setIsOpen(false);
    setGeneratedPin(null);
    setErrorMsg(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-meridian-deep hover:bg-meridian-panel-raised border border-meridian-border hover:border-meridian-gold/50 text-meridian-text-2 hover:text-meridian-gold text-[11px] font-mono rounded-md transition-all cursor-pointer shadow-xs"
        title="Reset & View Passcode"
      >
        <KeyRound className="w-3 h-3 text-meridian-gold shrink-0" />
        <span>Passcode</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-meridian-panel border border-meridian-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            {/* Close button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 text-meridian-text-3 hover:text-meridian-text-1 p-1 rounded-lg hover:bg-meridian-deep transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="space-y-1 pr-6">
              <div className="flex items-center gap-2 text-meridian-gold font-serif text-xl font-medium">
                <KeyRound className="w-5 h-5 shrink-0" />
                Teacher Attendance Passcode
              </div>
              <p className="text-xs text-meridian-text-3 font-mono">
                Faculty Member: <strong className="text-meridian-text-1">{fullName}</strong>
              </p>
            </div>

            {/* Content area */}
            {generatedPin ? (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 bg-meridian-deep border border-meridian-gold/40 rounded-xl space-y-3 text-center">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-meridian-gold font-bold">
                    New Generated Attendance Passcode / PIN
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <div className="font-mono text-3xl font-bold tracking-widest text-meridian-gold bg-meridian-panel border border-meridian-border px-5 py-2.5 rounded-xl select-all shadow-inner">
                      {generatedPin}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedPin)}
                      className="p-3 bg-meridian-gold hover:bg-meridian-gold-dim text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                      title="Copy Passcode"
                    >
                      {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  {copied && (
                    <div className="text-[11px] text-emerald-600 font-mono font-medium animate-fade-in">
                      ✓ Passcode copied to clipboard!
                    </div>
                  )}

                  <p className="text-[11px] font-mono text-meridian-text-3 text-left leading-relaxed pt-2 border-t border-meridian-border/50">
                    • Hand this passcode over to <strong>{fullName}</strong>.<br />
                    • They will enter this PIN at <code className="text-meridian-gold font-semibold">/mark-attendance</code> to log class records.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 bg-meridian-gold hover:bg-meridian-gold-dim text-white text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 bg-meridian-deep border border-meridian-border rounded-xl text-xs text-meridian-text-2 space-y-2 leading-relaxed">
                  <div className="font-semibold text-meridian-gold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    How Teacher Passcodes Work
                  </div>
                  <p className="text-meridian-text-3">
                    Passcodes are stored as secure one-way hashes for safety. If a teacher forgets their PIN, you can issue a <strong>new passcode</strong> immediately.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-mono">
                    {errorMsg}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3.5 py-2 bg-meridian-deep hover:bg-meridian-panel-raised border border-meridian-border text-meridian-text-2 text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-meridian-gold hover:bg-meridian-gold-dim text-white text-xs font-mono rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Generating New PIN...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        Generate & Reveal New PIN
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
