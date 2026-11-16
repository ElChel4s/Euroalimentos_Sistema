'use client';

import React, { useActionState, useState, useTransition } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  User,
} from 'lucide-react';
import {
  completarCambioClaveFormAction,
  loginAction,
  verificarUsuarioLoginAction,
  type AuthActionState,
  type VerificarUsuarioLoginData,
} from '@/actions/auth.actions';

export interface LoginFormProps {
  /** Mensaje de error inicial opcional */
  initialError?: string | null;
}

const ROL_BADGE_STYLES: Record<string, string> = {
  VENDEDOR: 'border-amber-300 bg-amber-50 text-amber-950',
  DESPACHADOR: 'border-sky-300 bg-sky-50 text-sky-950',
  PRODUCCION: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  ADMINISTRADOR: 'border-red-300 bg-red-50 text-[#9E0B22]',
};

/**
 * Formulario de Inicio de Sesión en 2 Pasos:
 * - Paso 1: Identificación de `username` (`verificarUsuarioLoginAction`).
 * - Paso 2A: Contraseña estándar (`loginAction`).
 * - Paso 2B: Creación de nueva contraseña cuando `requiere_cambio_clave === true`
 *   (`completarCambioClaveFormAction`).
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  initialError = null,
}) => {
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [usuarioVerificado, setUsuarioVerificado] =
    useState<VerificarUsuarioLoginData | null>(null);
  const [errorPaso1, setErrorPaso1] = useState<string | null>(initialError);
  const [isVerifyingUser, startVerifyTransition] = useTransition();

  // Paso 2A — Flujo normal
  const [stateLogin, formActionLogin, isPendingLogin] = useActionState<
    AuthActionState,
    FormData
  >(loginAction, null);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Paso 2B — Cambio de clave autorizado
  const [stateCambio, formActionCambio, isPendingCambio] = useActionState<
    AuthActionState,
    FormData
  >(completarCambioClaveFormAction, null);
  const [nuevaPassword, setNuevaPassword] = useState<string>('');
  const [confirmarPassword, setConfirmarPassword] = useState<string>('');
  const [showNuevaPassword, setShowNuevaPassword] = useState<boolean>(false);
  const [showConfirmarPassword, setShowConfirmarPassword] =
    useState<boolean>(false);

  const handleVerificarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPaso1(null);

    const clean = usernameInput.trim().toLowerCase().replace(/\s+/g, '');
    if (!clean) {
      setErrorPaso1('Ingrese su usuario para continuar.');
      return;
    }

    startVerifyTransition(async () => {
      const resultado = await verificarUsuarioLoginAction(clean);
      if (!resultado.ok) {
        setErrorPaso1(resultado.error);
        return;
      }

      setUsuarioVerificado(resultado.data);
      setPassword('');
      setNuevaPassword('');
      setConfirmarPassword('');
    });
  };

  const handleVolverPaso1 = () => {
    setUsuarioVerificado(null);
    setErrorPaso1(null);
    setPassword('');
    setNuevaPassword('');
    setConfirmarPassword('');
  };

  const errorActivo = !usuarioVerificado
    ? errorPaso1
    : usuarioVerificado.requiere_cambio_clave
      ? stateCambio?.error ?? null
      : stateLogin?.error ?? null;

  return (
    <div className="w-full">
      {/* Alerta de Error */}
      {errorActivo && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 flex items-start gap-3 rounded-lg border border-red-300 border-l-4 border-l-[#C8102E] bg-red-50/95 p-3.5 text-red-900 shadow-xs transition-all"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[#C8102E]"
            strokeWidth={2.2}
          />
          <div className="flex-1 text-sm leading-snug">
            <p className="font-bold text-red-950">Atención</p>
            <p className="mt-0.5 text-red-800">{errorActivo}</p>
          </div>
        </div>
      )}

      {/* ====================================================================
          PASO 1: IDENTIFICACIÓN DE USUARIO
         ==================================================================== */}
      {!usuarioVerificado && (
        <form onSubmit={handleVerificarUsuario} noValidate className="space-y-5">
          <div>
            <label
              htmlFor="username-step1"
              className="mb-1.5 flex items-center justify-between text-sm font-bold text-slate-800"
            >
              <span>Usuario Operativo</span>
              <span className="font-mono text-[11px] font-semibold uppercase text-slate-400">
                PASO 1 DE 2
              </span>
            </label>
            <div className="group relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 flex items-center text-slate-500 transition-colors group-focus-within:text-[#C8102E]">
                <User className="h-5 w-5" strokeWidth={2} />
              </span>
              <input
                id="username-step1"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                readOnly={isVerifyingUser}
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(
                    e.target.value.toLowerCase().replace(/\s+/g, '')
                  );
                  if (errorPaso1) setErrorPaso1(null);
                }}
                placeholder="Ej. vendedor1"
                className="min-h-[50px] w-full rounded-lg border-2 border-slate-200 bg-slate-50/60 pr-4 pl-11 font-mono text-base font-bold text-slate-900 shadow-inner transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none read-only:cursor-not-allowed read-only:bg-slate-100"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isVerifyingUser}
              className="touch-manipulation group relative flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-lg border-b-4 border-red-950 bg-gradient-to-b from-[#D91636] to-[#B00D27] px-5 py-3 text-base font-extrabold tracking-wide text-white shadow-md transition-all hover:from-[#C8102E] hover:to-[#990B21] active:translate-y-[2px] active:border-b-2 focus:ring-4 focus:ring-[#FFCD00]/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-75"
            >
              {isVerifyingUser ? (
                <>
                  <Loader2
                    className="h-5 w-5 animate-spin text-[#FFCD00]"
                    strokeWidth={2.5}
                  />
                  <span>Verificando usuario...</span>
                </>
              ) : (
                <>
                  <span>Continuar</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-[#FFCD00] text-slate-950 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ====================================================================
          CHIP DE USUARIO VALIDADO (COMPARTIDO EN PASO 2A Y 2B)
         ==================================================================== */}
      {usuarioVerificado && (
        <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-emerald-600"
                strokeWidth={2.4}
              />
              <span className="truncate text-sm font-extrabold text-slate-900">
                {usuarioVerificado.nombre_completo}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-black uppercase ${
                  ROL_BADGE_STYLES[usuarioVerificado.rol] ??
                  'border-slate-300 bg-slate-100 text-slate-800'
                }`}
              >
                {usuarioVerificado.rol}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-xs font-semibold text-slate-500">
              @{usuarioVerificado.username}
            </p>
          </div>

          <button
            type="button"
            disabled={isPendingLogin || isPendingCambio}
            onClick={handleVolverPaso1}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Cambiar usuario</span>
          </button>
        </div>
      )}

      {/* ====================================================================
          PASO 2A: FLUJO NORMAL (requiere_cambio_clave === false)
         ==================================================================== */}
      {usuarioVerificado && !usuarioVerificado.requiere_cambio_clave && (
        <form action={formActionLogin} noValidate className="space-y-5">
          <input
            type="hidden"
            name="identifier"
            value={usuarioVerificado.username}
          />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-bold text-slate-800"
              >
                Contraseña
              </label>
              <span className="font-mono text-[11px] font-semibold uppercase text-slate-400">
                PASO 2 DE 2
              </span>
            </div>
            <div className="group relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 flex items-center text-slate-500 transition-colors group-focus-within:text-[#C8102E]">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                required
                readOnly={isPendingLogin}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="min-h-[50px] w-full rounded-lg border-2 border-slate-200 bg-slate-50/60 pr-13 pl-11 text-base font-medium text-slate-900 shadow-inner transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none read-only:cursor-not-allowed read-only:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isPendingLogin}
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                className="touch-manipulation absolute right-0.5 flex h-[46px] min-h-[44px] w-[46px] min-w-[44px] items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus:ring-2 focus:ring-[#C8102E] focus:outline-none disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isPendingLogin}
              className="touch-manipulation group relative flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-lg border-b-4 border-red-950 bg-gradient-to-b from-[#D91636] to-[#B00D27] px-5 py-3 text-base font-extrabold tracking-wide text-white shadow-md transition-all hover:from-[#C8102E] hover:to-[#990B21] active:translate-y-[2px] active:border-b-2 focus:ring-4 focus:ring-[#FFCD00]/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-75"
            >
              {isPendingLogin ? (
                <>
                  <Loader2
                    className="h-5 w-5 animate-spin text-[#FFCD00]"
                    strokeWidth={2.5}
                  />
                  <span>Verificando acceso...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-[#FFCD00] text-slate-950 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ====================================================================
          PASO 2B: CAMBIO DE CONTRASEÑA AUTORIZADO POR GERENCIA
         ==================================================================== */}
      {usuarioVerificado && usuarioVerificado.requiere_cambio_clave && (
        <form action={formActionCambio} noValidate className="space-y-4">
          <input
            type="hidden"
            name="username"
            value={usuarioVerificado.username}
          />

          <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 border-l-4 border-l-[#FFCD00] bg-amber-50 p-3.5 text-xs leading-relaxed font-semibold text-amber-950">
            <KeyRound
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
              strokeWidth={2.3}
            />
            <span>
              Gerencia habilitó el cambio de contraseña para tu cuenta. Define
              tu nueva clave para ingresar.
            </span>
          </div>

          <div>
            <label
              htmlFor="nueva_password"
              className="mb-1.5 flex items-center justify-between text-sm font-bold text-slate-800"
            >
              <span>Nueva Contraseña</span>
              <span className="font-mono text-[11px] font-semibold uppercase text-slate-400">
                MÍN. 6 CARACTERES
              </span>
            </label>
            <div className="group relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 flex items-center text-slate-500 transition-colors group-focus-within:text-[#C8102E]">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </span>
              <input
                id="nueva_password"
                name="nueva_password"
                type={showNuevaPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                minLength={6}
                required
                readOnly={isPendingCambio}
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="min-h-[50px] w-full rounded-lg border-2 border-slate-200 bg-slate-50/60 pr-13 pl-11 text-base font-medium text-slate-900 shadow-inner transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none read-only:cursor-not-allowed read-only:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowNuevaPassword((prev) => !prev)}
                disabled={isPendingCambio}
                aria-label={
                  showNuevaPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                className="touch-manipulation absolute right-0.5 flex h-[46px] min-h-[44px] w-[46px] min-w-[44px] items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
              >
                {showNuevaPassword ? (
                  <EyeOff className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmar_password"
              className="mb-1.5 block text-sm font-bold text-slate-800"
            >
              Confirmar Nueva Contraseña
            </label>
            <div className="group relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 flex items-center text-slate-500 transition-colors group-focus-within:text-[#C8102E]">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </span>
              <input
                id="confirmar_password"
                name="confirmar_password"
                type={showConfirmarPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={6}
                required
                readOnly={isPendingCambio}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
                className="min-h-[50px] w-full rounded-lg border-2 border-slate-200 bg-slate-50/60 pr-13 pl-11 text-base font-medium text-slate-900 shadow-inner transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none read-only:cursor-not-allowed read-only:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowConfirmarPassword((prev) => !prev)}
                disabled={isPendingCambio}
                aria-label={
                  showConfirmarPassword
                    ? 'Ocultar confirmación'
                    : 'Mostrar confirmación'
                }
                className="touch-manipulation absolute right-0.5 flex h-[46px] min-h-[44px] w-[46px] min-w-[44px] items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
              >
                {showConfirmarPassword ? (
                  <EyeOff className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isPendingCambio}
              className="touch-manipulation group relative flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-lg border-b-4 border-red-950 bg-gradient-to-b from-[#D91636] to-[#B00D27] px-5 py-3 text-base font-extrabold tracking-wide text-white shadow-md transition-all hover:from-[#C8102E] hover:to-[#990B21] active:translate-y-[2px] active:border-b-2 focus:ring-4 focus:ring-[#FFCD00]/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-75"
            >
              {isPendingCambio ? (
                <>
                  <Loader2
                    className="h-5 w-5 animate-spin text-[#FFCD00]"
                    strokeWidth={2.5}
                  />
                  <span>Guardando clave...</span>
                </>
              ) : (
                <>
                  <span>Guardar Nueva Clave e Ingresar</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-[#FFCD00] text-slate-950 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
          CONEXIÓN CIFRADA TLS
        </span>
        <span className="font-mono text-[11px] font-semibold text-slate-400">
          EUROPOS • 3FN
        </span>
      </div>
    </div>
  );
};
