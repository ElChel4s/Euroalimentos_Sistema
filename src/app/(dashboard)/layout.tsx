import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { DashboardShell } from '@/components/ui/DashboardShell';

async function DashboardAuthBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioConPerfilActivo();

  if (!usuario) {
    redirect('/login');
  }

  return <DashboardShell usuario={usuario}>{children}</DashboardShell>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-slate-50 text-slate-600 text-sm font-medium">
          Cargando entorno operativo...
        </div>
      }
    >
      <DashboardAuthBoundary>{children}</DashboardAuthBoundary>
    </Suspense>
  );
}

