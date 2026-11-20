'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  Briefcase,
  ChevronRight,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  History,
  Loader2,
  LogOut,
  PackagePlus,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserCheck,
} from 'lucide-react';
import { logoutAction } from '@/actions/auth.actions';
import { NavigationProgressBar } from '@/components/ui/NavigationProgressBar';
import type { RolUsuarioEnum, UsuarioConPerfil } from '@/types/database.types';

export interface NavItemConfig {
  label: string;
  shortLabel: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export interface DashboardShellProps {
  usuario: UsuarioConPerfil;
  children: React.ReactNode;
}

/**
 * Emblema Corporativo a Medida de EUROALIMENTOS SRL.
 */
const EuroalimentosEmblem: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
}) => {
  const dimensions = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  }[size];

  return (
    <div
      className={`relative ${dimensions} rounded-xl bg-gradient-to-b from-[#C8102E] via-[#9E0B22] to-[#85081C] border-2 border-[#FFCD00] shadow-md flex items-center justify-center shrink-0 select-none overflow-hidden`}
      aria-label="Emblema Euroalimentos SRL"
    >
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke="#FFCD00"
          strokeWidth="1.5"
          strokeDasharray="3 2.5"
          opacity="0.85"
        />
        <polygon
          points="32,8 33.8,12.5 38.6,12.8 34.9,15.9 36.1,20.6 32,18 27.9,20.6 29.1,15.9 25.4,12.8 30.2,12.5"
          fill="#FFCD00"
        />
        <text
          x="32"
          y="39"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="19"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.5"
        >
          EA
        </text>
        <rect x="14" y="44" width="36" height="7" rx="1.5" fill="#FFCD00" />
        <text
          x="32"
          y="49.3"
          textAnchor="middle"
          fill="#0F172A"
          fontSize="5.2"
          fontWeight="900"
          fontFamily="monospace"
          letterSpacing="0.6"
        >
          BOLIVIA
        </text>
      </svg>
    </div>
  );
};

/**
 * Trama SVG Temática de Charcutería (CharcuteriePatternBg).
 */
const CharcuteriePatternBg: React.FC<{ variant?: 'crimson' | 'light' }> = ({
  variant = 'crimson',
}) => {
  const isCrimson = variant === 'crimson';
  const primaryStroke = isCrimson ? '#FFFFFF' : '#85081C';
  const secondaryStroke = isCrimson ? '#FFCD00' : '#0F172A';
  const opacityClass = isCrimson ? 'opacity-[0.10]' : 'opacity-[0.13]';

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${opacityClass}`}
      aria-hidden="true"
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={`dashboard-charcuterie-pattern-${variant}`}
            width="240"
            height="240"
            patternUnits="userSpaceOnUse"
          >
            {/* 1. Ristra artesanal de chorizos enlazados */}
            <g transform="translate(18, 22)">
              <path
                d="M4 22 C 0 18, 0 26, 4 22 M4 22 L 11 22 M7 17 L 10 22 L 7 27"
                fill="none"
                stroke={secondaryStroke}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 16 C 18 6, 38 6, 44 16 C 48 22, 48 26, 44 30 C 38 38, 18 38, 12 30 C 9 25, 9 21, 12 16 Z"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <path
                d="M17 15 C 23 11, 33 11, 39 15"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.7"
              />
              <circle cx="22" cy="24" r="1.3" fill={secondaryStroke} />
              <circle cx="31" cy="21" r="1.5" fill={primaryStroke} />
              <circle cx="35" cy="27" r="1.2" fill={secondaryStroke} />
              <circle cx="25" cy="29" r="1.1" fill={primaryStroke} />

              <path
                d="M45 20 L 51 26 M51 20 L 45 26"
                stroke={secondaryStroke}
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              <path
                d="M52 18 C 60 10, 78 14, 82 26 C 85 35, 80 44, 70 46 C 60 48, 50 40, 50 28 C 50 23, 50 20, 52 18 Z"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <path
                d="M58 18 C 65 16, 73 19, 76 26"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.7"
              />
              <circle cx="62" cy="28" r="1.4" fill={secondaryStroke} />
              <circle cx="71" cy="32" r="1.3" fill={primaryStroke} />
              <circle cx="64" cy="38" r="1.5" fill={secondaryStroke} />

              <path
                d="M72 47 L 75 54 M70 52 L 75 50 L 79 53"
                fill="none"
                stroke={secondaryStroke}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>

            {/* 2. Rodaja de mortadela / fiambre */}
            <g transform="translate(152, 24)">
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="2.8"
              />
              <circle
                cx="32"
                cy="32"
                r="21.5"
                fill="none"
                stroke={secondaryStroke}
                strokeWidth="1.2"
                strokeDasharray="4 2.5"
              />
              <rect
                x="20"
                y="19"
                width="5"
                height="4"
                rx="1.2"
                transform="rotate(15 22 21)"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="1.5"
              />
              <rect
                x="38"
                y="21"
                width="5.5"
                height="4"
                rx="1.2"
                transform="rotate(-20 40 23)"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="1.5"
              />
              <rect
                x="29"
                y="34"
                width="6"
                height="4.5"
                rx="1.2"
                transform="rotate(10 32 36)"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="1.5"
              />
              <rect
                x="19"
                y="37"
                width="4.5"
                height="3.5"
                rx="1"
                transform="rotate(-12 21 38)"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="1.5"
              />
              <circle cx="31" cy="24" r="1.6" fill={secondaryStroke} />
              <circle cx="43" cy="34" r="1.6" fill={secondaryStroke} />
              <circle cx="26" cy="44" r="1.5" fill={secondaryStroke} />
              <circle cx="38" cy="43" r="1.4" fill={secondaryStroke} />
            </g>

            {/* 3. Pesa industrial de calibración (1 KG) */}
            <g transform="translate(26, 134)">
              <circle
                cx="30"
                cy="12"
                r="6.5"
                fill="none"
                stroke={secondaryStroke}
                strokeWidth="2.4"
              />
              <line
                x1="30"
                y1="18.5"
                x2="30"
                y2="23"
                stroke={secondaryStroke}
                strokeWidth="2.5"
              />
              <path
                d="M12 23 L 48 23 L 54 62 C 54.5 65, 52 67, 49 67 L 11 67 C 8 67, 5.5 65, 6 62 Z"
                fill="none"
                stroke={primaryStroke}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <line
                x1="9"
                y1="60"
                x2="51"
                y2="60"
                stroke={secondaryStroke}
                strokeWidth="1.4"
              />
              <text
                x="30"
                y="47"
                textAnchor="middle"
                fill={secondaryStroke}
                fontSize="12"
                fontWeight="900"
                fontFamily="monospace"
                letterSpacing="0.5"
              >
                1 KG
              </text>
            </g>

            {/* 4. Par de salchichas parrilleras */}
            <g transform="translate(128, 136)">
              <g transform="rotate(-16 42 22)">
                <rect
                  x="8"
                  y="12"
                  width="68"
                  height="18"
                  rx="9"
                  fill="none"
                  stroke={primaryStroke}
                  strokeWidth="2.6"
                />
                <path
                  d="M3 21 L 8 21 M76 21 L 81 21"
                  stroke={secondaryStroke}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <line
                  x1="24"
                  y1="15"
                  x2="29"
                  y2="27"
                  stroke={secondaryStroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <line
                  x1="36"
                  y1="15"
                  x2="41"
                  y2="27"
                  stroke={secondaryStroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <line
                  x1="48"
                  y1="15"
                  x2="53"
                  y2="27"
                  stroke={secondaryStroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <line
                  x1="60"
                  y1="15"
                  x2="65"
                  y2="27"
                  stroke={secondaryStroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>

              <g transform="translate(12, 34) rotate(12 42 22)">
                <rect
                  x="8"
                  y="12"
                  width="64"
                  height="17"
                  rx="8.5"
                  fill="none"
                  stroke={primaryStroke}
                  strokeWidth="2.6"
                />
                <path
                  d="M3 20.5 L 8 20.5 M72 20.5 L 77 20.5"
                  stroke={secondaryStroke}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <line
                  x1="23"
                  y1="15"
                  x2="27"
                  y2="26"
                  stroke={secondaryStroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <line
                  x1="35"
                  y1="15"
                  x2="39"
                  y2="26"
                  stroke={secondaryStroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <line
                  x1="47"
                  y1="15"
                  x2="51"
                  y2="26"
                  stroke={secondaryStroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#dashboard-charcuterie-pattern-${variant})`}
        />
      </svg>
    </div>
  );
};

const RUTAS_POR_ROL: Record<RolUsuarioEnum, NavItemConfig[]> = {
  VENDEDOR: [
    {
      label: 'Nueva Preventa',
      shortLabel: 'Preventa',
      href: '/vendedor/nueva-venta',
      icon: ShoppingBag,
    },
    {
      label: 'Mis Pedidos',
      shortLabel: 'Mis Pedidos',
      href: '/vendedor/mis-pedidos',
      icon: ClipboardList,
    },
  ],
  DESPACHADOR: [
    {
      label: 'Bandeja Despacho',
      shortLabel: 'Despacho',
      href: '/despacho',
      icon: Scale,
    },
    {
      label: 'Historial Despachos',
      shortLabel: 'Historial',
      href: '/despacho/historial',
      icon: History,
    },
  ],
  PRODUCCION: [
    {
      label: 'Ingreso de Lotes',
      shortLabel: 'Lotes',
      href: '/produccion/lotes',
      icon: PackagePlus,
    },
    {
      label: 'Transformar Granel',
      shortLabel: 'Transformar',
      href: '/produccion/transformacion',
      icon: ArrowRightLeft,
    },
    {
      label: 'Historial Kardex',
      shortLabel: 'Historial',
      href: '/produccion/historial',
      icon: History,
    },
  ],
  ADMINISTRADOR: [
    {
      label: 'Historial y Rebotes',
      shortLabel: 'Historial',
      href: '/admin/historial',
      icon: History,
    },
    {
      label: 'Reportes SAC',
      shortLabel: 'Reportes SAC',
      href: '/admin/reportes',
      icon: FileSpreadsheet,
    },
    {
      label: 'Kardex e Inventario',
      shortLabel: 'Kardex',
      href: '/admin/kardex',
      icon: ClipboardList,
    },
    {
      label: 'Catálogo y Usuarios',
      shortLabel: 'Catálogo',
      href: '/admin/catalogo',
      icon: Settings,
    },
  ],
};

function obtenerNombreCorto(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 1) return nombreCompleto;
  return `${partes[0]} ${partes[1][0]?.toUpperCase() ?? ''}.`;
}

function obtenerMetadataRol(usuario: UsuarioConPerfil) {
  switch (usuario.rol) {
    case 'VENDEDOR':
      return {
        etiquetaRol: 'VENDEDOR RUTA',
        badgeClasses: 'bg-[#FFCD00] text-slate-950 border-amber-500',
        IconoPerfil: UserCheck,
        datoTecnico: `Cód: ${usuario.perfil_vendedor?.codigo_vendedor ?? 'S/C'} • Meta: ${
          usuario.perfil_vendedor?.meta_diaria_kilos ?? 0
        } kg`,
      };
    case 'DESPACHADOR':
      return {
        etiquetaRol: 'DESPACHADOR',
        badgeClasses: 'bg-sky-400 text-slate-950 border-sky-500',
        IconoPerfil: Scale,
        datoTecnico: `${usuario.perfil_despachador?.identificador_balanza ?? 'BALANZA-01'} • ${
          usuario.perfil_despachador?.ancho_papel_mm ?? 80
        }mm`,
      };
    case 'PRODUCCION':
      return {
        etiquetaRol: 'PRODUCCIÓN',
        badgeClasses: 'bg-emerald-400 text-slate-950 border-emerald-500',
        IconoPerfil: Factory,
        datoTecnico: `Turno ${usuario.perfil_produccion?.turno_planta ?? 'PLANTA'}`,
      };
    case 'ADMINISTRADOR':
      return {
        etiquetaRol: 'ADMIN PLANTA',
        badgeClasses: 'bg-white text-[#9E0B22] border-slate-200',
        IconoPerfil: Briefcase,
        datoTecnico: usuario.perfil_administrador?.cargo_gerencial ?? 'Gerencia',
      };
  }
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  usuario,
  children,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingNav, setPendingNav] = useState<{
    fromPath: string;
    targetPath: string;
  } | null>(null);
  const [isPendingLogout, startLogoutTransition] = useTransition();

  const navItems = useMemo(
    () => RUTAS_POR_ROL[usuario.rol] ?? [],
    [usuario.rol]
  );
  const metaRol = obtenerMetadataRol(usuario);
  const IconoPerfil = metaRol.IconoPerfil;
  const nombreCorto = obtenerNombreCorto(usuario.nombre_completo);

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [navItems, router]);

  const optimisticPath =
    pendingNav && pendingNav.fromPath === pathname
      ? pendingNav.targetPath
      : pathname;
  const isRouteActive = (href: string) =>
    optimisticPath === href || optimisticPath.startsWith(`${href}/`);
  const isRouteLoading = (href: string) =>
    optimisticPath !== pathname &&
    (optimisticPath === href || optimisticPath.startsWith(`${href}/`));

  const handleNavClick = (href: string) => {
    if (href !== pathname) {
      setPendingNav({ fromPath: pathname, targetPath: href });
    }
  };

  const handleLogout = () => {
    startLogoutTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <div className="min-h-dvh md:h-dvh md:overflow-hidden flex flex-col md:flex-row bg-slate-50 text-slate-900 selection:bg-[#FFCD00] selection:text-slate-950 print:h-auto print:overflow-visible">
      <NavigationProgressBar />
      {/* ====================================================================
          1. HEADER SUPERIOR MÓVIL FIJO (< 768px) — ALTO CONTRASTE PARA CALLE
          ==================================================================== */}
      <header className="no-print md:hidden sticky top-0 z-40 h-14 w-full bg-gradient-to-r from-[#C8102E] via-[#9E0B22] to-[#85081C] border-b-4 border-[#FFCD00] shadow-md px-3 flex items-center justify-between">
        <CharcuteriePatternBg variant="crimson" />

        <div className="relative z-10 flex items-center gap-2.5 min-w-0">
          <EuroalimentosEmblem size="sm" />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-black tracking-tight text-white text-sm uppercase">
                EUROALIMENTOS
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-semibold text-red-100 truncate max-w-[110px]">
                {nombreCorto}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-black tracking-wider border ${metaRol.badgeClasses}`}
              >
                {metaRol.etiquetaRol}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isPendingLogout}
          title="Cerrar Sesión"
          aria-label="Cerrar Sesión"
          className="touch-manipulation relative z-10 min-h-[40px] min-w-[40px] px-2.5 rounded-lg bg-red-950/60 hover:bg-red-950 active:translate-y-[1px] border border-red-400/30 text-white flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-[#FFCD00] disabled:opacity-60"
        >
          <LogOut className="w-4 h-4 text-[#FFCD00]" strokeWidth={2.2} />
          <span className="text-xs font-bold tracking-wide hidden sm:inline">
            {isPendingLogout ? 'Saliendo...' : 'Salir'}
          </span>
        </button>
      </header>

      {/* ====================================================================
          2. BARRA LATERAL IZQUIERDA ESCRITORIO / TABLET (>= 768px)
          ==================================================================== */}
      <aside className="no-print hidden md:flex md:w-64 lg:w-72 md:shrink-0 md:h-dvh md:flex-col md:overflow-y-auto border-r border-slate-200 bg-white z-20 shadow-[4px_0_24px_-12px_rgba(15,23,42,0.12)] select-none">
        {/* Cabecera de Marca */}
        <div className="relative bg-gradient-to-br from-[#C8102E] via-[#9E0B22] to-[#85081C] px-4 pt-5 pb-4 border-b-4 border-[#FFCD00] overflow-hidden shadow-inner">
          <CharcuteriePatternBg variant="crimson" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
          <div className="relative z-10 flex items-center gap-3">
            <EuroalimentosEmblem size="md" />
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#FFCD00] drop-shadow-2xs">
                PLANTA &amp; DISTRIBUCIÓN
              </p>
              <h1 className="text-base font-black tracking-tight text-white leading-none mt-0.5">
                EUROALIMENTOS
              </h1>
              <p className="text-[11px] font-bold text-red-100/90 tracking-wider mt-0.5">
                S.R.L. • BOLIVIA
              </p>
            </div>
          </div>
        </div>

        {/* Tarjeta de Perfil Especializado CTI */}
        <div className="px-3.5 pt-4 pb-2">
          <div className="relative rounded-xl border-2 border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 overflow-hidden shadow-xs">
            <div className="h-1.5 w-full flex">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-black tracking-wider border ${metaRol.badgeClasses}`}
                >
                  <ShieldCheck className="w-3 h-3" strokeWidth={2.2} />
                  {metaRol.etiquetaRol}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 tabular-nums">
                  USR-{usuario.id_usuario}
                </span>
              </div>

              <p className="text-sm font-extrabold text-slate-900 leading-snug truncate">
                {usuario.nombre_completo}
              </p>

              {/* Dato Técnico de Perfil Especializado CTI */}
              <div className="mt-2 pt-2 border-t border-dashed border-slate-300 flex items-center gap-1.5 text-slate-800">
                <IconoPerfil
                  className="w-3.5 h-3.5 text-[#C8102E] shrink-0"
                  strokeWidth={2.2}
                />
                <span className="text-[11px] font-mono font-bold tabular-nums tracking-tight truncate">
                  {metaRol.datoTecnico}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navegación Vertical por Rol */}
        <div className="px-3.5 pt-3 pb-1 flex items-center justify-between">
          <span className="px-2 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
            Módulos Operativos
          </span>
          <span className="h-px flex-1 bg-slate-200/80 ml-2" />
        </div>

        <nav
          className="flex-1 px-3.5 py-2 space-y-1.5 overflow-y-auto"
          aria-label="Navegación Principal"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item.href);
            const loading = isRouteLoading(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onTouchStart={() => handleNavClick(item.href)}
                onClick={() => handleNavClick(item.href)}
                aria-current={active ? 'page' : undefined}
                className={`group w-full min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2.5 text-left font-bold text-sm transition-all focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/40 ${
                  active
                    ? 'bg-gradient-to-b from-[#C8102E] to-[#9E0B22] text-white border-b-4 border-red-950 shadow-sm translate-y-0'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200/70 hover:border-[#C8102E]/40 active:translate-y-[1px]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      active
                        ? 'bg-red-950/45 text-[#FFCD00] ring-1 ring-[#FFCD00]/40'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-[#C8102E]/10 group-hover:text-[#C8102E]'
                    }`}
                  >
                    {loading ? (
                      <Loader2
                        className="w-4 h-4 animate-spin text-[#FFCD00]"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Icon className="w-4 h-4" strokeWidth={2.2} />
                    )}
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>

                {active ? (
                  loading ? (
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin text-[#FFCD00] shrink-0"
                      strokeWidth={2.4}
                    />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-[#FFCD00] shadow-[0_0_8px_#FFCD00] shrink-0" />
                  )
                ) : (
                  <ChevronRight
                    className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    strokeWidth={2}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pie del Sidebar */}
        <div className="p-3.5 border-t-2 border-slate-200 bg-slate-50/90 space-y-2.5">
          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white border border-slate-200/80 text-[10px] font-mono text-slate-600">
            <span className="flex items-center gap-1.5 font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              PLANTA EN LÍNEA
            </span>
            <span className="font-black text-slate-800 tabular-nums">
              KG / BS.
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isPendingLogout}
            className="w-full min-h-[48px] px-4 rounded-xl bg-white hover:bg-red-50 active:translate-y-[1px] text-slate-800 hover:text-[#C8102E] border-2 border-slate-200 hover:border-[#C8102E]/40 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-2xs focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/40 disabled:opacity-60"
          >
            <LogOut className="w-4 h-4 text-[#C8102E]" strokeWidth={2.2} />
            <span>
              {isPendingLogout ? 'Cerrando sesión...' : 'Cerrar Sesión'}
            </span>
          </button>
        </div>
      </aside>

      {/* ====================================================================
          3. ÁREA DE CONTENIDO PRINCIPAL
          ==================================================================== */}
      <main className="relative flex-1 min-w-0 md:h-dvh md:overflow-y-auto overflow-x-hidden pb-20 md:pb-8 p-4 sm:p-5 md:p-6 lg:p-8 bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0]/70 print:h-auto print:overflow-visible print:p-0 print:bg-white">
        <CharcuteriePatternBg variant="light" />

        {/* Sello de Agua Industrial en esquina inferior derecha (Solo pantalla) */}
        <div
          className="no-print pointer-events-none fixed bottom-20 md:bottom-5 right-5 z-0 hidden sm:flex items-center gap-2.5 opacity-35 select-none"
          aria-hidden="true"
        >
          <div className="text-right leading-tight">
            <p className="text-[10px] font-mono font-black tracking-widest text-slate-700 uppercase">
              CHARCUTERÍA &amp; EMBUTIDOS
            </p>
            <p className="text-[9px] font-mono font-bold tracking-wider text-[#85081C]">
              INDUSTRIA BOLIVIANA • CONTROL KG
            </p>
          </div>
          <div className="w-7 h-7 rounded-lg border-2 border-slate-400 flex items-center justify-center font-mono font-black text-[10px] text-slate-700">
            EA
          </div>
        </div>

        <div className="relative max-w-[1440px] mx-auto w-full min-w-0">{children}</div>
      </main>

      {/* ====================================================================
          4. BARRA DE NAVEGACIÓN INFERIOR MÓVIL (< 768px) — THUMB-ZONE PWA
          ==================================================================== */}
      <nav
        aria-label="Navegación Rápida Móvil"
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-slate-200 pb-safe shadow-[0_-4px_16px_rgba(15,23,42,0.08)] px-2 py-1.5"
      >
        <div
          className={`grid gap-1.5 ${
            navItems.length === 1
              ? 'grid-cols-1'
              : navItems.length === 2
                ? 'grid-cols-2'
                : navItems.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-4'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item.href);
            const loading = isRouteLoading(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onTouchStart={() => handleNavClick(item.href)}
                onClick={() => handleNavClick(item.href)}
                aria-current={active ? 'page' : undefined}
                className={`touch-manipulation relative min-h-[60px] px-2 py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] focus:outline-none ${
                  active
                    ? 'bg-gradient-to-b from-[#C8102E] to-[#9E0B22] text-white border-b-4 border-red-950 shadow-sm'
                    : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                {active && (
                  <span className="absolute top-1 w-6 h-1 rounded-full bg-[#FFCD00]" />
                )}

                <div className="relative flex items-center justify-center mt-0.5">
                  <Icon
                    className={`w-5 h-5 ${
                      active ? 'text-[#FFCD00]' : 'text-slate-600'
                    }`}
                    strokeWidth={2.2}
                  />
                  {loading && (
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin text-[#FFCD00] ml-1"
                      strokeWidth={2.5}
                    />
                  )}
                </div>

                <span
                  className={`text-xs font-extrabold tracking-tight leading-none text-center truncate max-w-full ${
                    active ? 'text-white' : 'text-slate-800'
                  }`}
                >
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

