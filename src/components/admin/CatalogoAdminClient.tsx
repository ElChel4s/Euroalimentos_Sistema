'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Store,
  Users,
  X,
} from 'lucide-react';
import {
  guardarClienteAction,
  guardarProductoAction,
  guardarUsuarioAction,
  guardarZonaAction,
  habilitarCambioClaveUsuarioAction,
  toggleClienteActivoAction,
  toggleProductoActivoAction,
  toggleUsuarioActivoAction,
  type ClienteSacAdminRow,
  type FormatoChorizoInput,
  type ProductoCatalogoAdminRow,
  type UsuarioSistemaAdminRow,
  type ZonaMercadoAdminRow,
} from '@/actions/admin.actions';
import type { RolUsuarioEnum } from '@/types/database.types';

export type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

export interface CatalogoAdminClientProps {
  productosIniciales: ProductoCatalogoAdminRow[];
  usuariosIniciales: UsuarioSistemaAdminRow[];
  zonasIniciales: ZonaMercadoAdminRow[];
  clientesIniciales: ClienteSacAdminRow[];
  usuarioActualId: number;
  migracionPendiente?: boolean;
}

const DESCRIPCION_ROLES: Record<
  RolUsuarioEnum,
  { etiqueta: string; funcion: string; badgeClass: string }
> = {
  VENDEDOR: {
    etiqueta: 'VENDEDOR',
    funcion: 'Preventa en calle',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  DESPACHADOR: {
    etiqueta: 'DESPACHADOR',
    funcion: 'Pesaje e impresión de tickets',
    badgeClass: 'border-sky-300 bg-sky-50 text-sky-900',
  },
  PRODUCCION: {
    etiqueta: 'PRODUCCION',
    funcion: 'Ingreso de lotes y empaque al vacío',
    badgeClass: 'border-purple-300 bg-purple-50 text-purple-900',
  },
  ADMINISTRADOR: {
    etiqueta: 'ADMINISTRADOR',
    funcion: 'Auditoría y reportes SAC',
    badgeClass: 'border-red-300 bg-red-50 text-[#C8102E]',
  },
};

function ActiveSwitch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-emerald-600' : 'bg-slate-400'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span>{label ?? (checked ? 'Activo' : 'Inactivo')}</span>
    </button>
  );
}

function PaginationBar({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t-2 border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
        <span className="font-mono tabular-nums">
          Mostrando {startIdx}–{endIdx} de {totalItems} registros
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">Por página:</span>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
          {[10, 20, 50].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => {
                onPageSizeChange(size);
                onPageChange(1);
              }}
              className={`min-h-[32px] min-w-[36px] rounded-md px-2 font-mono text-xs font-bold tabular-nums transition-colors ${
                pageSize === size
                  ? 'bg-[#0F172A] text-[#FFCD00]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
          <span>Anterior</span>
        </button>
        <span className="px-2 font-mono text-xs font-bold tabular-nums text-slate-800">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Siguiente</span>
          <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

export function CatalogoAdminClient({
  productosIniciales,
  usuariosIniciales,
  zonasIniciales,
  clientesIniciales,
  usuarioActualId,
  migracionPendiente = false,
}: CatalogoAdminClientProps) {
  const router = useRouter();

  const [productos, setProductos] =
    useState<ProductoCatalogoAdminRow[]>(productosIniciales);
  const [usuarios, setUsuarios] =
    useState<UsuarioSistemaAdminRow[]>(usuariosIniciales);
  const [zonas, setZonas] = useState<ZonaMercadoAdminRow[]>(zonasIniciales);
  const [clientes, setClientes] =
    useState<ClienteSacAdminRow[]>(clientesIniciales);

  const [tabActiva, setTabActiva] = useState<
    'CHORIZOS' | 'USUARIOS' | 'CLIENTES'
  >('CHORIZOS');
  const [guardandoGlobal, setGuardandoGlobal] = useState(false);

  const [toastMsg, setToastMsg] = useState<{
    tipo: 'ok' | 'warn';
    texto: string;
  } | null>(null);

  const notificar = (texto: string, tipo: 'ok' | 'warn' = 'ok') => {
    setToastMsg({ tipo, texto });
  };

  // ==========================================================================
  // PESTAÑA 1: CHORIZOS Y PRECIOS
  // ==========================================================================
  const [busquedaProd, setBusquedaProd] = useState('');
  const [filtroFormatoProd, setFiltroFormatoProd] = useState<
    'TODOS' | FormatoChorizoInput
  >('TODOS');
  const [filtroEstadoProd, setFiltroEstadoProd] =
    useState<FiltroEstado>('TODOS');
  const [pageProd, setPageProd] = useState(1);
  const [pageSizeProd, setPageSizeProd] = useState(10);

  const [precioInlineId, setPrecioInlineId] = useState<number | null>(null);
  const [precioInlineValor, setPrecioInlineValor] = useState<string>('');

  const [modalProdAbierto, setModalProdAbierto] = useState(false);
  const [prodEditando, setProdEditando] =
    useState<ProductoCatalogoAdminRow | null>(null);
  const [formProd, setFormProd] = useState<{
    codigo_sku: string;
    nombre_producto: string;
    formato: FormatoChorizoInput;
    precio_kilo_bs: string;
    activo: boolean;
  }>({
    codigo_sku: '',
    nombre_producto: '',
    formato: 'GRANEL',
    precio_kilo_bs: '',
    activo: true,
  });

  // ==========================================================================
  // PESTAÑA 2: USUARIOS DEL SISTEMA
  // ==========================================================================
  const [busquedaUsr, setBusquedaUsr] = useState('');
  const [filtroRolUsr, setFiltroRolUsr] = useState<'TODOS' | RolUsuarioEnum>(
    'TODOS'
  );
  const [filtroEstadoUsr, setFiltroEstadoUsr] =
    useState<FiltroEstado>('TODOS');
  const [pageUsr, setPageUsr] = useState(1);
  const [pageSizeUsr, setPageSizeUsr] = useState(10);

  const [modalUsrAbierto, setModalUsrAbierto] = useState(false);
  const [usrEditando, setUsrEditando] =
    useState<UsuarioSistemaAdminRow | null>(null);
  const [formUsr, setFormUsr] = useState<{
    nombre_completo: string;
    username: string;
    password: string;
    telefono: string;
    rol: RolUsuarioEnum;
    activo: boolean;
  }>({
    nombre_completo: '',
    username: '',
    password: '',
    telefono: '',
    rol: 'VENDEDOR',
    activo: true,
  });

  const [usuarioConfirmCambioClave, setUsuarioConfirmCambioClave] =
    useState<UsuarioSistemaAdminRow | null>(null);

  // ==========================================================================
  // PESTAÑA 3: CLIENTES Y ZONAS SAC
  // ==========================================================================
  const [busquedaCli, setBusquedaCli] = useState('');
  const [filtroZonaCli, setFiltroZonaCli] = useState<string>('TODAS');
  const [filtroEstadoCli, setFiltroEstadoCli] =
    useState<FiltroEstado>('TODOS');
  const [pageCli, setPageCli] = useState(1);
  const [pageSizeCli, setPageSizeCli] = useState(10);

  const [modalCliAbierto, setModalCliAbierto] = useState(false);
  const [cliEditando, setCliEditando] = useState<ClienteSacAdminRow | null>(
    null
  );
  const [formCli, setFormCli] = useState<{
    codigo_cliente_sac: string;
    nombre_comercial: string;
    nit_ci: string;
    telefono: string;
    id_zona: number;
    activo: boolean;
  }>({
    codigo_cliente_sac: '',
    nombre_comercial: '',
    nit_ci: '',
    telefono: '',
    id_zona: zonas[0]?.id_zona ?? 0,
    activo: true,
  });

  const [modalZonasAbierto, setModalZonasAbierto] = useState(false);
  const [zonaEditandoId, setZonaEditandoId] = useState<number | null>(null);
  const [formZona, setFormZona] = useState({
    nombre_zona: '',
    ciudad: 'La Paz',
    activo: true,
  });

  // ==========================================================================
  // FILTROS Y PAGINACIÓN
  // ==========================================================================
  const productosFiltrados = useMemo(() => {
    const q = busquedaProd.trim().toLowerCase();
    return productos.filter((p) => {
      const matchTexto =
        !q ||
        p.codigo_sku.toLowerCase().includes(q) ||
        p.nombre_producto.toLowerCase().includes(q);
      const matchFmt =
        filtroFormatoProd === 'TODOS' || p.formato === filtroFormatoProd;
      const matchEst =
        filtroEstadoProd === 'TODOS' ||
        (filtroEstadoProd === 'ACTIVOS' && p.activo) ||
        (filtroEstadoProd === 'INACTIVOS' && !p.activo);
      return matchTexto && matchFmt && matchEst;
    });
  }, [productos, busquedaProd, filtroFormatoProd, filtroEstadoProd]);

  const productosPaginados = useMemo(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(productosFiltrados.length / pageSizeProd)
    );
    const safePage = Math.min(pageProd, totalPages);
    const start = (safePage - 1) * pageSizeProd;
    return productosFiltrados.slice(start, start + pageSizeProd);
  }, [productosFiltrados, pageProd, pageSizeProd]);

  const usuariosFiltrados = useMemo(() => {
    const q = busquedaUsr.trim().toLowerCase();
    return usuarios.filter((u) => {
      const matchTexto =
        !q ||
        u.nombre_completo.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.telefono.toLowerCase().includes(q);
      const matchRol = filtroRolUsr === 'TODOS' || u.rol === filtroRolUsr;
      const matchEst =
        filtroEstadoUsr === 'TODOS' ||
        (filtroEstadoUsr === 'ACTIVOS' && u.activo) ||
        (filtroEstadoUsr === 'INACTIVOS' && !u.activo);
      return matchTexto && matchRol && matchEst;
    });
  }, [usuarios, busquedaUsr, filtroRolUsr, filtroEstadoUsr]);

  const usuariosPaginados = useMemo(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(usuariosFiltrados.length / pageSizeUsr)
    );
    const safePage = Math.min(pageUsr, totalPages);
    const start = (safePage - 1) * pageSizeUsr;
    return usuariosFiltrados.slice(start, start + pageSizeUsr);
  }, [usuariosFiltrados, pageUsr, pageSizeUsr]);

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCli.trim().toLowerCase();
    return clientes.filter((c) => {
      const matchTexto =
        !q ||
        c.nombre_comercial.toLowerCase().includes(q) ||
        c.codigo_cliente_sac.toLowerCase().includes(q) ||
        c.nit_ci.toLowerCase().includes(q) ||
        c.telefono.toLowerCase().includes(q);
      const matchZona =
        filtroZonaCli === 'TODAS' || String(c.id_zona) === filtroZonaCli;
      const matchEst =
        filtroEstadoCli === 'TODOS' ||
        (filtroEstadoCli === 'ACTIVOS' && c.activo) ||
        (filtroEstadoCli === 'INACTIVOS' && !c.activo);
      return matchTexto && matchZona && matchEst;
    });
  }, [clientes, busquedaCli, filtroZonaCli, filtroEstadoCli]);

  const clientesPaginados = useMemo(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(clientesFiltrados.length / pageSizeCli)
    );
    const safePage = Math.min(pageCli, totalPages);
    const start = (safePage - 1) * pageSizeCli;
    return clientesFiltrados.slice(start, start + pageSizeCli);
  }, [clientesFiltrados, pageCli, pageSizeCli]);

  // ==========================================================================
  // HANDLERS CHORIZOS
  // ==========================================================================
  const abrirModalNuevoChorizo = () => {
    setProdEditando(null);
    setFormProd({
      codigo_sku: '',
      nombre_producto: '',
      formato: 'GRANEL',
      precio_kilo_bs: '',
      activo: true,
    });
    setModalProdAbierto(true);
  };

  const abrirModalEditarChorizo = (prod: ProductoCatalogoAdminRow) => {
    setProdEditando(prod);
    setFormProd({
      codigo_sku: prod.codigo_sku,
      nombre_producto: prod.nombre_producto,
      formato: prod.formato,
      precio_kilo_bs: prod.precio_kilo_bs.toFixed(2),
      activo: prod.activo,
    });
    setModalProdAbierto(true);
  };

  const guardarChorizoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const precioNum = parseFloat(formProd.precio_kilo_bs);
    if (
      !formProd.codigo_sku.trim() ||
      !formProd.nombre_producto.trim() ||
      Number.isNaN(precioNum) ||
      precioNum <= 0
    ) {
      notificar(
        'Verifica el SKU, variedad de chorizo y precio válido en Bs.',
        'warn'
      );
      return;
    }

    setGuardandoGlobal(true);
    try {
      const res = await guardarProductoAction({
        id_producto: prodEditando?.id_producto,
        codigo_sku: formProd.codigo_sku.trim().toUpperCase(),
        nombre_producto: formProd.nombre_producto.trim(),
        formato: formProd.formato,
        precio_kilo_bs: Number(precioNum.toFixed(2)),
        activo: formProd.activo,
      });

      if (!res.ok) {
        notificar(res.error, 'warn');
        return;
      }

      if (prodEditando) {
        setProductos((prev) =>
          prev.map((p) =>
            p.id_producto === res.producto.id_producto ? res.producto : p
          )
        );
        notificar(`Chorizo ${res.producto.codigo_sku} actualizado.`);
      } else {
        setProductos((prev) => [res.producto, ...prev]);
        notificar(`Variedad ${res.producto.codigo_sku} agregada al catálogo.`);
      }
      setModalProdAbierto(false);
      router.refresh();
    } finally {
      setGuardandoGlobal(false);
    }
  };

  const handleToggleChorizo = async (
    prod: ProductoCatalogoAdminRow,
    nuevoEstado: boolean
  ) => {
    const res = await toggleProductoActivoAction(prod.id_producto, nuevoEstado);
    if (!res.ok) {
      notificar(res.error, 'warn');
      return;
    }
    setProductos((prev) =>
      prev.map((p) =>
        p.id_producto === prod.id_producto ? { ...p, activo: nuevoEstado } : p
      )
    );
    notificar(
      `${prod.codigo_sku} marcado como ${nuevoEstado ? 'ACTIVO' : 'INACTIVO'}.`
    );
    router.refresh();
  };

  const guardarPrecioInline = async (prod: ProductoCatalogoAdminRow) => {
    const val = parseFloat(precioInlineValor);
    if (Number.isNaN(val) || val <= 0) {
      setPrecioInlineId(null);
      return;
    }
    const precioFinal = Number(val.toFixed(2));
    const res = await guardarProductoAction({
      id_producto: prod.id_producto,
      codigo_sku: prod.codigo_sku,
      nombre_producto: prod.nombre_producto,
      formato: prod.formato,
      precio_kilo_bs: precioFinal,
      activo: prod.activo,
    });

    setPrecioInlineId(null);
    if (!res.ok) {
      notificar(res.error, 'warn');
      return;
    }
    setProductos((prev) =>
      prev.map((p) =>
        p.id_producto === res.producto.id_producto ? res.producto : p
      )
    );
    notificar(
      `Precio de ${prod.codigo_sku} actualizado a Bs. ${precioFinal.toFixed(2)} / Kg.`
    );
    router.refresh();
  };

  // ==========================================================================
  // HANDLERS USUARIOS
  // ==========================================================================
  const abrirModalNuevoUsuario = () => {
    setUsrEditando(null);
    setFormUsr({
      nombre_completo: '',
      username: '',
      password: '',
      telefono: '',
      rol: 'VENDEDOR',
      activo: true,
    });
    setModalUsrAbierto(true);
  };

  const abrirModalEditarUsuario = (u: UsuarioSistemaAdminRow) => {
    setUsrEditando(u);
    setFormUsr({
      nombre_completo: u.nombre_completo,
      username: u.username,
      password: '',
      telefono: u.telefono,
      rol: u.rol,
      activo: u.activo,
    });
    setModalUsrAbierto(true);
  };

  const guardarUsuarioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usernameLimpio = formUsr.username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

    if (!formUsr.nombre_completo.trim() || usernameLimpio.length < 3) {
      notificar(
        'Completa el nombre completo y un username de al menos 3 caracteres.',
        'warn'
      );
      return;
    }
    if (!usrEditando && formUsr.password.trim().length < 6) {
      notificar(
        'La contraseña inicial debe tener al menos 6 caracteres.',
        'warn'
      );
      return;
    }

    setGuardandoGlobal(true);
    try {
      const res = await guardarUsuarioAction({
        id_usuario: usrEditando?.id_usuario,
        nombre_completo: formUsr.nombre_completo.trim(),
        username: usernameLimpio,
        telefono: formUsr.telefono.trim(),
        rol: formUsr.rol,
        activo: formUsr.activo,
        password: formUsr.password.trim() || undefined,
      });

      if (!res.ok) {
        notificar(res.error, 'warn');
        return;
      }

      if (usrEditando) {
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id_usuario === res.usuario.id_usuario ? res.usuario : u
          )
        );
        notificar(`Cuenta de @${res.usuario.username} actualizada.`);
      } else {
        setUsuarios((prev) => [res.usuario, ...prev]);
        notificar(
          `Usuario @${res.usuario.username} creado con rol ${res.usuario.rol}.`
        );
      }
      setModalUsrAbierto(false);
      router.refresh();
    } finally {
      setGuardandoGlobal(false);
    }
  };

  const handleToggleUsuario = async (
    u: UsuarioSistemaAdminRow,
    nuevoEstado: boolean
  ) => {
    if (u.id_usuario === usuarioActualId && !nuevoEstado) {
      notificar(
        'No puedes desactivar tu propia cuenta de administrador.',
        'warn'
      );
      return;
    }
    const res = await toggleUsuarioActivoAction(u.id_usuario, nuevoEstado);
    if (!res.ok) {
      notificar(res.error, 'warn');
      return;
    }
    setUsuarios((prev) =>
      prev.map((item) =>
        item.id_usuario === u.id_usuario
          ? { ...item, activo: nuevoEstado }
          : item
      )
    );
    notificar(
      `Acceso de @${u.username} ${nuevoEstado ? 'habilitado' : 'desactivado'}.`
    );
    router.refresh();
  };

  const confirmarCambioClaveFlag = async () => {
    if (!usuarioConfirmCambioClave) return;
    const target = usuarioConfirmCambioClave;
    const habilitar = !target.requiere_cambio_clave;

    setGuardandoGlobal(true);
    try {
      const res = await habilitarCambioClaveUsuarioAction(
        target.id_usuario,
        habilitar
      );
      if (!res.ok) {
        notificar(res.error, 'warn');
        return;
      }

      setUsuarios((prev) =>
        prev.map((u) =>
          u.id_usuario === target.id_usuario
            ? { ...u, requiere_cambio_clave: habilitar }
            : u
        )
      );
      notificar(
        habilitar
          ? `Cambio de clave habilitado para @${target.username} en su próximo inicio de sesión.`
          : `Solicitud de cambio de clave cancelada para @${target.username}.`
      );
      setUsuarioConfirmCambioClave(null);
      router.refresh();
    } finally {
      setGuardandoGlobal(false);
    }
  };

  // ==========================================================================
  // HANDLERS CLIENTES Y ZONAS
  // ==========================================================================
  const sugerirCodigoSAC = () => {
    const maxNum = clientes.reduce((acc, c) => {
      const match = c.codigo_cliente_sac.match(/(\d+)$/);
      const num = match ? parseInt(match[1], 10) : 0;
      return num > acc ? num : acc;
    }, 0);
    const nextCode = `CLI-SAC-${String(maxNum + 1).padStart(3, '0')}`;
    setFormCli((prev) => ({ ...prev, codigo_cliente_sac: nextCode }));
  };

  const abrirModalNuevoCliente = () => {
    setCliEditando(null);
    const zonaActivaDefault =
      zonas.find((z) => z.activo)?.id_zona ?? zonas[0]?.id_zona ?? 0;
    const maxNum = clientes.reduce((acc, c) => {
      const match = c.codigo_cliente_sac.match(/(\d+)$/);
      const num = match ? parseInt(match[1], 10) : 0;
      return num > acc ? num : acc;
    }, 0);
    setFormCli({
      codigo_cliente_sac: `CLI-SAC-${String(maxNum + 1).padStart(3, '0')}`,
      nombre_comercial: '',
      nit_ci: '',
      telefono: '',
      id_zona: zonaActivaDefault,
      activo: true,
    });
    setModalCliAbierto(true);
  };

  const abrirModalEditarCliente = (cli: ClienteSacAdminRow) => {
    setCliEditando(cli);
    setFormCli({
      codigo_cliente_sac: cli.codigo_cliente_sac,
      nombre_comercial: cli.nombre_comercial,
      nit_ci: cli.nit_ci,
      telefono: cli.telefono,
      id_zona: cli.id_zona,
      activo: cli.activo,
    });
    setModalCliAbierto(true);
  };

  const guardarClienteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCli.codigo_cliente_sac.trim() || !formCli.nombre_comercial.trim()) {
      notificar(
        'El Código Cliente SAC y Nombre Comercial son obligatorios.',
        'warn'
      );
      return;
    }

    setGuardandoGlobal(true);
    try {
      const res = await guardarClienteAction({
        id_cliente: cliEditando?.id_cliente,
        codigo_cliente_sac: formCli.codigo_cliente_sac.trim().toUpperCase(),
        nombre_comercial: formCli.nombre_comercial.trim(),
        nit_ci: formCli.nit_ci.trim(),
        telefono: formCli.telefono.trim(),
        id_zona: formCli.id_zona,
        activo: formCli.activo,
      });

      if (!res.ok) {
        notificar(res.error, 'warn');
        return;
      }

      if (cliEditando) {
        setClientes((prev) =>
          prev.map((c) =>
            c.id_cliente === res.cliente.id_cliente ? res.cliente : c
          )
        );
        notificar(`Cliente ${res.cliente.codigo_cliente_sac} actualizado.`);
      } else {
        setClientes((prev) => [res.cliente, ...prev]);
        notificar(
          `Cliente ${res.cliente.codigo_cliente_sac} registrado en cartera SAC.`
        );
      }
      setModalCliAbierto(false);
      router.refresh();
    } finally {
      setGuardandoGlobal(false);
    }
  };

  const handleToggleCliente = async (
    cli: ClienteSacAdminRow,
    nuevoEstado: boolean
  ) => {
    const res = await toggleClienteActivoAction(cli.id_cliente, nuevoEstado);
    if (!res.ok) {
      notificar(res.error, 'warn');
      return;
    }
    setClientes((prev) =>
      prev.map((c) =>
        c.id_cliente === cli.id_cliente ? { ...c, activo: nuevoEstado } : c
      )
    );
    notificar(
      `${cli.nombre_comercial} marcado como ${nuevoEstado ? 'ACTIVO' : 'INACTIVO'}.`
    );
    router.refresh();
  };

  const guardarZonaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formZona.nombre_zona.trim() || !formZona.ciudad.trim()) return;

    setGuardandoGlobal(true);
    try {
      const res = await guardarZonaAction({
        id_zona: zonaEditandoId ?? undefined,
        nombre_zona: formZona.nombre_zona.trim(),
        ciudad: formZona.ciudad.trim(),
        activo: formZona.activo,
      });

      if (!res.ok) {
        notificar(res.error, 'warn');
        return;
      }

      if (zonaEditandoId) {
        setZonas((prev) =>
          prev.map((z) => (z.id_zona === res.zona.id_zona ? res.zona : z))
        );
        notificar('Zona de mercado actualizada.');
      } else {
        setZonas((prev) => [...prev, res.zona]);
        notificar('Nueva zona de mercado agregada.');
      }
      setZonaEditandoId(null);
      setFormZona({ nombre_zona: '', ciudad: 'La Paz', activo: true });
      router.refresh();
    } finally {
      setGuardandoGlobal(false);
    }
  };

  const getZonaCliente = (idZona: number) =>
    zonas.find((z) => z.id_zona === idZona);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-10">
      {toastMsg && (
        <div
          role="status"
          className={`fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border-2 px-4 py-3 shadow-xl transition-all ${
            toastMsg.tipo === 'ok'
              ? 'border-[#FFCD00] bg-[#0F172A] text-white'
              : 'border-amber-400 bg-amber-950 text-amber-100'
          }`}
        >
          {toastMsg.tipo === 'ok' ? (
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-[#FFCD00]"
              strokeWidth={2.2}
            />
          ) : (
            <Ban
              className="h-5 w-5 shrink-0 text-amber-400"
              strokeWidth={2.2}
            />
          )}
          <p className="flex-1 text-xs font-semibold leading-snug">
            {toastMsg.texto}
          </p>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="Cerrar notificación"
            className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {migracionPendiente && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-950 shadow-2xs"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            La columna{' '}
            <code className="font-mono font-bold">requiere_cambio_clave</code>{' '}
            aún no existe en Supabase. Ejecuta{' '}
            <code className="font-mono font-bold">
              supabase/migrations/add_requiere_cambio_clave.sql
            </code>{' '}
            en el SQL Editor para habilitar el cambio de clave autorizado en 2
            pasos.
          </div>
        </div>
      )}

      {/* ====================================================================
          BARRA DE CONTEXTO COMPACTA + SELECTOR DE 3 PESTAÑAS
         ==================================================================== */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6 sm:py-4">
        <div className="absolute inset-x-0 top-0 flex h-1.5 w-full">
          <div className="w-2/3 bg-[#C8102E]" />
          <div className="w-1/3 bg-[#FFCD00]" />
        </div>

        <div className="relative pt-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-[#FFCD00]">
                  CU-A04 • MAESTROS
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-500">
                  PLANTA DE CHORIZOS • BOLIVIA
                </span>
              </div>
              <h1 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                Gestión Maestra del Sistema
              </h1>
              <p className="text-xs text-slate-600 sm:text-sm">
                Administración de catálogo de chorizos, cuentas de usuario y
                cartera de clientes SAC
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-center sm:text-left">
                <div className="font-mono text-[10px] font-bold uppercase text-slate-500">
                  Chorizos
                </div>
                <div className="font-mono text-sm font-extrabold tabular-nums text-slate-900">
                  {productos.filter((p) => p.activo).length}/{productos.length}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-center sm:text-left">
                <div className="font-mono text-[10px] font-bold uppercase text-slate-500">
                  Usuarios
                </div>
                <div className="font-mono text-sm font-extrabold tabular-nums text-slate-900">
                  {usuarios.filter((u) => u.activo).length}/{usuarios.length}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-center sm:text-left">
                <div className="font-mono text-[10px] font-bold uppercase text-slate-500">
                  Clientes SAC
                </div>
                <div className="font-mono text-sm font-extrabold tabular-nums text-slate-900">
                  {clientes.filter((c) => c.activo).length}/{clientes.length}
                </div>
              </div>
            </div>
          </div>

          <nav
            aria-label="Secciones de Gestión Maestra"
            className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              onClick={() => setTabActiva('CHORIZOS')}
              className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                tabActiva === 'CHORIZOS'
                  ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <Package className="h-4 w-4 shrink-0" strokeWidth={2.2} />
              <span>Chorizos y Precios</span>
              <span
                className={`ml-1 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                  tabActiva === 'CHORIZOS'
                    ? 'bg-[#FFCD00] font-extrabold text-slate-950'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {productos.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('USUARIOS')}
              className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                tabActiva === 'USUARIOS'
                  ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <Users className="h-4 w-4 shrink-0" strokeWidth={2.2} />
              <span>Usuarios del Sistema</span>
              <span
                className={`ml-1 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                  tabActiva === 'USUARIOS'
                    ? 'bg-[#FFCD00] font-extrabold text-slate-950'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {usuarios.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('CLIENTES')}
              className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                tabActiva === 'CLIENTES'
                  ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <Store className="h-4 w-4 shrink-0" strokeWidth={2.2} />
              <span>Clientes y Zonas SAC</span>
              <span
                className={`ml-1 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                  tabActiva === 'CLIENTES'
                    ? 'bg-[#FFCD00] font-extrabold text-slate-950'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {clientes.length}
              </span>
            </button>
          </nav>
        </div>
      </section>

      {/* ====================================================================
          PESTAÑA 1 — CHORIZOS Y PRECIOS
         ==================================================================== */}
      {tabActiva === 'CHORIZOS' && (
        <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 border-b-2 border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-md flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.2}
                />
                <input
                  type="text"
                  value={busquedaProd}
                  onChange={(e) => {
                    setBusquedaProd(e.target.value);
                    setPageProd(1);
                  }}
                  placeholder="Buscar por SKU o variedad de chorizo..."
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 pr-4 pl-10 text-base text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={abrirModalNuevoChorizo}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-5 text-sm font-extrabold text-white shadow-sm transition hover:brightness-105 active:translate-y-[2px] active:border-b-2"
              >
                <Plus className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.5} />
                <span>Nuevo Chorizo</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(['TODOS', 'GRANEL', 'VACIO'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => {
                      setFiltroFormatoProd(fmt);
                      setPageProd(1);
                    }}
                    className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 font-mono text-xs font-bold transition ${
                      filtroFormatoProd === fmt
                        ? 'border-slate-900 bg-slate-900 text-[#FFCD00]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {fmt === 'TODOS' ? 'Presentación: Todos' : fmt}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(['TODOS', 'ACTIVOS', 'INACTIVOS'] as const).map((est) => (
                  <button
                    key={est}
                    type="button"
                    onClick={() => {
                      setFiltroEstadoProd(est);
                      setPageProd(1);
                    }}
                    className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition ${
                      filtroEstadoProd === est
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {est === 'TODOS'
                      ? 'Estado: Todos'
                      : est === 'ACTIVOS'
                        ? 'Activos'
                        : 'Inactivos'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100/80 font-mono text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-3.5">SKU</th>
                  <th className="px-4 py-3.5">Variedad de Chorizo</th>
                  <th className="px-4 py-3.5">Presentación</th>
                  <th className="px-4 py-3.5 text-right">Precio / Kg (Bs.)</th>
                  <th className="px-4 py-3.5 text-right">
                    Stock Cámara (Físico)
                  </th>
                  <th className="px-4 py-3.5 text-right">Estado y Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {productosPaginados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm font-medium text-slate-500"
                    >
                      No se encontraron variedades de chorizo con los filtros
                      actuales.
                    </td>
                  </tr>
                ) : (
                  productosPaginados.map((prod) => {
                    const sinDisponible = prod.stock_disponible_kilos <= 0;
                    return (
                      <tr
                        key={prod.id_producto}
                        className={`transition-colors hover:bg-slate-50/90 ${
                          !prod.activo ? 'bg-slate-50/50 opacity-75' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 align-middle">
                          <span className="inline-block rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 font-mono text-xs font-extrabold tracking-wide text-slate-900">
                            {prod.codigo_sku}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="font-bold text-slate-900">
                            {prod.nombre_producto}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <span
                            className={`inline-flex rounded-md border px-2.5 py-0.5 font-mono text-xs font-bold ${
                              prod.formato === 'GRANEL'
                                ? 'border-amber-300 bg-amber-50 text-amber-900'
                                : 'border-sky-300 bg-sky-50 text-sky-900'
                            }`}
                          >
                            {prod.formato}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right align-middle">
                          {precioInlineId === prod.id_producto ? (
                            <div className="inline-flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                inputMode="decimal"
                                autoFocus
                                value={precioInlineValor}
                                onChange={(e) =>
                                  setPrecioInlineValor(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter')
                                    guardarPrecioInline(prod);
                                  if (e.key === 'Escape')
                                    setPrecioInlineId(null);
                                }}
                                className="w-24 rounded-lg border-2 border-[#C8102E] bg-white px-2 py-1 text-right font-mono text-sm font-bold tabular-nums text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => guardarPrecioInline(prod)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                title="Confirmar precio"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPrecioInlineId(prod.id_producto);
                                setPrecioInlineValor(
                                  prod.precio_kilo_bs.toFixed(2)
                                );
                              }}
                              title="Clic para ajustar precio por kilo"
                              className="group inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 font-mono text-sm font-extrabold tabular-nums text-slate-900 hover:border-slate-300 hover:bg-white"
                            >
                              <span>Bs. {prod.precio_kilo_bs.toFixed(2)}</span>
                              <Pencil className="h-3.5 w-3.5 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right align-middle">
                          <div className="inline-flex items-center justify-end gap-2">
                            <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                              {prod.stock_fisico_kilos.toFixed(3)} Kg
                            </span>
                            {sinDisponible && (
                              <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-100 px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#C8102E]">
                                <Ban className="h-3 w-3" /> SIN DISP.
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right align-middle">
                          <div className="inline-flex items-center justify-end gap-2.5">
                            <ActiveSwitch
                              checked={prod.activo}
                              onChange={(val) => handleToggleChorizo(prod, val)}
                            />
                            <button
                              type="button"
                              onClick={() => abrirModalEditarChorizo(prod)}
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 transition hover:border-[#C8102E] hover:text-[#C8102E]"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                              <span>Editar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:hidden">
            {productosPaginados.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-slate-500">
                No se encontraron variedades de chorizo con los filtros
                actuales.
              </div>
            ) : (
              productosPaginados.map((prod) => {
                const sinDisponible = prod.stock_disponible_kilos <= 0;
                return (
                  <article
                    key={prod.id_producto}
                    className={`rounded-xl border-2 border-slate-200 bg-white p-3.5 shadow-sm ${
                      !prod.activo ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-xs font-extrabold text-slate-900">
                          {prod.codigo_sku}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${
                            prod.formato === 'GRANEL'
                              ? 'border-amber-300 bg-amber-50 text-amber-900'
                              : 'border-sky-300 bg-sky-50 text-sky-900'
                          }`}
                        >
                          {prod.formato}
                        </span>
                      </div>
                      <ActiveSwitch
                        checked={prod.activo}
                        onChange={(val) => handleToggleChorizo(prod, val)}
                      />
                    </div>

                    <h3 className="mt-2 text-sm font-extrabold leading-snug text-slate-900">
                      {prod.nombre_producto}
                    </h3>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div>
                        <span className="block font-mono text-[10px] font-bold uppercase text-slate-500">
                          Precio / Kg
                        </span>
                        <span className="font-mono text-base font-extrabold tabular-nums text-[#C8102E]">
                          Bs. {prod.precio_kilo_bs.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block font-mono text-[10px] font-bold uppercase text-slate-500">
                          Stock Físico Cámara
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                          {prod.stock_fisico_kilos.toFixed(3)} Kg
                        </span>
                        {sinDisponible && (
                          <span className="mt-0.5 inline-block rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[#C8102E]">
                            SIN DISP.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => abrirModalEditarChorizo(prod)}
                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-xs font-bold text-slate-800 hover:border-[#C8102E] hover:text-[#C8102E]"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.2} />
                        <span>Editar Chorizo</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <PaginationBar
            totalItems={productosFiltrados.length}
            pageSize={pageSizeProd}
            currentPage={pageProd}
            onPageChange={setPageProd}
            onPageSizeChange={setPageSizeProd}
          />
        </section>
      )}

      {/* ====================================================================
          PESTAÑA 2 — USUARIOS DEL SISTEMA
         ==================================================================== */}
      {tabActiva === 'USUARIOS' && (
        <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 border-b-2 border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-md flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.2}
                />
                <input
                  type="text"
                  value={busquedaUsr}
                  onChange={(e) => {
                    setBusquedaUsr(e.target.value);
                    setPageUsr(1);
                  }}
                  placeholder="Buscar por nombre, usuario o teléfono..."
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 pr-4 pl-10 text-base text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={abrirModalNuevoUsuario}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-5 text-sm font-extrabold text-white shadow-sm transition hover:brightness-105 active:translate-y-[2px] active:border-b-2"
              >
                <Plus className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.5} />
                <span>Nuevo Usuario</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-1 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    'TODOS',
                    'VENDEDOR',
                    'DESPACHADOR',
                    'PRODUCCION',
                    'ADMINISTRADOR',
                  ] as const
                ).map((rol) => (
                  <button
                    key={rol}
                    type="button"
                    onClick={() => {
                      setFiltroRolUsr(rol);
                      setPageUsr(1);
                    }}
                    className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 font-mono text-xs font-bold transition ${
                      filtroRolUsr === rol
                        ? 'border-slate-900 bg-slate-900 text-[#FFCD00]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {rol === 'TODOS' ? 'Todos' : rol}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(['TODOS', 'ACTIVOS', 'INACTIVOS'] as const).map((est) => (
                  <button
                    key={est}
                    type="button"
                    onClick={() => {
                      setFiltroEstadoUsr(est);
                      setPageUsr(1);
                    }}
                    className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition ${
                      filtroEstadoUsr === est
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {est === 'TODOS'
                      ? 'Estado: Todos'
                      : est === 'ACTIVOS'
                        ? 'Activos'
                        : 'Inactivos'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100/80 font-mono text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-3.5">Nombre Completo</th>
                  <th className="px-4 py-3.5">Usuario de Acceso</th>
                  <th className="px-4 py-3.5">Rol Operativo</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {usuariosPaginados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm font-medium text-slate-500"
                    >
                      No se encontraron usuarios con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  usuariosPaginados.map((u) => {
                    const rolMeta = DESCRIPCION_ROLES[u.rol];
                    return (
                      <tr
                        key={u.id_usuario}
                        className={`transition-colors hover:bg-slate-50/90 ${
                          !u.activo ? 'bg-slate-50/50 opacity-75' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 align-middle">
                          <div className="font-bold text-slate-900">
                            {u.nombre_completo}
                          </div>
                          <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                            Tel: {u.telefono || '—'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {u.username}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className={`inline-flex rounded-md border px-2.5 py-0.5 font-mono text-xs font-extrabold tracking-wide ${rolMeta.badgeClass}`}
                            >
                              {rolMeta.etiqueta}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {rolMeta.funcion}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-col items-start gap-1.5">
                            <ActiveSwitch
                              checked={u.activo}
                              disabled={u.id_usuario === usuarioActualId}
                              onChange={(val) => handleToggleUsuario(u, val)}
                            />
                            {u.requiere_cambio_clave && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-950">
                                <KeyRound className="h-3 w-3 text-amber-700" />
                                Cambio de clave pendiente
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right align-middle">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirModalEditarUsuario(u)}
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 transition hover:border-[#C8102E] hover:text-[#C8102E]"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setUsuarioConfirmCambioClave(u)}
                              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
                                u.requiere_cambio_clave
                                  ? 'border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200'
                                  : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-950'
                              }`}
                            >
                              <KeyRound
                                className="h-3.5 w-3.5"
                                strokeWidth={2.2}
                              />
                              <span>
                                {u.requiere_cambio_clave
                                  ? 'Cancelar Cambio Clave'
                                  : 'Habilitar Cambio Clave'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:hidden">
            {usuariosPaginados.map((u) => {
              const rolMeta = DESCRIPCION_ROLES[u.rol];
              return (
                <article
                  key={u.id_usuario}
                  className={`rounded-xl border-2 border-slate-200 bg-white p-3.5 shadow-sm ${
                    !u.activo ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex rounded-md border px-2.5 py-0.5 font-mono text-xs font-extrabold ${rolMeta.badgeClass}`}
                    >
                      {rolMeta.etiqueta}
                    </span>
                    <ActiveSwitch
                      checked={u.activo}
                      disabled={u.id_usuario === usuarioActualId}
                      onChange={(val) => handleToggleUsuario(u, val)}
                    />
                  </div>

                  <h3 className="mt-2 text-sm font-extrabold text-slate-900">
                    {u.nombre_completo}
                  </h3>
                  <p className="text-xs text-slate-500">{rolMeta.funcion}</p>

                  {u.requiere_cambio_clave && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-950">
                      <KeyRound className="h-3 w-3 text-amber-700" />
                      Cambio de clave pendiente
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs">
                    <span className="font-bold text-slate-900">
                      {u.username}
                    </span>
                    <span className="tabular-nums text-slate-600">
                      {u.telefono || '—'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => abrirModalEditarUsuario(u)}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 hover:border-[#C8102E] hover:text-[#C8102E]"
                    >
                      <Pencil className="h-4 w-4" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUsuarioConfirmCambioClave(u)}
                      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                        u.requiere_cambio_clave
                          ? 'border-amber-400 bg-amber-100 text-amber-950'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-amber-50'
                      }`}
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>
                        {u.requiere_cambio_clave
                          ? 'Cancelar Cambio Clave'
                          : 'Habilitar Cambio Clave'}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <PaginationBar
            totalItems={usuariosFiltrados.length}
            pageSize={pageSizeUsr}
            currentPage={pageUsr}
            onPageChange={setPageUsr}
            onPageSizeChange={setPageSizeUsr}
          />
        </section>
      )}

      {/* ====================================================================
          PESTAÑA 3 — CLIENTES Y ZONAS SAC
         ==================================================================== */}
      {tabActiva === 'CLIENTES' && (
        <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 border-b-2 border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-md flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.2}
                />
                <input
                  type="text"
                  value={busquedaCli}
                  onChange={(e) => {
                    setBusquedaCli(e.target.value);
                    setPageCli(1);
                  }}
                  placeholder="Buscar por comercio, CLI-SAC, NIT/CI o teléfono..."
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 pr-4 pl-10 text-base text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setZonaEditandoId(null);
                    setFormZona({
                      nombre_zona: '',
                      ciudad: 'La Paz',
                      activo: true,
                    });
                    setModalZonasAbierto(true);
                  }}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-[1px] sm:flex-initial"
                >
                  <MapPin
                    className="h-4 w-4 text-[#C8102E]"
                    strokeWidth={2.2}
                  />
                  <span>Zonas de Mercado</span>
                </button>

                <button
                  type="button"
                  onClick={abrirModalNuevoCliente}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-5 text-sm font-extrabold text-white shadow-sm transition hover:brightness-105 active:translate-y-[2px] active:border-b-2 sm:flex-initial"
                >
                  <Plus className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.5} />
                  <span>Nuevo Cliente SAC</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setFiltroZonaCli('TODAS');
                    setPageCli(1);
                  }}
                  className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition ${
                    filtroZonaCli === 'TODAS'
                      ? 'border-slate-900 bg-slate-900 text-[#FFCD00]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Todas las Zonas ({zonas.length})
                </button>
                {zonas.map((z) => (
                  <button
                    key={z.id_zona}
                    type="button"
                    onClick={() => {
                      setFiltroZonaCli(String(z.id_zona));
                      setPageCli(1);
                    }}
                    className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition ${
                      filtroZonaCli === String(z.id_zona)
                        ? 'border-slate-900 bg-slate-900 text-[#FFCD00]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {z.nombre_zona} ({z.ciudad})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(['TODOS', 'ACTIVOS', 'INACTIVOS'] as const).map((est) => (
                  <button
                    key={est}
                    type="button"
                    onClick={() => {
                      setFiltroEstadoCli(est);
                      setPageCli(1);
                    }}
                    className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition ${
                      filtroEstadoCli === est
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {est === 'TODOS'
                      ? 'Estado: Todos'
                      : est === 'ACTIVOS'
                        ? 'Activos'
                        : 'Inactivos'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100/80 font-mono text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-3.5">Cód. Cliente SAC</th>
                  <th className="px-4 py-3.5">Cliente / Comercio</th>
                  <th className="px-4 py-3.5">NIT / CI</th>
                  <th className="px-4 py-3.5">Teléfono</th>
                  <th className="px-4 py-3.5">Zona / Mercado</th>
                  <th className="px-4 py-3.5 text-right">Estado y Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {clientesPaginados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm font-medium text-slate-500"
                    >
                      No se encontraron clientes SAC con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  clientesPaginados.map((cli) => {
                    const zona = getZonaCliente(cli.id_zona);
                    return (
                      <tr
                        key={cli.id_cliente}
                        className={`transition-colors hover:bg-slate-50/90 ${
                          !cli.activo ? 'bg-slate-50/50 opacity-75' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 align-middle">
                          <span className="inline-block rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-xs font-extrabold tracking-wide text-slate-900">
                            {cli.codigo_cliente_sac}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="font-bold text-slate-900">
                            {cli.nombre_comercial}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <span className="font-mono text-xs font-semibold tabular-nums text-slate-800">
                            {cli.nit_ci || '—'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <span className="font-mono text-xs font-semibold tabular-nums text-slate-800">
                            {cli.telefono || '—'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="font-semibold text-slate-800">
                            {zona?.nombre_zona || 'Sin zona'}
                          </div>
                          <div className="font-mono text-[11px] font-bold uppercase text-slate-500">
                            {zona?.ciudad || 'Bolivia'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right align-middle">
                          <div className="inline-flex items-center justify-end gap-2.5">
                            <ActiveSwitch
                              checked={cli.activo}
                              onChange={(val) => handleToggleCliente(cli, val)}
                            />
                            <button
                              type="button"
                              onClick={() => abrirModalEditarCliente(cli)}
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 transition hover:border-[#C8102E] hover:text-[#C8102E]"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                              <span>Editar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:hidden">
            {clientesPaginados.map((cli) => {
              const zona = getZonaCliente(cli.id_zona);
              return (
                <article
                  key={cli.id_cliente}
                  className={`rounded-xl border-2 border-slate-200 bg-white p-3.5 shadow-sm ${
                    !cli.activo ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-xs font-extrabold text-slate-900">
                      {cli.codigo_cliente_sac}
                    </span>
                    <ActiveSwitch
                      checked={cli.activo}
                      onChange={(val) => handleToggleCliente(cli, val)}
                    />
                  </div>

                  <h3 className="mt-2 text-sm font-extrabold text-slate-900">
                    {cli.nombre_comercial}
                  </h3>

                  <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                    <div className="flex justify-between font-mono tabular-nums">
                      <span className="text-slate-500">NIT / CI:</span>
                      <span className="font-bold text-slate-900">
                        {cli.nit_ci || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono tabular-nums">
                      <span className="text-slate-500">Teléfono:</span>
                      <span className="font-bold text-slate-900">
                        {cli.telefono || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1">
                      <span className="text-slate-500">Zona SAC:</span>
                      <span className="text-right font-bold text-slate-800">
                        {zona
                          ? `${zona.nombre_zona} (${zona.ciudad})`
                          : 'Sin zona'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => abrirModalEditarCliente(cli)}
                    className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-xs font-bold text-slate-800 hover:border-[#C8102E] hover:text-[#C8102E]"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>Editar Cliente SAC</span>
                  </button>
                </article>
              );
            })}
          </div>

          <PaginationBar
            totalItems={clientesFiltrados.length}
            pageSize={pageSizeCli}
            currentPage={pageCli}
            onPageChange={setPageCli}
            onPageSizeChange={setPageSizeCli}
          />
        </section>
      )}

      {/* ====================================================================
          MODAL 1: CREAR / EDITAR CHORIZO
         ==================================================================== */}
      {modalProdAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border-2 border-slate-300 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex h-1.5 w-full">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase text-[#C8102E]">
                  CATÁLOGO DE CHORIZOS
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {prodEditando
                    ? `Editar SKU ${prodEditando.codigo_sku}`
                    : 'Nuevo Chorizo'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalProdAbierto(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={guardarChorizoSubmit}
              className="max-h-[82vh] space-y-4 overflow-y-auto p-5"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                    Código SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formProd.codigo_sku}
                    onChange={(e) =>
                      setFormProd({
                        ...formProd,
                        codigo_sku: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="CH-PAR-VA"
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 font-mono text-base font-bold uppercase text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                    Precio / Kg (Bs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    required
                    value={formProd.precio_kilo_bs}
                    onChange={(e) =>
                      setFormProd({
                        ...formProd,
                        precio_kilo_bs: e.target.value,
                      })
                    }
                    placeholder="38.00"
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 font-mono text-base font-bold tabular-nums text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                  Variedad de Chorizo *
                </label>
                <input
                  type="text"
                  required
                  value={formProd.nombre_producto}
                  onChange={(e) =>
                    setFormProd({
                      ...formProd,
                      nombre_producto: e.target.value,
                    })
                  }
                  placeholder="Ej: Chorizo Parrillero Tradicional (Al Vacío)"
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 text-base font-semibold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                  Presentación *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['GRANEL', 'VACIO'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormProd({ ...formProd, formato: fmt })}
                      className={`min-h-[48px] rounded-xl border-2 font-mono text-sm font-extrabold transition ${
                        formProd.formato === fmt
                          ? 'border-slate-900 bg-slate-900 text-[#FFCD00]'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Estado Operativo
                  </div>
                  <div className="text-xs text-slate-500">
                    El stock físico solo se modifica desde Producción y
                    Despacho.
                  </div>
                </div>
                <ActiveSwitch
                  checked={formProd.activo}
                  onChange={(val) => setFormProd({ ...formProd, activo: val })}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={guardandoGlobal}
                  onClick={() => setModalProdAbierto(false)}
                  className="min-h-[48px] rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoGlobal}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-6 text-sm font-extrabold text-white shadow-sm active:translate-y-[2px] active:border-b-2 disabled:opacity-60"
                >
                  {guardandoGlobal && (
                    <Loader2 className="h-4 w-4 animate-spin text-[#FFCD00]" />
                  )}
                  <span>Guardar Chorizo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: CREAR / EDITAR USUARIO DEL SISTEMA
         ==================================================================== */}
      {modalUsrAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border-2 border-slate-300 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex h-1.5 w-full">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase text-[#C8102E]">
                  CUENTAS Y ROLES DEL SISTEMA
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {usrEditando
                    ? `Editar Usuario ${usrEditando.username}`
                    : 'Nuevo Usuario'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalUsrAbierto(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={guardarUsuarioSubmit}
              className="max-h-[84vh] space-y-4 overflow-y-auto p-5"
            >
              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formUsr.nombre_completo}
                  onChange={(e) =>
                    setFormUsr({ ...formUsr, nombre_completo: e.target.value })
                  }
                  placeholder="Ej: Carlos Mendoza Quispe"
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 text-base font-semibold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                    Usuario (username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsr.username}
                    onChange={(e) =>
                      setFormUsr({
                        ...formUsr,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, ''),
                      })
                    }
                    placeholder="cmendoza"
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 font-mono text-base font-bold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formUsr.telefono}
                    onChange={(e) =>
                      setFormUsr({ ...formUsr, telefono: e.target.value })
                    }
                    placeholder="71548920"
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 font-mono text-base tabular-nums text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                  Contraseña {usrEditando ? '(Opcional al editar)' : '*'}
                </label>
                <input
                  type="password"
                  required={!usrEditando}
                  minLength={usrEditando ? undefined : 6}
                  value={formUsr.password}
                  onChange={(e) =>
                    setFormUsr({ ...formUsr, password: e.target.value })
                  }
                  placeholder={
                    usrEditando
                      ? 'Dejar vacío para conservar clave actual'
                      : 'Mínimo 6 caracteres'
                  }
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 text-base text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                  Rol del Sistema *
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      'VENDEDOR',
                      'DESPACHADOR',
                      'PRODUCCION',
                      'ADMINISTRADOR',
                    ] as const
                  ).map((rolOption) => {
                    const info = DESCRIPCION_ROLES[rolOption];
                    const seleccionado = formUsr.rol === rolOption;
                    return (
                      <button
                        key={rolOption}
                        type="button"
                        onClick={() =>
                          setFormUsr({ ...formUsr, rol: rolOption })
                        }
                        className={`flex min-h-[54px] flex-col items-start justify-center rounded-xl border-2 px-3.5 py-2 text-left transition ${
                          seleccionado
                            ? 'border-[#C8102E] bg-red-50/60 text-slate-900 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-mono text-xs font-extrabold">
                            {info.etiqueta}
                          </span>
                          {seleccionado && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#C8102E]" />
                          )}
                        </div>
                        <span className="mt-0.5 text-[11px] font-medium text-slate-500">
                          {info.funcion}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-900">
                  Estado de la Cuenta
                </span>
                <ActiveSwitch
                  checked={formUsr.activo}
                  disabled={usrEditando?.id_usuario === usuarioActualId}
                  onChange={(val) => setFormUsr({ ...formUsr, activo: val })}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={guardandoGlobal}
                  onClick={() => setModalUsrAbierto(false)}
                  className="min-h-[48px] rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoGlobal}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-6 text-sm font-extrabold text-white shadow-sm active:translate-y-[2px] active:border-b-2 disabled:opacity-60"
                >
                  {guardandoGlobal && (
                    <Loader2 className="h-4 w-4 animate-spin text-[#FFCD00]" />
                  )}
                  <span>Guardar Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: CONFIRMACIÓN LIGERA HABILITAR / CANCELAR CAMBIO DE CLAVE
         ==================================================================== */}
      {usuarioConfirmCambioClave && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border-2 border-slate-300 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex h-1.5 w-full">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-[#C8102E]" />
                  <h2 className="text-base font-extrabold text-slate-900">
                    {usuarioConfirmCambioClave.requiere_cambio_clave
                      ? 'Cancelar Cambio de Clave'
                      : 'Habilitar Cambio de Clave'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setUsuarioConfirmCambioClave(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                {usuarioConfirmCambioClave.requiere_cambio_clave ? (
                  <p>
                    ¿Deseas cancelar la autorización de cambio de contraseña
                    para{' '}
                    <strong>
                      {usuarioConfirmCambioClave.nombre_completo} (@
                      {usuarioConfirmCambioClave.username})
                    </strong>
                    ? El operador seguirá ingresando con su clave habitual.
                  </p>
                ) : (
                  <p>
                    Al habilitar esta opción para{' '}
                    <strong>
                      {usuarioConfirmCambioClave.nombre_completo} (@
                      {usuarioConfirmCambioClave.username})
                    </strong>
                    , en su próximo inicio de sesión en{' '}
                    <code className="font-mono font-bold">/login</code> el
                    sistema le permitirá definir su nueva contraseña (mínimo 6
                    caracteres) sin pedir la clave anterior.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={guardandoGlobal}
                  onClick={() => setUsuarioConfirmCambioClave(null)}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={guardandoGlobal}
                  onClick={confirmarCambioClaveFlag}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#C8102E] px-5 text-xs font-extrabold text-white hover:bg-[#9E0B22] disabled:opacity-60"
                >
                  {guardandoGlobal && (
                    <Loader2 className="h-4 w-4 animate-spin text-[#FFCD00]" />
                  )}
                  <span>
                    {usuarioConfirmCambioClave.requiere_cambio_clave
                      ? 'Confirmar Cancelación'
                      : 'Habilitar en Próximo Login'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: CREAR / EDITAR CLIENTE SAC
         ==================================================================== */}
      {modalCliAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border-2 border-slate-300 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex h-1.5 w-full">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase text-[#C8102E]">
                  CARTERA DE CLIENTES SAC
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {cliEditando
                    ? `Editar ${cliEditando.codigo_cliente_sac}`
                    : 'Nuevo Cliente SAC'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalCliAbierto(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={guardarClienteSubmit}
              className="max-h-[82vh] space-y-4 overflow-y-auto p-5"
            >
              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                  Código Cliente SAC *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formCli.codigo_cliente_sac}
                    onChange={(e) =>
                      setFormCli({
                        ...formCli,
                        codigo_cliente_sac: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="CLI-SAC-014"
                    className="min-h-[48px] flex-1 rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 font-mono text-base font-extrabold uppercase text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={sugerirCodigoSAC}
                    className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl border-2 border-amber-300 bg-amber-50 px-3.5 text-xs font-extrabold text-amber-950 hover:bg-amber-100"
                  >
                    Sugerir Código
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                  Cliente / Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={formCli.nombre_comercial}
                  onChange={(e) =>
                    setFormCli({ ...formCli, nombre_comercial: e.target.value })
                  }
                  placeholder="Ej: Fiambrería y Parrilla La Suprema"
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 text-base font-semibold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                    NIT / CI
                  </label>
                  <input
                    type="text"
                    value={formCli.nit_ci}
                    onChange={(e) =>
                      setFormCli({ ...formCli, nit_ci: e.target.value })
                    }
                    placeholder="4892310014"
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 font-mono text-base tabular-nums text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formCli.telefono}
                    onChange={(e) =>
                      setFormCli({ ...formCli, telefono: e.target.value })
                    }
                    placeholder="71290451"
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 font-mono text-base tabular-nums text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-700">
                  Zona / Mercado *
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {zonas
                    .filter((z) => z.activo || z.id_zona === formCli.id_zona)
                    .map((z) => (
                      <button
                        key={z.id_zona}
                        type="button"
                        onClick={() =>
                          setFormCli({ ...formCli, id_zona: z.id_zona })
                        }
                        className={`flex min-h-[46px] items-center justify-between rounded-xl border-2 px-3.5 py-2 text-left text-xs font-bold transition ${
                          formCli.id_zona === z.id_zona
                            ? 'border-[#C8102E] bg-red-50/60 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>
                          {z.nombre_zona}{' '}
                          <span className="font-mono text-slate-500">
                            ({z.ciudad})
                          </span>
                        </span>
                        {formCli.id_zona === z.id_zona && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#C8102E]" />
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-900">
                  Cliente Activo
                </span>
                <ActiveSwitch
                  checked={formCli.activo}
                  onChange={(val) => setFormCli({ ...formCli, activo: val })}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={guardandoGlobal}
                  onClick={() => setModalCliAbierto(false)}
                  className="min-h-[48px] rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoGlobal}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-6 text-sm font-extrabold text-white shadow-sm active:translate-y-[2px] active:border-b-2 disabled:opacity-60"
                >
                  {guardandoGlobal && (
                    <Loader2 className="h-4 w-4 animate-spin text-[#FFCD00]" />
                  )}
                  <span>Guardar Cliente SAC</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 5: ZONAS DE MERCADO SAC
         ==================================================================== */}
      {modalZonasAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border-2 border-slate-300 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex h-1.5 w-full">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase text-[#C8102E]">
                  RUTAS Y MERCADOS BOLIVIA
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Zonas de Mercado SAC
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalZonasAbierto(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[82vh] space-y-4 overflow-y-auto p-5">
              <form
                onSubmit={guardarZonaSubmit}
                className="space-y-3 rounded-xl border-2 border-slate-200 bg-slate-50 p-3.5"
              >
                <div className="font-mono text-xs font-extrabold uppercase text-slate-700">
                  {zonaEditandoId
                    ? 'Editando Zona de Mercado'
                    : 'Nueva Zona de Mercado'}
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <input
                    type="text"
                    required
                    value={formZona.nombre_zona}
                    onChange={(e) =>
                      setFormZona({ ...formZona, nombre_zona: e.target.value })
                    }
                    placeholder="Nombre Zona / Mercado"
                    className="min-h-[46px] rounded-xl border-2 border-slate-200 bg-white px-3 text-base font-semibold text-slate-900 focus:border-[#C8102E] focus:outline-none sm:col-span-2"
                  />
                  <input
                    type="text"
                    required
                    value={formZona.ciudad}
                    onChange={(e) =>
                      setFormZona({ ...formZona, ciudad: e.target.value })
                    }
                    placeholder="Ciudad (La Paz)"
                    className="min-h-[46px] rounded-xl border-2 border-slate-200 bg-white px-3 text-base font-semibold text-slate-900 focus:border-[#C8102E] focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <ActiveSwitch
                    checked={formZona.activo}
                    onChange={(val) =>
                      setFormZona({ ...formZona, activo: val })
                    }
                  />
                  <div className="flex gap-2">
                    {zonaEditandoId && (
                      <button
                        type="button"
                        onClick={() => {
                          setZonaEditandoId(null);
                          setFormZona({
                            nombre_zona: '',
                            ciudad: 'La Paz',
                            activo: true,
                          });
                        }}
                        className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={guardandoGlobal}
                      className="min-h-[42px] rounded-xl bg-slate-900 px-4 text-xs font-extrabold text-[#FFCD00] hover:bg-slate-800 disabled:opacity-60"
                    >
                      {zonaEditandoId ? 'Actualizar Zona' : 'Agregar Zona'}
                    </button>
                  </div>
                </div>
              </form>

              <div className="space-y-2">
                {zonas.map((z) => (
                  <div
                    key={z.id_zona}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {z.nombre_zona}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {z.ciudad} •{' '}
                        <span
                          className={
                            z.activo
                              ? 'font-bold text-emerald-700'
                              : 'text-slate-400'
                          }
                        >
                          {z.activo ? 'ACTIVA' : 'INACTIVA'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setZonaEditandoId(z.id_zona);
                        setFormZona({
                          nombre_zona: z.nombre_zona,
                          ciudad: z.ciudad,
                          activo: z.activo,
                        });
                      }}
                      className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#C8102E] hover:text-[#C8102E]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

