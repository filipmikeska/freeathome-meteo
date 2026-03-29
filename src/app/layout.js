import './globals.css';

export const metadata = {
  title: 'Meteostanice | ABB free@home',
  description: 'Aktuální počasí a historie dat z meteostanice ABB free@home WS-1',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
