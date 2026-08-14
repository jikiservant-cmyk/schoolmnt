import { createClient } from '@/utils/supabase/server';
import AddPersonForm from './AddPersonForm';
import TeacherPinManager from './TeacherPinManager';
import { Users, ArrowLeft, Search, PlusCircle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface SearchProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function PeoplePage({ searchParams }: SearchProps) {
  const params = await searchParams;
  const currentFilter = params.role || 'all';

  const supabase = await createClient();

  // 1. Fetch school classes for enrollment selection
  const { data: classesData } = await supabase
    .from('classes')
    .select('id, name')
    .order('name');

  const classes = classesData || [];

  // 2. Fetch people list
  const { data: peopleData } = await supabase
    .from('people')
    .select(`
      id,
      full_name,
      role,
      class_id,
      device_user_id,
      phone,
      is_active
    `)
    .order('full_name');

  const rawPeople = peopleData || [];

  // 3. Filter people based on active Pill state
  const filteredPeople = rawPeople.filter((p) => {
    if (currentFilter === 'all') return true;
    return p.role === currentFilter;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-baseline gap-2 pb-2 border-b border-meridian-border">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-meridian-text-1 flex items-center gap-2.5">
            <Users className="w-8 h-8 text-meridian-gold" />
            School Directory
          </h1>
          <p className="text-xs font-mono uppercase tracking-widest text-meridian-text-3 mt-1">
            Registry of students, teachers, and system administrators
          </p>
        </div>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-meridian-text-2 hover:text-meridian-gold transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Overview
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* People List & Directory (8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-meridian-panel border border-meridian-border rounded-2xl p-6">
            
            {/* Table Head & Meridian custom pill group */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-meridian-border mb-4">
              <div>
                <h3 className="font-serif text-lg font-medium text-meridian-text-1">
                  Active Registrants
                </h3>
                <p className="text-[11px] text-meridian-text-3 font-mono mt-0.5">
                  Showing {filteredPeople.length} of {rawPeople.length} total entries
                </p>
              </div>

              {/* Meridian Pill Group Navigation */}
              <div className="flex gap-1 bg-meridian-deep border border-meridian-border p-1 rounded-full shrink-0">
                <Link 
                  href="/dashboard/people"
                  className={`text-[10.5px] font-mono px-3 py-1 rounded-full transition-colors ${currentFilter === 'all' ? 'bg-meridian-panel-raised text-meridian-gold font-medium' : 'text-meridian-text-3 hover:text-meridian-text-1'}`}
                >
                  ALL
                </Link>
                <Link 
                  href="/dashboard/people?role=student"
                  className={`text-[10.5px] font-mono px-3 py-1 rounded-full transition-colors ${currentFilter === 'student' ? 'bg-meridian-panel-raised text-meridian-gold font-medium' : 'text-meridian-text-3 hover:text-meridian-text-1'}`}
                >
                  STUDENTS
                </Link>
                <Link 
                  href="/dashboard/people?role=teacher"
                  className={`text-[10.5px] font-mono px-3 py-1 rounded-full transition-colors ${currentFilter === 'teacher' ? 'bg-meridian-panel-raised text-meridian-gold font-medium' : 'text-meridian-text-3 hover:text-meridian-text-1'}`}
                >
                  TEACHERS
                </Link>
                <Link 
                  href="/dashboard/people?role=admin"
                  className={`text-[10.5px] font-mono px-3 py-1 rounded-full transition-colors ${currentFilter === 'admin' ? 'bg-meridian-panel-raised text-meridian-gold font-medium' : 'text-meridian-text-3 hover:text-meridian-text-1'}`}
                >
                  ADMINS
                </Link>
              </div>
            </div>

            {filteredPeople.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-meridian-border/50 rounded-xl space-y-3">
                <Users className="w-10 h-10 text-meridian-text-3 mx-auto opacity-60" />
                <div className="font-serif text-base text-meridian-text-2 font-medium">No results found</div>
                <p className="text-xs text-meridian-text-3 max-w-sm mx-auto">
                  No people match the selected filter category in your school directory.
                </p>
              </div>
            ) : (
              <div>
                {/* Mobile Card Layout */}
                <div className="space-y-3 md:hidden">
                  {filteredPeople.map((person) => {
                    const assignedClass = classes.find(c => c.id === person.class_id);
                    return (
                      <div key={person.id} className="p-4 rounded-xl border border-meridian-border bg-meridian-panel-raised/40 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-meridian-text-1">{person.full_name}</h4>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-meridian-text-3">
                              {person.role === 'teacher' ? 'Faculty' : person.role} &middot; {person.role === 'student' ? (assignedClass?.name || 'Unassigned') : 'Form General'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            person.is_active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}>
                            {person.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-xs font-mono pt-2 border-t border-meridian-border/50 text-meridian-text-3 gap-2">
                          <div>
                            UID: <span className="text-meridian-text-1 font-medium">{person.device_user_id || '—'}</span>
                          </div>
                          <div>
                            Phone: <span className="text-meridian-text-1 font-medium">{person.phone || '—'}</span>
                          </div>
                        </div>

                        {person.role === 'teacher' && (
                          <div className="pt-2 border-t border-meridian-border/50 flex justify-end">
                            <TeacherPinManager personId={person.id} fullName={person.full_name} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-meridian-border">
                        <th className="text-left font-mono text-[10px] uppercase tracking-wider text-meridian-text-3 pb-3">
                          Full Name
                        </th>
                        <th className="text-left font-mono text-[10px] uppercase tracking-wider text-meridian-text-3 pb-3">
                          Role
                        </th>
                        <th className="text-left font-mono text-[10px] uppercase tracking-wider text-meridian-text-3 pb-3">
                          Class Scope
                        </th>
                        <th className="text-center font-mono text-[10px] uppercase tracking-wider text-meridian-text-3 pb-3">
                          Device UID
                        </th>
                        <th className="text-right font-mono text-[10px] uppercase tracking-wider text-meridian-text-3 pb-3">
                          Contact Phone
                        </th>
                        <th className="text-right font-mono text-[10px] uppercase tracking-wider text-meridian-text-3 pb-3">
                          Status
                        </th>
                        <th className="text-right font-mono text-[10px] uppercase tracking-wider text-meridian-text-3 pb-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-meridian-border">
                      {filteredPeople.map((person) => {
                        const assignedClass = classes.find(c => c.id === person.class_id);
                        return (
                          <tr key={person.id} className="hover:bg-meridian-panel-raised/30 transition-colors">
                            <td className="py-3.5 text-sm font-semibold text-meridian-text-1">
                              {person.full_name}
                            </td>
                            <td className="py-3.5 text-xs font-mono uppercase tracking-wider text-meridian-text-3">
                              {person.role === 'teacher' ? 'Faculty' : person.role}
                            </td>
                            <td className="py-3.5 text-sm text-meridian-text-2">
                              {person.role === 'student' ? (assignedClass?.name || 'Unassigned') : 'Form General'}
                            </td>
                            <td className="py-3.5 text-center font-mono text-xs text-meridian-text-1">
                              {person.device_user_id ? (
                                <span className="px-2 py-0.5 bg-meridian-deep rounded text-xs">
                                  {person.device_user_id}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-3.5 text-right font-mono text-xs text-meridian-text-3">
                              {person.phone || '—'}
                            </td>
                            <td className="py-3.5 text-right font-mono text-xs">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium ${
                                person.is_active 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
                              }`}>
                                {person.is_active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              {person.role === 'teacher' ? (
                                <TeacherPinManager personId={person.id} fullName={person.full_name} />
                              ) : (
                                <span className="text-meridian-text-3 text-xs font-mono">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Add Person Form (4 columns) */}
        <div className="lg:col-span-4">
          <AddPersonForm classes={classes} />
        </div>

      </div>

    </div>
  );
}
