import './globals.css';

export const metadata = {
  title: 'Meteostanice Pacetluky | Aktuální počasí',
  description:
    'Aktuální počasí v Pacetlukách u Kroměříže. Teplota, vítr, jas, srážky a předpověď z meteostanice ABB free@home WS-1. Aktualizace každou minutu.',
  keywords: [
    'počasí Pacetluky',
    'meteostanice Pacetluky',
    'počasí Kroměříž',
    'meteo Pacetluky',
    'teplota Pacetluky',
    'předpověď počasí Pacetluky',
    'ABB free@home WS-1',
    'počasí Zlínský kraj',
  ],
  authors: [{ name: 'Meteostanice Pacetluky' }],
  creator: 'Meteostanice Pacetluky',
  metadataBase: new URL('https://meteopacetluky.cz'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Meteostanice Pacetluky | Aktuální počasí',
    description:
      'Aktuální počasí v Pacetlukách u Kroměříže. Teplota, vítr, jas, srážky a předpověď. Aktualizace každou minutu.',
    url: 'https://meteopacetluky.cz',
    siteName: 'Meteostanice Pacetluky',
    locale: 'cs_CZ',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Meteostanice Pacetluky | Aktuální počasí',
    description:
      'Aktuální počasí v Pacetlukách u Kroměříže. Teplota, vítr, jas, srážky a předpověď.',
  },
  verification: {
    google: 'kXTXb3cUaqEazf8L2bxVIRxCWQjO6lTHzfmOzZstDcM',
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Meteo Pacetluky',
  },
  other: {
    'geo.region': 'CZ-ZLK',
    'geo.placename': 'Pacetluky',
    'geo.position': '49.3794;17.5658',
    'ICBM': '49.3794, 17.5658',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Meteostanice Pacetluky',
              url: 'https://meteopacetluky.cz',
              description:
                'Aktuální počasí v Pacetlukách u Kroměříže z meteostanice ABB free@home WS-1.',
              publisher: {
                '@type': 'Organization',
                name: 'Meteostanice Pacetluky',
                email: 'meteopacetluky@gmail.com',
              },
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://meteopacetluky.cz',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Place',
              name: 'Meteostanice Pacetluky',
              description: 'Meteorologická stanice ABB free@home WS-1 v Pacetlukách',
              geo: {
                '@type': 'GeoCoordinates',
                latitude: 49.3794,
                longitude: 17.5658,
              },
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'Pacetluky',
                addressRegion: 'Zlínský kraj',
                addressCountry: 'CZ',
              },
            }),
          }}
        />
      </head>
      <body className="bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors">{children}</body>
    </html>
  );
}
