import React from 'react';

/**
 * Patrón SVG Temático de Fondo (Chorizos, Cortes de Fiambre y Pesaje).
 * Diseñado como textura técnica sutil que da identidad inmediata a la marca
 * sin afectar la legibilidad de los controles.
 */
export const CharcuteriePatternBg: React.FC<{ variant?: 'light' | 'brand' }> = ({
  variant = 'light',
}) => {
  const strokeColor = variant === 'brand' ? '#FFFFFF' : '#94A3B8';
  const opacityClass =
    variant === 'brand' ? 'opacity-[0.09]' : 'opacity-[0.14]';

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${opacityClass}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={`euroalimentos-pattern-${variant}`}
          width="140"
          height="140"
          patternUnits="userSpaceOnUse"
        >
          {/* Ristra de Chorizos Curvos (Arriba Izquierda) */}
          <g
            stroke={strokeColor}
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 32 C18 22, 44 22, 44 32 C44 42, 18 42, 18 32 Z" />
            <path d="M48 32 C48 22, 74 22, 74 32 C74 42, 48 42, 48 32 Z" />
            <path d="M14 29 L18 32 L14 35" />
            <path d="M44 32 L48 32" />
            <path d="M74 32 L78 29 M74 32 L78 35" />
            <path d="M24 28 Q31 26 38 28" strokeWidth="1.25" />
            <path d="M54 28 Q61 26 68 28" strokeWidth="1.25" />
          </g>

          {/* Rodaja de Embutido / Mortadela con especias (Abajo Derecha) */}
          <g
            stroke={strokeColor}
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
          >
            <circle cx="105" cy="102" r="19" />
            <circle cx="105" cy="102" r="15" strokeDasharray="3 3" />
            <circle cx="100" cy="97" r="1.5" fill={strokeColor} />
            <circle cx="111" cy="100" r="1.5" fill={strokeColor} />
            <circle cx="103" cy="108" r="1.5" fill={strokeColor} />
          </g>

          {/* Pesa / Lingote de Kilo (Abajo Izquierda) */}
          <g
            stroke={strokeColor}
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M28 96 L48 96 L52 114 L24 114 Z" />
            <path d="M33 96 C33 90, 43 90, 43 96" />
          </g>

          {/* Salchicha / Chorizo Parrillero Diagonal (Arriba Derecha) */}
          <g
            stroke={strokeColor}
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
            transform="rotate(-28 106 34)"
          >
            <rect x="88" y="27" width="36" height="14" rx="7" />
            <path d="M84 34 L88 34 M124 34 L128 34" />
            <path
              d="M96 31 L101 37 M105 31 L110 37 M114 31 L119 37"
              strokeWidth="1.3"
            />
          </g>
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#euroalimentos-pattern-${variant})`}
      />
    </svg>
  );
};

/**
 * Emblema SVG Corporativo a Medida para EUROALIMENTOS SRL.
 * Combina escudo heráldico industrial, corona de calidad y cinta amarilla.
 */
export const EuroalimentosEmblem: React.FC<{ size?: 'sm' | 'lg' }> = ({
  size = 'lg',
}) => {
  const dimensions = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
  return (
    <div
      className={`relative flex ${dimensions} shrink-0 items-center justify-center rounded-xl border-2 border-[#FFCD00] bg-gradient-to-b from-[#D91636] to-[#9E0B22] shadow-md`}
    >
      <svg
        viewBox="0 0 64 64"
        className="h-full w-full p-1.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="32"
          cy="32"
          r="26"
          stroke="#FFCD00"
          strokeWidth="1.75"
          strokeDasharray="4 2"
          opacity="0.85"
        />
        <path
          d="M32 10 L33.8 14.2 L38.4 14.6 L34.9 17.6 L36 22 L32 19.6 L28 22 L29.1 17.6 L25.6 14.6 L30.2 14.2 Z"
          fill="#FFCD00"
        />
        <text
          x="32"
          y="41"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="21"
          letterSpacing="-1"
        >
          EA
        </text>
        <rect x="14" y="45" width="36" height="6" rx="2" fill="#FFCD00" />
      </svg>
    </div>
  );
};

