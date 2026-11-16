'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Registra el Service Worker de la PWA y muestra una alerta flotante
 * cuando el dispositivo pierde conectividad a internet.
 */
export function PwaRegister() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Error al registrar el Service Worker:', err);
      });
    }

    const syncOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    syncOnlineStatus();
    window.addEventListener('online', syncOnlineStatus);
    window.addEventListener('offline', syncOnlineStatus);

    return () => {
      window.removeEventListener('online', syncOnlineStatus);
      window.removeEventListener('offline', syncOnlineStatus);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed top-2 inset-x-3 z-50 mx-auto max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 shadow-md flex items-center gap-2.5"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <span>
        Sin conexión a internet — Verifica tu señal antes de enviar pedidos
      </span>
    </div>
  );
}

