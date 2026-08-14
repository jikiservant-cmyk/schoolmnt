'use client';

import React, { useState, useEffect } from 'react';
import { verifyTeacherPin, getStudentsForClass, submitClassAttendance } from './actions';
import { ShieldAlert, CheckCircle2, Circle, Loader2, ArrowRight, UserCheck, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function ManualAttendancePage() {
  const params = useParams();
  const classId = params.classId as string;

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [teacher, setTeacher] = useState<{ id: string; full_name: string } | null>(null);
  
  const [students, setStudents] = useState<{ id: string; full_name: string; device_user_id: string | null }[]>([]);
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await verifyTeacherPin(classId, pin);
      if (res.success && res.teacher) {
        setTeacher(res.teacher);
        
        // Load students
        const stuRes = await getStudentsForClass(classId);
        if (stuRes.students) {
          setStudents(stuRes.students);
          // Students start unmarked when portal opens
          setPresentIds(new Set());
        } else {
          setError('Failed to load students.');
        }
      } else {
        setError(res.error || 'Invalid PIN');
      }
    } catch (err) {
      setError('A network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      student.full_name.toLowerCase().includes(q) ||
      (student.device_user_id && student.device_user_id.toLowerCase().includes(q))
    );
  });

  const toggleStudent = (id: string) => {
    setPresentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setPresentIds(prev => {
      const next = new Set(prev);
      filteredStudents.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleDeselectAll = () => {
    if (searchQuery.trim()) {
      setPresentIds(prev => {
        const next = new Set(prev);
        filteredStudents.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setPresentIds(new Set());
    }
  };

  const handleSubmitAttendance = async (attendanceType: 'check_in' | 'check_out') => {
    if (!teacher) return;
    setSubmitting(true);
    setError('');
    try {
      const absentIds = students.map(s => s.id).filter(id => !presentIds.has(id));
      const res = await submitClassAttendance(classId, teacher.id, Array.from(presentIds), absentIds, attendanceType);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || 'Failed to submit attendance.');
      }
    } catch (err) {
      setError('A network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-meridian-background flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-meridian-panel border border-meridian-border rounded-2xl p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-meridian-gold/10 flex items-center justify-center rounded-full">
            <CheckCircle2 className="w-8 h-8 text-meridian-gold" />
          </div>
          <div>
            <h2 className="font-serif text-2xl text-meridian-text-1 font-medium">Attendance Saved</h2>
            <p className="text-meridian-text-3 mt-2">Thank you, {teacher?.full_name}. The class attendance has been successfully recorded.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="min-h-screen bg-meridian-background flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-meridian-panel border border-meridian-border rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-meridian-background border border-meridian-border rounded-xl flex items-center justify-center mb-4">
              <UserCheck className="w-6 h-6 text-meridian-gold" />
            </div>
            <h1 className="font-serif text-2xl text-meridian-text-1 font-medium tracking-tight">Teacher Authentication</h1>
            <p className="text-sm text-meridian-text-3 mt-1">Enter your Teacher PIN to mark class attendance</p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter your PIN..."
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-meridian-background border border-meridian-border rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] text-meridian-text-1 focus:outline-none focus:border-meridian-gold transition-colors"
                maxLength={8}
                autoFocus
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full py-3 bg-meridian-gold text-meridian-background rounded-xl font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-meridian-gold-dim transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-meridian-background flex flex-col font-sans">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-meridian-panel/80 backdrop-blur-md border-b border-meridian-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl text-meridian-text-1 font-medium">Class Attendance</h1>
          <p className="text-xs text-meridian-text-3 mt-0.5">Teacher: {teacher.full_name}</p>
        </div>
        <div className="flex items-center gap-4">
          {students.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <button 
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 bg-meridian-background hover:bg-meridian-panel border border-meridian-border rounded-md text-meridian-text-2 transition-colors"
              >
                Select All
              </button>
              <button 
                type="button"
                onClick={handleDeselectAll}
                className="px-2.5 py-1 bg-meridian-background hover:bg-meridian-panel border border-meridian-border rounded-md text-meridian-text-3 hover:text-meridian-text-1 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
          <div className="text-right">
            <p className="text-sm text-meridian-text-1 font-medium">{presentIds.size} / {students.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-meridian-text-3 font-mono">Present</p>
          </div>
        </div>
      </div>

      {/* Student List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-3 pb-24">
          {students.length > 0 && (
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-meridian-text-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search student by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-meridian-panel border border-meridian-border rounded-xl pl-10 pr-10 py-3 text-sm text-meridian-text-1 placeholder:text-meridian-text-3 focus:outline-none focus:border-meridian-gold transition-colors shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-meridian-text-3 hover:text-meridian-text-1 p-1 rounded-md"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {students.length === 0 ? (
            <div className="text-center py-12 text-meridian-text-3">No students found in this class.</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 bg-meridian-panel/30 border border-meridian-border rounded-xl">
              <p className="text-meridian-text-2 font-medium">No students match &quot;{searchQuery}&quot;</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-meridian-gold hover:underline"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            filteredStudents.map(student => {
              const isPresent = presentIds.has(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${
                    isPresent 
                      ? 'bg-meridian-panel border-meridian-gold/50' 
                      : 'bg-meridian-panel/30 border-meridian-border hover:bg-meridian-panel'
                  }`}
                >
                  <div>
                    <p className="font-medium text-meridian-text-1">{student.full_name}</p>
                    <p className="text-xs text-meridian-text-3 font-mono mt-1">ID: {student.device_user_id || 'N/A'}</p>
                  </div>
                  <div>
                    {isPresent ? (
                      <CheckCircle2 className="w-6 h-6 text-meridian-gold" />
                    ) : (
                      <Circle className="w-6 h-6 text-meridian-text-3" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      {students.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-meridian-background via-meridian-background to-transparent pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleSubmitAttendance('check_in')}
              disabled={submitting}
              className="flex-1 py-4 bg-meridian-text-1 text-meridian-background rounded-xl font-medium tracking-wide flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-meridian-text-1/20"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="whitespace-nowrap">Morning Check-In</span> <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
            <button
              onClick={() => handleSubmitAttendance('check_out')}
              disabled={submitting}
              className="flex-1 py-4 bg-meridian-gold text-white rounded-xl font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-meridian-gold-dim transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-meridian-gold/20"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="whitespace-nowrap">Evening Check-Out</span> <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
