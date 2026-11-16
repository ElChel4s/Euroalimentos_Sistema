import React from 'react';

/**
 * Trama SVG Temática de Charcutería & Punto de Venta de Chorizos:
 * Va DETRÁS de las tarjetas y del lienzo principal (nunca en headers).
 */
export const CharcuteriePatternBg: React.FC<{
  variant?: 'canvas' | 'card';
  idSuffix?: string;
}> = ({ variant = 'canvas', idSuffix = 'main' }) => {
  const opacityClass =
    variant === 'canvas' ? 'opacity-[0.14]' : 'opacity-[0.07]';
  const strokeMain = variant === 'canvas' ? '#64748B' : '#9E0B22';
  const accentColor = variant === 'canvas' ? '#C8102E' : '#D97706';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${opacityClass}`}
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={`chorizo-pos-pattern-${variant}-${idSuffix}`}
            width="160"
            height="160"
            patternUnits="userSpaceOnUse"
          >
            {/* 1. Ristra encadenada de 3 chorizos con nudos de hilo */}
            <g
              stroke={strokeMain}
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
            >
              <rect
                x="14"
                y="22"
                width="28"
                height="12"
                rx="6"
                transform="rotate(-14 28 28)"
              />
              <path
                d="M42 23 L46 26 M42 26 L46 23"
                stroke={accentColor}
                strokeWidth="1.8"
              />
              <rect
                x="46"
                y="18"
                width="28"
                height="12"
                rx="6"
                transform="rotate(10 60 24)"
              />
              <path
                d="M74 26 L78 29 M74 29 L78 26"
                stroke={accentColor}
                strokeWidth="1.8"
              />
              <rect
                x="75"
                y="29"
                width="26"
                height="12"
                rx="6"
                transform="rotate(32 88 35)"
              />
              <path d="M10 31 L14 30 M99 42 L104 45" />
            </g>

            {/* 2. Rodaja de mortadela / salchichón con corte y pimienta */}
            <g transform="translate(124, 34)">
              <circle
                cx="0"
                cy="0"
                r="16"
                fill="none"
                stroke={strokeMain}
                strokeWidth="1.7"
              />
              <circle
                cx="0"
                cy="0"
                r="12.5"
                fill="none"
                stroke={accentColor}
                strokeWidth="1"
                strokeDasharray="3 2"
              />
              <circle cx="-5" cy="-4" r="1.4" fill={strokeMain} />
              <circle cx="5" cy="-3" r="1.6" fill={strokeMain} />
              <circle cx="-2" cy="5" r="1.5" fill={strokeMain} />
              <circle cx="6" cy="4" r="1.2" fill={accentColor} />
            </g>

            {/* 3. Pesa de balanza industrial "1 KG" */}
            <g transform="translate(22, 92)">
              <path
                d="M4 26 L10 8 L30 8 L36 26 Z"
                fill="none"
                stroke={strokeMain}
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <circle
                cx="20"
                cy="4"
                r="3.5"
                fill="none"
                stroke={accentColor}
                strokeWidth="1.6"
              />
              <text
                x="20"
                y="21"
                textAnchor="middle"
                fontSize="7.5"
                fontWeight="bold"
                fontFamily="monospace"
                fill={strokeMain}
              >
                1KG
              </text>
            </g>

            {/* 4. Chorizo curvo tipo herradura */}
            <g transform="translate(92, 96)">
              <path
                d="M8 22 C 6 4, 38 4, 36 22 C 35 28, 27 28, 27 21 C 27 12, 17 12, 17 21 C 17 28, 9 28, 8 22 Z"
                fill="none"
                stroke={strokeMain}
                strokeWidth="1.7"
              />
              <path
                d="M19 8 L22 1 L25 8"
                fill="none"
                stroke={accentColor}
                strokeWidth="1.5"
              />
            </g>
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#chorizo-pos-pattern-${variant}-${idSuffix})`}
        />
      </svg>
    </div>
  );
};

/**
 * Emblema Industrial Corporativo EUROALIMENTOS SRL (Compacto para tarjetas/secciones)
 */
export const EuroalimentosEmblem: React.FC<{ size?: 'sm' | 'md' }> = ({
  size = 'sm',
}) => {
  const dims = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <div
      className={`relative flex ${dims} shrink-0 items-center justify-center rounded-xl border-2 border-[#FFCD00] bg-gradient-to-br from-[#C8102E] to-[#85081C] shadow-sm`}
    >
      <div className="absolute inset-0.5 rounded-lg border border-dashed border-[#FFCD00]/75" />
      <div className="relative flex flex-col items-center leading-none">
        <span className="text-[6px] font-black text-[#FFCD00]">★</span>
        <span className="font-mono text-xs font-black tracking-tighter text-white">
          EA
        </span>
        <span className="mt-0.5 rounded-[2px] bg-[#FFCD00] px-1 text-[5px] font-black uppercase text-slate-950">
          SRL
        </span>
      </div>
    </div>
  );
};

/**
 * Franja superior bicolor de "Sello de Planta" (2/3 Carmesí + 1/3 Amarillo Sol)
 */
export const PlantCardHeaderStrip: React.FC = () => (
  <div className="flex h-1.5 w-full overflow-hidden shrink-0">
    <div className="w-2/3 bg-[#C8102E]" />
    <div className="w-1/3 bg-[#FFCD00]" />
  </div>
);

