'use client';

import { useState, useTransition } from 'react';
import { addPersonAction } from './actions';
import { Plus, HelpCircle, Check, Copy, ExternalLink, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';

interface SchoolClass {
  id: string;
  name: string;
}

export default function AddPersonForm({ classes }: { classes: SchoolClass[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  // Custom success state to hold returned DB payload (tokens, etc.)
  const [successData, setSuccessData] = useState<{
    role: 'student' | 'teacher';
    fullName: string;
    guardianLinked?: boolean;
    manualLinkToken?: string;
    manualLinkExpiresAt?: string;
    teacherPin?: string | null;
  } | null>(null);

  const [selectedRole, setSelectedRole] = useState<string>('student');
  const [selectedTeacherClasses, setSelectedTeacherClasses] = useState<string[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessData(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const res = await addPersonAction(formData);
        if (res && res.error) {
          setError(res.error);
        } else if (res && res.success) {
          const resData = res.data as any;
          
          // Capture and store success info from DB RPC payload
          setSuccessData({
            role: selectedRole as 'student' | 'teacher',
            fullName: formData.get('fullName') as string,
            guardianLinked: resData?.guardian_linked,
            manualLinkToken: resData?.manual_link_token,
            manualLinkExpiresAt: resData?.manual_link_expires_at,
            teacherPin: res?.teacherPin,
          });

          form.reset();
          setSelectedTeacherClasses([]);
        }
      } catch (err: any) {
        setError(err?.message || 'A network error occurred. Please try again.');
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render detailed success panel if a person was successfully registered
  if (successData) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const manualLink = successData.manualLinkToken 
      ? `${origin}/mark/${successData.manualLinkToken}` 
      : '';

    return (
      <div className="bg-meridian-panel border border-meridian-border rounded-xl p-6 h-fit sticky top-6 animate-fade-in space-y-6">
        <div className="pb-3 border-b border-meridian-border">
          <div className="w-10 h-10 rounded-full bg-meridian-gold/15 border border-meridian-gold/30 flex items-center justify-center text-meridian-gold mb-3">
            <Check className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-lg font-medium text-meridian-text-1">
            Registry Complete
          </h3>
          <p className="text-[10px] font-mono uppercase tracking-wider text-meridian-text-3 mt-1">
            Inscribed Successfully
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-meridian-panel-raised/50 border border-meridian-border/50 rounded-lg p-3.5 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-meridian-text-3">
              Registered Profile
            </div>
            <div className="font-serif text-base font-semibold text-meridian-text-1">
              {successData.fullName}
            </div>
            <div className="inline-flex text-[10px] font-mono uppercase tracking-widest bg-meridian-deep px-2 py-0.5 rounded text-meridian-gold">
              {successData.role}
            </div>
          </div>

          {/* Student Specific Details */}
          {successData.role === 'student' && (
            <div className="space-y-3">
              {successData.guardianLinked ? (
                <div className="p-3 text-xs bg-meridian-gold/10 border border-meridian-gold/20 text-meridian-text-2 rounded-lg leading-relaxed flex gap-2">
                  <Check className="w-4 h-4 text-meridian-gold shrink-0 mt-0.5" />
                  <span>Guardian linked and daily attendance SMS alert routing configured.</span>
                </div>
              ) : (
                <div className="p-3 text-xs bg-meridian-loss/10 border border-meridian-loss/20 text-meridian-loss rounded-lg leading-relaxed flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-meridian-loss shrink-0 mt-0.5" />
                  <span>No guardian phone provided — attendance SMS won&apos;t be sent until one is linked.</span>
                </div>
              )}
            </div>
          )}          {/* Teacher Specific Details (PIN display + Link) */}
          {successData.role === 'teacher' && (
            <div className="space-y-4 animate-fade-in">
              {/* Auto-Generated Teacher Attendance PIN */}
              {successData.teacherPin && (
                <div className="p-4 bg-meridian-deep border border-meridian-gold/40 rounded-xl space-y-2 text-center shadow-sm">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-meridian-gold font-bold">
                    Auto-Generated Attendance PIN / Passcode
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <div className="font-mono text-2xl font-bold tracking-widest text-meridian-gold bg-meridian-panel border border-meridian-border px-4 py-2 rounded-lg select-all">
                      {successData.teacherPin}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.teacherPin!)}
                      className="p-2.5 bg-meridian-gold hover:bg-meridian-gold-dim text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                      title="Copy Teacher PIN"
                    >
                      {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-meridian-text-3 text-left leading-relaxed pt-1">
                    • Give this unique passcode to <strong>{successData.fullName}</strong>. They will use it to log in and mark class attendance.<br />
                    • Passcodes are system-generated (letters & numbers) and strictly unique across all teachers.
                  </p>
                </div>
              )}

              {manualLink && (
                <div className="p-3 text-xs bg-meridian-deep border border-meridian-border text-meridian-text-2 rounded-lg leading-relaxed space-y-2">
                  <div className="font-semibold text-meridian-gold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Direct Attendance Token Link
                  </div>
                  <p className="text-[11px] text-meridian-text-3">
                    Share this unique token link with the teacher for quick manual attendance marking:
                  </p>
                  
                  {/* Input box with copy action */}
                  <div className="flex gap-1.5 mt-2">
                    <input
                      type="text"
                      readOnly
                      value={manualLink}
                      className="w-full bg-meridian-panel-raised border border-meridian-border text-[10.5px] font-mono px-2 py-1.5 rounded focus:outline-none text-meridian-text-2 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(manualLink)}
                      className="px-2.5 py-1.5 bg-meridian-gold hover:bg-meridian-gold-dim text-white text-xs font-mono rounded transition flex items-center gap-1 cursor-pointer"
                      title="Copy to Clipboard"
                    >
                      {copied ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="text-[9px] text-meridian-text-3 font-mono mt-1">
                    Expires in 30 days. Link: {new Date(successData.manualLinkExpiresAt || '').toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSuccessData(null)}
          className="w-full py-2 px-4 text-xs font-mono uppercase tracking-widest text-[#FBFAF3] bg-meridian-deep border border-meridian-border hover:bg-meridian-panel-raised rounded-lg transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Register Another</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-meridian-panel border border-meridian-border rounded-xl p-6 h-fit sticky top-6">
      <div className="pb-3 border-b border-meridian-border mb-4">
        <h3 className="font-serif text-lg font-medium text-meridian-text-1">
          Inscribe New Person
        </h3>
        <p className="text-[10px] font-mono uppercase tracking-wider text-meridian-text-3 mt-1">
          SmartSkoolz Registrar
        </p>
      </div>

      {error && (
        <div className="p-3 mb-4 text-xs font-mono text-meridian-loss bg-meridian-loss/15 rounded-lg border border-meridian-loss/30 animate-fade-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Full Name */}
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            placeholder="e.g. Sandra Nakasenge"
            disabled={isPending}
            className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1 placeholder-meridian-text-3/60"
          />
        </div>

        {/* Role Selector (Filtered to student and teacher to match RPC options) */}
        <div className="space-y-1.5">
          <label htmlFor="role" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
            Primary Academic Role
          </label>
          <select
            id="role"
            name="role"
            required
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher / Faculty</option>
          </select>
        </div>

        {/* Class Selector - only show if student */}
        {selectedRole === 'student' && (
          <div className="space-y-1.5 animate-fade-in">
            <label htmlFor="classId" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
              Class Assignment
            </label>
            <select
              id="classId"
              name="classId"
              required
              disabled={isPending}
              className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1"
            >
              <option value="">-- Select Class --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Biometric Hardware Device User ID */}
        <div className="space-y-1.5">
          <label htmlFor="deviceUserId" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2 flex items-center justify-between">
            <span>Device User ID</span>
            <span className="text-[9px] text-meridian-text-3 uppercase font-normal">(ZKTeco Hardware ID)</span>
          </label>
          <input
            id="deviceUserId"
            name="deviceUserId"
            type="text"
            placeholder="e.g. 101 or 1002"
            disabled={isPending}
            className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1 placeholder-meridian-text-3/60 font-mono"
          />
          <p className="text-[9px] text-meridian-text-3 flex items-center gap-1">
            <HelpCircle className="w-2.5 h-2.5 text-meridian-gold" />
            Optional. Gotten from physical ZKTeco machine enrollment (Leave blank if not enrolled).
          </p>
        </div>

        {/* Info box explaining distinction */}
        <div className="bg-meridian-deep border border-meridian-border text-meridian-text-2 text-[11px] p-3 rounded-lg flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-meridian-gold shrink-0 mt-0.5" />
          <p className="leading-relaxed text-meridian-text-3">
            {selectedRole === 'teacher' ? (
              <>
                For teachers, the system will <strong className="text-meridian-gold font-mono">auto-generate a unique 6-character Attendance PIN</strong> (e.g. T7K9M2) upon registration for portal attendance marking.
              </>
            ) : (
              <>
                Student attendance is logged via physical ZKTeco biometric clock-in or teacher class registers.
              </>
            )}
          </p>
        </div>

        {/* Student Guardian Details */}
        {selectedRole === 'student' && (
          <div className="space-y-4 border-t border-meridian-border/50 pt-4 animate-fade-in">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-meridian-gold font-semibold">
              Guardian Details (Required for SMS)
            </h4>
            
            <div className="space-y-1.5">
              <label htmlFor="guardianName" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
                Guardian Full Name
              </label>
              <input
                id="guardianName"
                name="guardianName"
                type="text"
                placeholder="e.g. David Namubiru"
                disabled={isPending}
                className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1 placeholder-meridian-text-3/60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="guardianPhone" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
                Guardian Phone Number
              </label>
              <input
                id="guardianPhone"
                name="guardianPhone"
                type="tel"
                placeholder="e.g. +25677000000"
                disabled={isPending}
                className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1 placeholder-meridian-text-3/60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="guardianRelationship" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
                Relationship
              </label>
              <select
                id="guardianRelationship"
                name="guardianRelationship"
                disabled={isPending}
                className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1"
              >
                <option value="guardian">Guardian</option>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
              </select>
            </div>
          </div>
        )}

        {/* Teacher Details */}
        {selectedRole === 'teacher' && (
          <div className="space-y-4 border-t border-meridian-border/50 pt-4 animate-fade-in">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-meridian-gold font-semibold">
              Teacher Credentials
            </h4>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
                SMS Notification Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="e.g. +25677000000"
                disabled={isPending}
                className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1 placeholder-meridian-text-3/60"
              />
            </div>

            

            {/* Teacher Authorized Classes (Checklist multi-select) */}
            <div className="space-y-2 animate-fade-in">
              <label className="text-xs font-mono uppercase tracking-wider text-meridian-text-2 block">
                Authorized Classes
              </label>
              {classes.length === 0 ? (
                <p className="text-xs text-meridian-text-3 font-mono italic">No classes found in school.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-meridian-border bg-meridian-panel-raised rounded-lg p-2.5 space-y-2">
                  {classes.map((cls) => (
                    <label key={cls.id} className="flex items-center gap-2 text-xs text-meridian-text-2 hover:text-meridian-text-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedTeacherClasses.includes(cls.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTeacherClasses(prev => [...prev, cls.id]);
                          } else {
                            setSelectedTeacherClasses(prev => prev.filter(id => id !== cls.id));
                          }
                        }}
                        className="rounded border-meridian-border text-meridian-gold focus:ring-meridian-gold"
                      />
                      <span>{cls.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <input type="hidden" name="classIdsJson" value={JSON.stringify(selectedTeacherClasses)} />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-6 py-2 px-4 text-xs font-mono uppercase tracking-widest text-[#FBFAF3] bg-meridian-gold hover:bg-meridian-gold-dim border border-transparent rounded-lg transition duration-200 disabled:opacity-75 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          {isPending ? 'Saving Record...' : 'Register Person'}
        </button>
      </form>
    </div>
  );
}
