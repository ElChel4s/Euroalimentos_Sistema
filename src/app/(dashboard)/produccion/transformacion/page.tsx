import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type {
  PerfilProduccionResumen,
  ProductoProduccionItem,
} from '@/components/produccion/IngresoLotesClient';
import { TransformacionClient } from '@/components/produccion/TransformacionClient';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { FormatoProductoEnum } from '@/types/database.types';

interface ProductoTransformacionRow {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  stock_fisico_kilos: number;
  stock_comprometido_kilos: number;
  stock_disponible_kilos: number | null;
}

async function TransformacionContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'PRODUCCION' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    redirect('/login');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('productos')
    .select(
      'id_producto, codigo_sku, nombre_producto, formato, stock_fisico_kilos, stock_comprometido_kilos, stock_disponible_kilos'
    )
    .eq('activo', true)
    .in('formato', ['GRANEL', 'VACIO'])
    .order('nombre_producto', { ascending: true });

  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Error al cargar productos para transformación
        </h1>
        <p className="mt-1 text-sm text-slate-600">{error.message}</p>
      </div>
    );
  }

  const rows = (data ?? []) as ProductoTransformacionRow[];
  const productosNormalizados: ProductoProduccionItem[] = rows.map((row) => ({
    id_producto: row.id_producto,
    codigo_sku: row.codigo_sku,
    nombre_producto: row.nombre_producto,
    formato: row.formato,
    stock_fisico_kilos: Number(row.stock_fisico_kilos ?? 0),
    stock_comprometido_kilos: Number(row.stock_comprometido_kilos ?? 0),
    stock_disponible_kilos: Number(
      row.stock_disponible_kilos ??
        Number(row.stock_fisico_kilos ?? 0) -
          Number(row.stock_comprometido_kilos ?? 0)
    ),
  }));

  const productosGranel = productosNormalizados
    .filter((p) => p.formato === 'GRANEL')
    .sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto, 'es'));

  const productosVacio = productosNormalizados
    .filter((p) => p.formato === 'VACIO')
    .sort((a, b) => {
      const diff = a.stock_disponible_kilos - b.stock_disponible_kilos;
      if (diff !== 0) return diff;
      return a.nombre_producto.localeCompare(b.nombre_producto, 'es');
    });

  const perfilProduccion: PerfilProduccionResumen = {
    turno_planta: usuario.perfil_produccion?.turno_planta ?? 'MAÑANA',
    responsable_camara_frio:
      usuario.perfil_produccion?.responsable_camara_frio ?? true,
    tolerancia_merma_max_pct: Number(
      usuario.perfil_produccion?.tolerancia_merma_max_pct ?? 5.0
    ),
  };

  return (
    <TransformacionClient
      productosGranel={productosGranel}
      productosVacio={productosVacio}
      perfilProduccion={perfilProduccion}
    />
  );
}

export default function TransformacionPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Cargando estación de transformación..." />
      }
    >
      <TransformacionContent />
    </Suspense>
  );
}
