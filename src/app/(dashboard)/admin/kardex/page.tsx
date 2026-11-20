import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  obtenerBitacoraMovimientosKardexAction,
  obtenerReporteSemanalInventarioAction,
} from '@/actions/admin.actions';
import { KardexAuditoriaClient } from '@/components/admin/KardexAuditoriaClient';
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

async function KardexAuditoriaContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    redirect('/login');
  }

  const [semanalRes, kardexRes] = await Promise.all([
    obtenerReporteSemanalInventarioAction(),
    obtenerBitacoraMovimientosKardexAction({ limit: 1500 }),
  ]);

  if (!semanalRes.ok || !kardexRes.ok) {
    const errMsg =
      (!semanalRes.ok ? semanalRes.error : undefined) ??
      (!kardexRes.ok ? kardexRes.error : undefined) ??
      'Error desconocido al consultar auditoría de Kardex e inventario.';

    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Error al cargar Auditoría de Kardex e Inventario
        </h1>
        <p className="mt-1 text-sm text-slate-600">{errMsg}</p>
      </div>
    );
  }

  return (
    <KardexAuditoriaClient
      reporteSemanalInicial={semanalRes.data}
      movimientosKardexInicial={kardexRes.rows}
      fechaHoyBolivia={obtenerFechaHoyBoliviaIso()}
    />
  );
}

export default function AdminKardexPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Cargando auditoría de Kardex e inventario..." />
      }
    >
      <KardexAuditoriaContent />
    </Suspense>
  );
}
