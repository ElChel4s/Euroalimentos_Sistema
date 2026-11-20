import * as XLSX from 'xlsx';

export interface VentaDiariaSacExcelRow {
  nro_nota: string;
  fecha_venta: string;
  codigo_cliente: string;
  cliente: string;
  zona_mercado: string;
  vendedor: string;
  total_kilos_vendidos: number;
  total_kilos_cortesia: number;
  monto_total_bs: number;
}

export interface VentaDesglosadaSacExcelRow {
  fecha_venta: string;
  nro_nota: string | number;
  nro_documento_sac: string | number | null;
  tipo_venta: 'CONTADO' | 'CREDITO' | string;
  plazo_dias: number;
  nit_ci: string | null;
  razon_social: string | null;
  codigo_cliente: string;
  cliente: string;
  codigo_empleado_sac: string | null;
  vendedor: string;
  codigo_sku: string;
  producto: string;
  cantidad_final_kilos: number;
  unidad_medida: string;
  peso_unidad_kilos: number;
  cantidad_facturada_unidad_o_kg: number;
  precio_unitario_congelado: number;
  costo_unitario_bs: number;
  subtotal_bs: number;
  es_cortesia: boolean;
}

export interface ReporteSemanalInventarioExcelRow {
  codigo: string;
  descripcion: string;
  saldo_inicial: number;
  ingresos_produccion: number;
  transformacion_granel_a_vacio: number;
  merma_por_escurrido: number;
  total_ventas_despachadas: number;
  total_salidas_por_cortesia: number;
  reingresos_anulacion_rebotes: number;
  saldo_final: number;
}

export interface LogProductoKardexExcelRow {
  fecha_hora: string;
  codigo_sku: string;
  nombre_producto: string;
  presentacion: string;
  tipo_movimiento_label: string;
  documento_origen: string;
  cliente_destino: string;
  responsable: string;
  kilos_movimiento: number;
  saldo_resultante_kilos: number;
  valor_movimiento_bs: number;
  es_cortesia: boolean;
}

export interface OpcionesExportacionExcel {
  nombreArchivo: string;
  tituloHoja: string;
  rangoDesde?: string;
  rangoHasta?: string;
  columnasActivas: Record<string, boolean>;
  incluirFilaTotales: boolean;
  incluirColumnasCortesia: boolean;
  formatoNumericoContable: boolean;
}

function sanitizarNombreArchivo(raw: string, fallback: string): string {
  const base = (raw || fallback)
    .trim()
    .replace(/\.xlsx$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_');
  return `${base || fallback}.xlsx`;
}

function aplicarFormatoCelda(
  ws: XLSX.WorkSheet,
  rowIndex: number,
  colIndex: number,
  numFmt: string
) {
  const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  const cell = ws[cellRef] as XLSX.CellObject | undefined;
  if (cell && cell.t === 'n') {
    cell.z = numFmt;
  }
}

function calcularAnchosColumnas(
  rows: (string | number)[][],
  startRow = 2
): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const cols: XLSX.ColInfo[] = [];

  for (let c = 0; c < maxCols; c++) {
    let maxLen = 12;
    for (let r = startRow; r < rows.length; r++) {
      const val = rows[r]?.[c];
      if (val !== undefined && val !== null) {
        const len = String(val).length + 3;
        if (len > maxLen) maxLen = len;
      }
    }
    cols.push({ wch: Math.min(maxLen, 42) });
  }

  return cols;
}

function formatFechaHoraSac(raw: string): string {
  const limpio = (raw ?? '').trim();
  if (!limpio) return '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(limpio)) {
    return limpio;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    return `${limpio} 00:00:00`;
  }

  const parsed = new Date(limpio);
  if (Number.isNaN(parsed.getTime())) {
    return limpio;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsed);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get(
    'minute'
  )}:${get('second')}`;
}

function resolverNroDocumentoSac(row: VentaDesglosadaSacExcelRow): number {
  const rawSac = row.nro_documento_sac;
  if (rawSac !== null && rawSac !== undefined && String(rawSac).trim() !== '') {
    const parsedSac = Number(rawSac);
    if (Number.isFinite(parsedSac)) {
      return parsedSac;
    }
  }
  const parsedNota = Number(row.nro_nota);
  return Number.isFinite(parsedNota) ? parsedNota : 0;
}

/**
 * Genera y descarga el libro Excel (.xlsx) del Diario de Ventas SAC.
 */
export function exportarVentasSacExcel(
  filas: VentaDiariaSacExcelRow[],
  opciones: OpcionesExportacionExcel
): void {
  const colsActivas = opciones.columnasActivas;
  const mostrarCortesia =
    Boolean(colsActivas.total_kilos_cortesia) &&
    opciones.incluirColumnasCortesia;

  const definicionColumnas: {
    key: string;
    header: string;
    kind: 'text' | 'kg' | 'bs';
    getter: (row: VentaDiariaSacExcelRow) => string | number;
  }[] = [];

  if (colsActivas.nro_nota) {
    definicionColumnas.push({
      key: 'nro_nota',
      header: 'Nº Nota',
      kind: 'text',
      getter: (r) => r.nro_nota,
    });
  }
  if (colsActivas.fecha_venta) {
    definicionColumnas.push({
      key: 'fecha_venta',
      header: 'Fecha',
      kind: 'text',
      getter: (r) => r.fecha_venta,
    });
  }
  if (colsActivas.codigo_cliente) {
    definicionColumnas.push({
      key: 'codigo_cliente',
      header: 'Cód. Cliente SAC',
      kind: 'text',
      getter: (r) => r.codigo_cliente,
    });
  }
  if (colsActivas.cliente) {
    definicionColumnas.push({
      key: 'cliente',
      header: 'Cliente',
      kind: 'text',
      getter: (r) => r.cliente,
    });
  }
  if (colsActivas.zona_mercado) {
    definicionColumnas.push({
      key: 'zona_mercado',
      header: 'Zona',
      kind: 'text',
      getter: (r) => r.zona_mercado,
    });
  }
  if (colsActivas.vendedor) {
    definicionColumnas.push({
      key: 'vendedor',
      header: 'Vendedor',
      kind: 'text',
      getter: (r) => r.vendedor,
    });
  }
  if (colsActivas.total_kilos_vendidos) {
    definicionColumnas.push({
      key: 'total_kilos_vendidos',
      header: 'Kilos Facturados',
      kind: 'kg',
      getter: (r) => Number(r.total_kilos_vendidos.toFixed(3)),
    });
  }
  if (mostrarCortesia) {
    definicionColumnas.push({
      key: 'total_kilos_cortesia',
      header: 'Kilos Cortesía (0 Bs)',
      kind: 'kg',
      getter: (r) => Number(r.total_kilos_cortesia.toFixed(3)),
    });
  }
  if (colsActivas.monto_total_bs) {
    definicionColumnas.push({
      key: 'monto_total_bs',
      header: 'Monto Total (Bs.)',
      kind: 'bs',
      getter: (r) => Number(r.monto_total_bs.toFixed(2)),
    });
  }

  const titulo =
    opciones.tituloHoja.trim() || 'EUROALIMENTOS SRL — DIARIO DE VENTAS SAC';
  const subtitulo = `Rango: ${opciones.rangoDesde || 'Inicio'} al ${
    opciones.rangoHasta || 'Actual'
  } • Registros: ${filas.length}`;

  const aoa: (string | number)[][] = [
    [titulo],
    [subtitulo],
    [],
    definicionColumnas.map((c) => c.header),
  ];

  const headerRowIdx = 3;
  filas.forEach((fila) => {
    aoa.push(definicionColumnas.map((col) => col.getter(fila)));
  });

  let totalRowIdx = -1;
  if (opciones.incluirFilaTotales && definicionColumnas.length > 0) {
    const sumVendidos = Number(
      filas.reduce((acc, r) => acc + r.total_kilos_vendidos, 0).toFixed(3)
    );
    const sumCortesia = Number(
      filas.reduce((acc, r) => acc + r.total_kilos_cortesia, 0).toFixed(3)
    );
    const sumMonto = Number(
      filas.reduce((acc, r) => acc + r.monto_total_bs, 0).toFixed(2)
    );

    const totalRow = definicionColumnas.map((col, idx) => {
      if (col.key === 'total_kilos_vendidos') return sumVendidos;
      if (col.key === 'total_kilos_cortesia') return sumCortesia;
      if (col.key === 'monto_total_bs') return sumMonto;
      return idx === 0 ? 'TOTALES GENERALES' : '';
    });

    totalRowIdx = aoa.length;
    aoa.push(totalRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = calcularAnchosColumnas(aoa);

  if (opciones.formatoNumericoContable) {
    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      definicionColumnas.forEach((col, c) => {
        if (col.kind === 'kg') {
          aplicarFormatoCelda(ws, r, c, '#,##0.000');
        } else if (col.kind === 'bs') {
          aplicarFormatoCelda(ws, r, c, '#,##0.00');
        }
      });
    }
    if (totalRowIdx !== -1) {
      definicionColumnas.forEach((col, c) => {
        if (col.kind === 'kg') {
          aplicarFormatoCelda(ws, totalRowIdx, c, '#,##0.000');
        } else if (col.kind === 'bs') {
          aplicarFormatoCelda(ws, totalRowIdx, c, '#,##0.00');
        }
      });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Diario_SAC');
  XLSX.writeFile(
    wb,
    sanitizarNombreArchivo(opciones.nombreArchivo, 'EUROALIMENTOS_SAC')
  );
}

/**
 * Genera y descarga el libro Excel (.xlsx) de la Bitácora Cronológica por Producto.
 * Excluye explícitamente cualquier columna de merma.
 */
export function exportarBitacoraProductoExcel(
  filas: LogProductoKardexExcelRow[],
  opciones: OpcionesExportacionExcel
): void {
  const colsActivas = opciones.columnasActivas;

  const definicionColumnas: {
    key: string;
    header: string;
    kind: 'text' | 'kg' | 'bs';
    getter: (row: LogProductoKardexExcelRow) => string | number;
  }[] = [];

  if (colsActivas.fecha_hora) {
    definicionColumnas.push({
      key: 'fecha_hora',
      header: 'Fecha y Hora',
      kind: 'text',
      getter: (r) => r.fecha_hora,
    });
  }
  if (colsActivas.producto_sku) {
    definicionColumnas.push(
      {
        key: 'codigo_sku',
        header: 'SKU',
        kind: 'text',
        getter: (r) => r.codigo_sku,
      },
      {
        key: 'nombre_producto',
        header: 'Producto',
        kind: 'text',
        getter: (r) => r.nombre_producto,
      },
      {
        key: 'presentacion',
        header: 'Formato',
        kind: 'text',
        getter: (r) => r.presentacion,
      }
    );
  }
  if (colsActivas.tipo_movimiento) {
    definicionColumnas.push({
      key: 'tipo_movimiento',
      header: 'Tipo Movimiento',
      kind: 'text',
      getter: (r) => r.tipo_movimiento_label,
    });
  }
  if (colsActivas.documento_origen) {
    definicionColumnas.push({
      key: 'documento_origen',
      header: 'Documento Origen',
      kind: 'text',
      getter: (r) => r.documento_origen,
    });
  }
  if (colsActivas.cliente_destino) {
    definicionColumnas.push({
      key: 'cliente_destino',
      header: 'Cliente / Destino',
      kind: 'text',
      getter: (r) => r.cliente_destino,
    });
  }
  if (colsActivas.responsable) {
    definicionColumnas.push({
      key: 'responsable',
      header: 'Responsable',
      kind: 'text',
      getter: (r) => r.responsable,
    });
  }
  if (colsActivas.kilos_movimiento) {
    definicionColumnas.push({
      key: 'kilos_movimiento',
      header: 'Kilos Mov.',
      kind: 'kg',
      getter: (r) => Number(r.kilos_movimiento.toFixed(3)),
    });
  }
  if (colsActivas.saldo_valor) {
    definicionColumnas.push(
      {
        key: 'saldo_resultante_kilos',
        header: 'Saldo Resultante (Kg)',
        kind: 'kg',
        getter: (r) => Number(r.saldo_resultante_kilos.toFixed(3)),
      },
      {
        key: 'valor_movimiento_bs',
        header: 'Valorización (Bs.)',
        kind: 'bs',
        getter: (r) => Number(r.valor_movimiento_bs.toFixed(2)),
      }
    );
  }

  const titulo =
    opciones.tituloHoja.trim() ||
    'EUROALIMENTOS SRL — BITÁCORA DE TRAZABILIDAD POR PRODUCTO';
  const subtitulo = `Rango: ${opciones.rangoDesde || 'Inicio'} al ${
    opciones.rangoHasta || 'Actual'
  } • Movimientos: ${filas.length}`;

  const aoa: (string | number)[][] = [
    [titulo],
    [subtitulo],
    [],
    definicionColumnas.map((c) => c.header),
  ];

  const headerRowIdx = 3;
  filas.forEach((fila) => {
    aoa.push(definicionColumnas.map((col) => col.getter(fila)));
  });

  if (opciones.incluirFilaTotales && definicionColumnas.length > 0) {
    const sumKilos = Number(
      filas.reduce((acc, r) => acc + r.kilos_movimiento, 0).toFixed(3)
    );
    const sumBs = Number(
      filas.reduce((acc, r) => acc + r.valor_movimiento_bs, 0).toFixed(2)
    );

    aoa.push(
      definicionColumnas.map((col, idx) => {
        if (col.key === 'kilos_movimiento') return sumKilos;
        if (col.key === 'valor_movimiento_bs') return sumBs;
        return idx === 0 ? 'TOTALES BITÁCORA' : '';
      })
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = calcularAnchosColumnas(aoa);

  if (opciones.formatoNumericoContable) {
    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      definicionColumnas.forEach((col, c) => {
        if (col.kind === 'kg') {
          aplicarFormatoCelda(ws, r, c, '#,##0.000');
        } else if (col.kind === 'bs') {
          aplicarFormatoCelda(ws, r, c, '#,##0.00');
        }
      });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bitacora_Producto');
  XLSX.writeFile(
    wb,
    sanitizarNombreArchivo(opciones.nombreArchivo, 'EUROALIMENTOS_BITACORA')
  );
}

const HEADERS_VENTAS_SAC_34: readonly string[] = [
  'Fecha',
  'Tipo Doc.',
  'Nro. Suc',
  'Nº doc/fac',
  'N° Aut',
  'Cod Control',
  'Estado',
  'Nit',
  'Razon Social',
  'Tipo Venta',
  'Plazo',
  'Moneda',
  'TC',
  'Desc. Fin',
  'Suc. Cliente',
  'Cod. Cliente',
  'Nom. Cliente',
  'Cod. Vendedor',
  'Nom. Vendedor',
  'Codigo Prd.',
  'Nombre Prd.',
  'Detalle Servicio',
  'Cantidad',
  'Precio',
  'Desc x Prd.',
  'Costo',
  'Unid. Medida',
  'Empresa',
  'Categoria',
  'Linea',
  'Marca',
  'Detalle Venta',
  'Centro Costo',
  'Objeto',
];

/**
 * Genera y descarga el libro Excel (.xlsx) plano de Ventas Desglosadas SAC
 * compatible con importación directa a `VENTAS.xls` (34 columnas exactas, hoja `Hoja1`,
 * encabezados en Fila 1 y registros desde Fila 2 sin títulos ni fila de totales).
 */
export function exportarVentasSacDesglosadoExcel(
  filas: VentaDesglosadaSacExcelRow[],
  opciones: OpcionesExportacionExcel
): void {
  const filasEfectivas = opciones.incluirColumnasCortesia
    ? filas
    : filas.filter((r) => !r.es_cortesia);

  const aoa: (string | number)[][] = [[...HEADERS_VENTAS_SAC_34]];

  for (const r of filasEfectivas) {
    const unidadUpper =
      String(r.unidad_medida ?? 'KILO').trim().toUpperCase() === 'UNIDAD'
        ? 'UNIDAD'
        : 'KILO';
    const pesoUnidad = Number(r.peso_unidad_kilos ?? 0);
    const cantidad =
      unidadUpper === 'UNIDAD'
        ? pesoUnidad > 0
          ? Math.round(Number(r.cantidad_final_kilos ?? 0) / pesoUnidad)
          : Math.round(
              Number(
                r.cantidad_facturada_unidad_o_kg ?? r.cantidad_final_kilos ?? 0
              )
            )
        : Number(Number(r.cantidad_final_kilos ?? 0).toFixed(3));

    const precio = r.es_cortesia
      ? 0
      : Number(r.precio_unitario_congelado ?? 0);
    const costo = Number(r.costo_unitario_bs ?? 0);
    const nroNotaStr = String(r.nro_nota ?? '').trim() || 'S/N';
    const detalleVenta = r.es_cortesia
      ? `NOTA DE VENTA-${nroNotaStr} (CORTESIA)`
      : `NOTA DE VENTA-${nroNotaStr}`;

    aoa.push([
      formatFechaHoraSac(r.fecha_venta), // 1. Fecha
      'VD', // 2. Tipo Doc.
      0, // 3. Nro. Suc
      resolverNroDocumentoSac(r), // 4. Nº doc/fac
      '', // 5. N° Aut
      '', // 6. Cod Control
      'V', // 7. Estado
      Number(r.nit_ci) || 0, // 8. Nit
      (r.razon_social ?? '').trim() || r.cliente, // 9. Razon Social
      String(r.tipo_venta ?? '').toUpperCase() === 'CREDITO'
        ? 'Credito'
        : 'Contado', // 10. Tipo Venta
      Number(r.plazo_dias ?? 0) || 0, // 11. Plazo
      'BS', // 12. Moneda
      6.96, // 13. TC
      0, // 14. Desc. Fin
      0, // 15. Suc. Cliente
      String(r.codigo_cliente ?? '').trim().replace(/^0-/, ''), // 16. Cod. Cliente
      r.cliente, // 17. Nom. Cliente
      (r.codigo_empleado_sac ?? '').trim() || 'EM-01', // 18. Cod. Vendedor
      r.vendedor, // 19. Nom. Vendedor
      r.codigo_sku, // 20. Codigo Prd.
      r.producto, // 21. Nombre Prd.
      '', // 22. Detalle Servicio
      cantidad, // 23. Cantidad
      precio, // 24. Precio
      0, // 25. Desc x Prd.
      costo, // 26. Costo
      unidadUpper, // 27. Unid. Medida
      'EUROALIMENTOS SRL', // 28. Empresa
      'PROD. TERMINADO', // 29. Categoria
      '', // 30. Linea
      '', // 31. Marca
      detalleVenta, // 32. Detalle Venta
      '', // 33. Centro Costo
      '', // 34. Objeto
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = calcularAnchosColumnas(aoa, 0);

  if (opciones.formatoNumericoContable) {
    for (let r = 1; r < aoa.length; r++) {
      const filaActual = filasEfectivas[r - 1];
      const esUnidad =
        String(filaActual?.unidad_medida ?? 'KILO').trim().toUpperCase() ===
        'UNIDAD';
      aplicarFormatoCelda(ws, r, 12, '0.00'); // TC
      aplicarFormatoCelda(ws, r, 22, esUnidad ? '#,##0' : '#,##0.000'); // Cantidad
      aplicarFormatoCelda(ws, r, 23, '#,##0.00'); // Precio
      aplicarFormatoCelda(ws, r, 25, '#,##0.00'); // Costo
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(
    wb,
    sanitizarNombreArchivo(opciones.nombreArchivo, 'EUROALIMENTOS_VENTAS_SAC')
  );
}

/**
 * Genera y descarga el Reporte Semanal Único de Inventario y Producción
 * (Cierre de Sábados) con sus 10 columnas contables exactas.
 */
export function exportarReporteSemanalInventarioExcel(
  filas: ReporteSemanalInventarioExcelRow[],
  opciones: OpcionesExportacionExcel
): void {
  const colsActivas = opciones.columnasActivas;

  const definicionColumnas: {
    key: keyof ReporteSemanalInventarioExcelRow;
    header: string;
    kind: 'text' | 'kg';
    getter: (row: ReporteSemanalInventarioExcelRow) => string | number;
  }[] = [];

  if (colsActivas.codigo !== false) {
    definicionColumnas.push({
      key: 'codigo',
      header: 'Código / Ítem',
      kind: 'text',
      getter: (r) => r.codigo,
    });
  }
  if (colsActivas.descripcion !== false) {
    definicionColumnas.push({
      key: 'descripcion',
      header: 'Descripción del Producto',
      kind: 'text',
      getter: (r) => r.descripcion,
    });
  }
  if (colsActivas.saldo_inicial !== false) {
    definicionColumnas.push({
      key: 'saldo_inicial',
      header: 'Saldo Inicial Semana (Kg)',
      kind: 'kg',
      getter: (r) => Number(r.saldo_inicial.toFixed(3)),
    });
  }
  if (colsActivas.ingresos_produccion !== false) {
    definicionColumnas.push({
      key: 'ingresos_produccion',
      header: 'Ingresos Producción (Kg)',
      kind: 'kg',
      getter: (r) => Number(r.ingresos_produccion.toFixed(3)),
    });
  }
  if (colsActivas.transformacion_granel_a_vacio !== false) {
    definicionColumnas.push({
      key: 'transformacion_granel_a_vacio',
      header: 'Transformación Granel → Vacío (+/- Kg)',
      kind: 'kg',
      getter: (r) => Number(r.transformacion_granel_a_vacio.toFixed(3)),
    });
  }
  if (colsActivas.merma_por_escurrido !== false) {
    definicionColumnas.push({
      key: 'merma_por_escurrido',
      header: 'Merma por Escurrido / Empaque (Kg)',
      kind: 'kg',
      getter: (r) => Number(r.merma_por_escurrido.toFixed(3)),
    });
  }
  if (colsActivas.total_ventas_despachadas !== false) {
    definicionColumnas.push({
      key: 'total_ventas_despachadas',
      header: 'Total Ventas Despachadas (Kg)',
      kind: 'kg',
      getter: (r) => Number(r.total_ventas_despachadas.toFixed(3)),
    });
  }
  if (colsActivas.total_salidas_por_cortesia !== false) {
    definicionColumnas.push({
      key: 'total_salidas_por_cortesia',
      header: 'Total Salidas por Cortesía (Kg)',
      kind: 'kg',
      getter: (r) => Number(r.total_salidas_por_cortesia.toFixed(3)),
    });
  }
  if (colsActivas.reingresos_anulacion_rebotes !== false) {
    definicionColumnas.push({
      key: 'reingresos_anulacion_rebotes',
      header: 'Reingresos por Rebotes (Kg)',
      kind: 'kg',
      getter: (r) => Number(r.reingresos_anulacion_rebotes.toFixed(3)),
    });
  }
  if (colsActivas.saldo_final !== false) {
    definicionColumnas.push({
      key: 'saldo_final',
      header: 'Saldo Final en Sistema (Kg)',
      kind: 'kg',
      getter: (r) => Number(r.saldo_final.toFixed(3)),
    });
  }

  const titulo =
    opciones.tituloHoja.trim() ||
    'EUROALIMENTOS SRL — REPORTE SEMANAL DE INVENTARIO Y PRODUCCIÓN (CIERRE SÁBADO)';
  const subtitulo = `Periodo: ${opciones.rangoDesde || 'Inicio'} al ${
    opciones.rangoHasta || 'Actual'
  } • SKUs: ${filas.length}`;

  const aoa: (string | number)[][] = [
    [titulo],
    [subtitulo],
    [],
    definicionColumnas.map((c) => c.header),
  ];

  const headerRowIdx = 3;
  filas.forEach((fila) => {
    aoa.push(definicionColumnas.map((col) => col.getter(fila)));
  });

  if (opciones.incluirFilaTotales && definicionColumnas.length > 0) {
    aoa.push(
      definicionColumnas.map((col, idx) => {
        if (col.kind === 'kg') {
          const sum = filas.reduce(
            (acc, r) => acc + Number(r[col.key] ?? 0),
            0
          );
          return Number(sum.toFixed(3));
        }
        return idx === 0 ? 'TOTALES DEL PERIODO SEMANAL' : '';
      })
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = calcularAnchosColumnas(aoa);

  if (opciones.formatoNumericoContable) {
    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      definicionColumnas.forEach((col, c) => {
        if (col.kind === 'kg') {
          aplicarFormatoCelda(ws, r, c, '#,##0.000');
        }
      });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte_Semanal_Inventario');
  XLSX.writeFile(
    wb,
    sanitizarNombreArchivo(
      opciones.nombreArchivo,
      'EUROALIMENTOS_REPORTE_SEMANAL'
    )
  );
}

