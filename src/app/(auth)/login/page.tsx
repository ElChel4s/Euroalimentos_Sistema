import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import {
  Award,
  CheckCircle2,
  Scale,
  ShieldCheck,
  Smartphone,
  Truck,
} from 'lucide-react';
import {
  CharcuteriePatternBg,
  EuroalimentosEmblem,
} from '@/components/forms/LoginBranding';
import { LoginForm } from '@/components/forms/LoginForm';
import { createClient } from '@/lib/supabase/server';
import { getRoleHomeRoute } from '@/lib/utils/roles';
import type { RolUsuarioEnum } from '@/types/database.types';

async function LoginSessionGate() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialError: string | null = null;

  if (user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol, activo')
      .eq('auth_id', user.id)
      .maybeSingle<{ rol: RolUsuarioEnum; activo: boolean }>();

    if (usuario) {
      if (usuario.activo) {
        redirect(getRoleHomeRoute(usuario.rol));
      }
      initialError = 'Su cuenta está desactivada. Contacte a Gerencia.';
    }
  }

  return <LoginForm initialError={initialError} />;
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#F1F5F9] text-slate-900 antialiased selection:bg-[#FFCD00] selection:text-slate-950 lg:flex-row">
      {/* Barra superior de identidad en Móvil/Tablet con trama SVG y borde amarillo */}
      <header className="sticky top-0 z-20 overflow-hidden border-b-4 border-[#FFCD00] bg-gradient-to-r from-[#B00D27] via-[#C8102E] to-[#A60C24] px-4 py-3 text-white shadow-md lg:hidden">
        <CharcuteriePatternBg variant="brand" />
        <div className="relative z-10 mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-3">
            <EuroalimentosEmblem size="sm" />
            <div>
              <span className="block text-base leading-none font-black tracking-tight text-white">
                EUROALIMENTOS SRL
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#FFCD00]">
                Embutidos • Preventa &amp; Planta
              </span>
            </div>
          </div>
          <span className="rounded-md border border-[#FFCD00]/50 bg-red-950/60 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-[#FFCD00] uppercase tabular-nums shadow-xs">
            BOLIVIA
          </span>
        </div>
      </header>

      {/* Panel Lateral Corporativo en Escritorio con Trama SVG */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r-4 border-[#FFCD00] bg-gradient-to-br from-[#C8102E] via-[#B30D28] to-[#85081C] p-10 text-white shadow-xl lg:flex lg:w-5/12 xl:w-[45%]">
        <CharcuteriePatternBg variant="brand" />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-radial from-transparent via-transparent to-black/25"
        />

        {/* Marca Superior */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-4">
            <EuroalimentosEmblem size="lg" />
            <div>
              <p className="text-2xl font-black tracking-tight text-white drop-shadow-xs">
                EUROALIMENTOS SRL
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-bold tracking-widest text-[#FFCD00] uppercase">
                <Award className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>Tradición &amp; Calidad en Embutidos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Propuesta Operativa Central */}
        <div className="relative z-10 my-auto max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#FFCD00]/40 bg-red-950/60 px-3.5 py-1.5 text-xs font-bold tracking-wide text-[#FFCD00] shadow-xs backdrop-blur-xs">
            <Scale className="h-4 w-4" strokeWidth={2.2} />
            <span>CONTROL DE INVENTARIO EN KILOS (KG)</span>
          </div>

          <h2 className="text-3xl leading-[1.15] font-black tracking-tight text-white xl:text-4xl">
            Del control en planta a la entrega puntual en ruta.
          </h2>

          <p className="text-sm leading-relaxed font-medium text-red-100/95">
            Plataforma unificada para toma de pedidos móviles, consolidación de
            carga en cámara fría y liquidación comercial en Bolivianos (Bs.).
          </p>

          <div className="grid grid-cols-1 gap-3.5 pt-2">
            <div className="flex items-center gap-4 rounded-xl border border-white/15 border-l-4 border-l-[#FFCD00] bg-red-950/45 p-4 shadow-sm backdrop-blur-xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFCD00] text-slate-950 shadow-xs">
                <Smartphone className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-white">
                  Preventa Móvil en Calle
                </p>
                <p className="mt-0.5 text-xs text-red-100/90">
                  Pedidos ágiles por kilogramo, clientes y fechas de entrega.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-white/15 border-l-4 border-l-[#FFCD00] bg-red-950/45 p-4 shadow-sm backdrop-blur-xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFCD00] text-slate-950 shadow-xs">
                <Truck className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-white">
                  Despacho &amp; Cámara Fría
                </p>
                <p className="mt-0.5 text-xs text-red-100/90">
                  Pesaje verificado por lote, rutas y tickets listos para
                  impresión.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pie del Panel Corporativo */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/20 pt-5 text-xs font-medium text-red-100">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-[#FFCD00]" strokeWidth={2} />
            Planta Industrial &amp; Distribución • Bolivia
          </span>
          <span className="rounded bg-red-950/60 px-2 py-0.5 font-mono text-[11px] font-bold text-[#FFCD00] tabular-nums">
            ERP-EA v2.4
          </span>
        </div>
      </aside>

      {/* Área Principal del Formulario */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-4 sm:px-6 sm:py-10 lg:px-12">
        <CharcuteriePatternBg variant="light" />

        <div className="relative z-10 mx-auto w-full max-w-[450px]">
          <div className="relative overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.12)]">
            <div className="flex h-2.5 w-full">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-5 right-5 flex items-center gap-1.5"
            >
              <span className="h-2 w-2 rounded-full bg-slate-200" />
              <span className="h-2 w-2 rounded-full bg-[#FFCD00]" />
              <span className="h-2 w-2 rounded-full bg-[#C8102E]" />
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-6 border-b-2 border-slate-100 pb-5">
                <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-[#FFCD00]/30 px-2.5 py-1 text-xs font-extrabold tracking-wide text-slate-900">
                  <span className="h-2 w-2 rounded-full bg-[#C8102E]" />
                  <span>PORTAL OPERATIVO</span>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-[27px]">
                  EUROALIMENTOS SRL
                </h1>
                <p className="mt-1.5 text-sm leading-snug font-medium text-slate-600">
                  Sistema POS, Preventa Móvil y Control de Despacho
                </p>
              </div>

              <Suspense fallback={<LoginForm />}>
                <LoginSessionGate />
              </Suspense>
            </div>
          </div>

          <footer className="mt-6 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-center shadow-2xs backdrop-blur-xs">
            <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck
                className="h-4 w-4 shrink-0 text-[#C8102E]"
                strokeWidth={2.2}
              />
              <span>
                Acceso exclusivo para personal autorizado (Vendedores, Despacho,
                Producción y Administración).
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[11px] font-medium text-slate-500 tabular-nums">
              © 2026 EUROALIMENTOS SRL — Bolivia
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

