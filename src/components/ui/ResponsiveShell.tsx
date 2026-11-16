'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  LogOut,
  Package,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RolUsuarioEnum } from '@/types/database.types';

export type NavIconName =
  | 'shopping-cart'
  | 'clipboard-list'
  | 'scale'
  | 'factory'
  | 'package'
  | 'shield'
  | 'file-spreadsheet'
  | 'users'
  | 'bar-chart';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

interface ResponsiveShellProps {
  rol: RolUsuarioEnum;
  nombreUsuario: string;
  navItems: NavItem[];
  children: React.ReactNode;
  onSignOut?: () => void | Promise<void>;
}

const ICON_MAP: Record<NavIconName, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  'clipboard-list': ClipboardList,
  scale: Scale,
  factory: Factory,
  package: Package,
  shield: ShieldCheck,
  'file-spreadsheet': FileSpreadsheet,
  users: Users,
  'bar-chart': BarChart3,
};

const ROL_BADGE_STYLES: Record<RolUsuarioEnum, string> = {
  VENDEDOR: 'bg-red-100 text-red-800 border-red-200',
  DESPACHADOR: 'bg-amber-100 text-amber-800 border-amber-200',
  PRODUCCION: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ADMINISTRADOR: 'bg-slate-200 text-slate-800 border-slate-300',
};

/**
 * Contenedor maestro responsivo para EuroPOS:
 * - Móvil (< 768px): barra superior compacta + navegación inferior fija para pulgar.
 * - Escritorio (>= 768px): sidebar lateral colapsable + área de contenido fluida.
 */
export function ResponsiveShell({
  rol,
  nombreUsuario,
  navItems,
  children,
  onSignOut,
}: ResponsiveShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (onSignOut) {
        await onSignOut();
      } else {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }
    } finally {
      setSigningOut(false);
    }
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      {/* Barra superior móvil (< 768px) */}
      <header className="no-print md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-800 text-sm font-extrabold text-white">
            EA
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900">
              EUROALIMENTOS
            </p>
            <p className="truncate text-xs text-slate-500">{nombreUsuario}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ROL_BADGE_STYLES[rol]}`}
          >
            {rol}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Cerrar sesión"
            className="touch-manipulation flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Sidebar colapsable de escritorio (>= 768px) */}
      <aside
        className={`no-print hidden md:flex md:flex-col md:shrink-0 border-r border-slate-200 bg-white transition-all duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-800 text-sm font-extrabold text-white">
              EA
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-tight text-slate-900">
                  EUROALIMENTOS
                </p>
                <p className="truncate text-xs text-slate-500">SRL • EuroPOS</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={
              sidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'
            }
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav
          aria-label="Navegación principal"
          className="flex-1 space-y-1 p-3 overflow-y-auto"
        >
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-red-800 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 space-y-2.5">
          {!sidebarCollapsed && (
            <div className="px-2">
              <p className="truncate text-sm font-semibold text-slate-800">
                {nombreUsuario}
              </p>
              <span
                className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ROL_BADGE_STYLES[rol]}`}
              >
                {rol}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && (
              <span>{signingOut ? 'Saliendo...' : 'Cerrar sesión'}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 min-w-0 pb-20 md:pb-6">
        <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Barra de navegación inferior fija móvil (< 768px) */}
      <nav
        aria-label="Navegación móvil"
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${Math.max(navItems.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`touch-manipulation flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'text-red-800 bg-red-50/70'
                    : 'text-slate-600 active:bg-slate-100'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-full leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

