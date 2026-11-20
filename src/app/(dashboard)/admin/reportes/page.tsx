import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { obtenerVentasDesglosadasSacAction } from '@/actions/admin.actions';
import {
  ReportesSacClient,
  type PerfilAdminReportes,
} from '@/components/admin/ReportesSacClient';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';

const TIMEZONE_BOLIVIA = 'America/La_Paz';

function obtenerFechaHoyBoliviaIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function ReportesSacContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    redirect('/login');
  }

  const ventasRes = await obtenerVentasDesglosadasSacAction({ limit: 3000 });

  if (!ventasRes.ok) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Error al cargar exportación contable SAC
        </h1>
        <p className="mt-1 text-sm text-slate-600">{ventasRes.error}</p>
      </div>
    );
  }

  const perfilAdmin: PerfilAdminReportes = {
    id_usuario: usuario.id_usuario,
    nombre_completo: usuario.nombre_completo,
    cargo_gerencial:
      usuario.perfil_administrador?.cargo_gerencial ?? 'Contabilidad SAC',
    puede_exportar_sac:
      usuario.perfil_administrador?.puede_exportar_sac ?? true,
  };

  return (
    <ReportesSacClient
      ventasDesglosadas={ventasRes.rows}
      perfilAdmin={perfilAdmin}
      fechaHoyBolivia={obtenerFechaHoyBoliviaIso()}
    />
  );
}

export default function AdminReportesPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Cargando exportación contable SAC..." />
      }
    >
      <ReportesSacContent />
    </Suspense>
  );
}
