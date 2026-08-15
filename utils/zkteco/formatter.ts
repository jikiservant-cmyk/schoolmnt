// Helper to format user display name for ZKTeco ADMS commands
// ZKTeco F18 displays up to ~24 characters on the LCD screen when a user clocks in
export function formatZKTecoDisplayName(person: {
  full_name: string;
  role: 'student' | 'teacher';
  classes?: { name: string } | null;
}): string {
  const rolePrefix = person.role === 'teacher' ? 'Tr.' : '';
  const className = person.classes?.name ? `(${person.classes.name})` : (person.role === 'teacher' ? '(Staff)' : '');
  
  // Format clean name: e.g. "John Doe (Gr.7A)" or "Tr. Alice (Staff)"
  const firstAndLast = person.full_name.trim();
  let displayName = '';

  if (person.role === 'teacher') {
    displayName = `Tr. ${firstAndLast}`;
    if (displayName.length > 16) {
      // Shorten if long
      const parts = firstAndLast.split(' ');
      displayName = `Tr. ${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
  } else {
    // Student
    const parts = firstAndLast.split(' ');
    const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
    displayName = className ? `${shortName} ${className}` : shortName;
  }

  // Sanitize: ASCII characters only (avoid tabs, newlines, quotes that break ADMS text protocol)
  return displayName.replace(/[\t\r\n:=]/g, ' ').substring(0, 24).trim();
}
