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

function calcularAnchosColumnas(rows: (string | number)[][]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const cols: XLSX.ColInfo[] = [];

  for (let c = 0; c < maxCols; c++) {
    let maxLen = 12;
    for (let r = 2; r < rows.length; r++) {
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

