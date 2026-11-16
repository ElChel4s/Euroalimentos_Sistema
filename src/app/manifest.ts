import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EUROALIMENTOS SRL - POS y Preventa',
    short_name: 'EuroPOS',
    description:
      'Sistema de Preventa Móvil, Pesaje en Despacho y Control de Producción',
    start_url: '/login',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#991b1b',
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}

