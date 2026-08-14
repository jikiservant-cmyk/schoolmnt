import './globals.css';

export const metadata = {
  title: 'SmartSkoolz Portal',
  description: 'An elegant multi-tenant attendance management system powered by Na\'Jiki Tech.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

