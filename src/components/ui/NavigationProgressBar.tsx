'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Barra superior de progreso para transiciones entre rutas en Next.js App Router.
 * Se activa instantáneamente al hacer clic/tap en enlaces internos y se completa
 * cuando cambia el pathname activo.
 */
export function NavigationProgressBar() {
  const pathname = usePathname();
  const [navStartPath, setNavStartPath] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      try {
        const nextUrl = new URL(anchor.href, window.location.origin);
        if (nextUrl.origin !== window.location.origin) return;
        if (nextUrl.pathname === pathname) return;

        setNavStartPath(pathname);
        setProgress(30);
      } catch {
        // Ignorar hrefs inválidos o no parseables
      }
    };

    document.addEventListener('click', handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleDocumentClick, {
        capture: true,
      });
    };
  }, [pathname]);

  useEffect(() => {
    if (!navStartPath) return;

    if (navStartPath === pathname) {
      const t1 = setTimeout(() => setProgress(62), 110);
      const t2 = setTimeout(() => setProgress(85), 420);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    const tComplete = setTimeout(() => setProgress(100), 0);
    const tReset = setTimeout(() => {
      setNavStartPath(null);
      setProgress(0);
    }, 220);

    return () => {
      clearTimeout(tComplete);
      clearTimeout(tReset);
    };
  }, [navStartPath, pathname]);

  if (progress === 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="no-print pointer-events-none fixed top-0 inset-x-0 z-50 h-1 bg-transparent"
    >
      <div
        className="h-full bg-red-700 shadow-[0_0_8px_rgba(185,28,28,0.65)] transition-all duration-200 ease-out animate-pulse"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

