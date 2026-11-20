# Manual Operativo de Usuario — EUROALIMENTOS S.R.L.

**Sistema POS, Preventa Móvil, Control de Producción, Despacho y Contabilidad SAC**

---

## 1. Portada y Control de Versión del Manual

| Atributo | Especificación |
| :--- | :--- |
| **Empresa** | EUROALIMENTOS S.R.L. (Planta Procesadora de Embutidos y Charcutería — Bolivia) |
| **Sistema** | EuroPOS (`EUROALIMENTOS SRL - POS y Preventa`) |
| **Versión del Manual** | 1.0 (Alineado a producción real: 352 clientes SAC, 19 SKUs, 4 roles RBAC) |
| **Arquitectura Tecnológica** | Next.js 16 (App Router) + React + TypeScript + Tailwind CSS + PWA + Supabase PostgreSQL (3FN + Herencia CTI) |
| **Zona Horaria Operativa** | `America/La_Paz` (Bolivia, UTC-4) |
| **Moneda y Precisión** | Bolivianos (`Bs.`) a 2 decimales / Inventario físico en Kilogramos (`kg`) a 3 decimales (`0.001 kg`) y Unidades (`UNIDAD`) |
| **Alcance Operativo** | Planta / Cámara de Frío, Preventa Móvil en Ruta, Balanza de Despacho (4:00 AM) y Administración / Contabilidad SAC |

---

## 2. Visión General del Flujo Operativo de Punta a Punta (Ciclo Diario y Semanal)

El sistema conecta de forma continua las cuatro áreas operativas de **EUROALIMENTOS S.R.L.** sobre una base de datos transaccional única en PostgreSQL:

1. **Planta / Producción (`/produccion/*`):** Abastece la cámara de frío registrando lotes terminados (en kilogramos o en unidades para presentaciones empaquetadas como `CHMOR001` de 500 g) y ejecuta transformaciones de producto `GRANEL` a `VACIO` auditando automáticamente la merma por escurrido o empaque.
2. **Preventa en Calle (`/vendedor/*`):** Los vendedores levantan pedidos desde sus celulares (PWA) seleccionando clientes de la cartera SAC (`352 clientes`), definiendo condición de venta (`CONTADO` o `CRÉDITO`) y registrando cantidades estimadas en kilos enteros o unidades. Cada preventa incrementa el **Stock Comprometido** (`stock_comprometido_kilos`) sin bloquear ventas cuando hay déficit, notificando automáticamente a Planta mediante alertas visuales.
3. **Despacho en Planta (`/despacho/*` — Jornada 4:00 AM):** El despachador alista pedidos pendientes, captura el **peso real exacto en balanza de gancho con 3 decimales (`0.001 kg`)**, agrega si corresponde líneas de **bonificación/cortesía sin costo (`0.00 Bs`)**, asigna opcionalmente el número de documento SAC (`nro_documento_sac`), confirma la salida descontando el **Stock Físico** real en el Kardex e imprime la **Nota de Venta Térmica** (`58 mm` o `80 mm`) en impresora Epson.
4. **Administración y Contabilidad (`/admin/*`):** Gerencia audita pedidos diarios, ejecuta **Anulaciones por Rebote** devolviendo los kilos físicos al Kardex, exporta el archivo plano Excel de **34 columnas** (`Hoja1`) compatible con la importación directa de **`VENTAS.xls` (SAC)**, concilia el **Cuadre de Saldos e Inventario Kardex** y mantiene actualizados los catálogos maestros de productos, clientes, zonas y usuarios.

### Flujo de Estados de Pedido y Movimientos de Inventario

```text
+-----------------------------------------------------------------------------+
|                     CICLO OPERATIVO DIARIO Y SEMANAL                        |
+-----------------------------------------------------------------------------+

  [1. PLANTA / PRODUCCIÓN]
     |-- Ingreso de Lote Terminado -------> Kardex: INGRESO_PRODUCCION (+ kg)
     |-- Transformación GRANEL -> VACIO --> Kardex: SALIDA_TRANSFORMACION (- kg)
                                                    ENTRADA_TRANSFORMACION (+ kg)
                                                    Merma = Usados - Obtenidos

  [2. VENDEDOR EN RUTA]
     |-- Crea Preventa -------------------> Estado Pedido: PENDIENTE
                                            Sube stock_comprometido_kilos
                                            (No descuenta stock_fisico_kilos)
                                            Si disponible <= 0 -> Alerta en Planta

  [3. DESPACHO EN BALANZA (4:00 AM)]
     |-- Alistamiento + Pesaje Real (0.001 kg) + Cortesías (0.00 Bs)
     |-- Confirmar Despacho --------------> Estado Pedido: DESPACHADO
                                            Asigna correlativo nro_nota_venta
                                            Libera stock_comprometido_kilos
                                            Descuenta stock_fisico_kilos
                                            Kardex: SALIDA_VENTA (- kg facturados)
                                                    SALIDA_CORTESIA (- kg bonif.)
                                            Imprime Ticket Epson 58mm / 80mm

  [4. ADMINISTRACIÓN Y CONTABILIDAD SAC]
     |-- /admin/historial ----------------> Si hay devolución en ruta (Rebote):
     |                                      Estado Pedido: ANULADO (Soft Delete)
     |                                      Kardex: REINGRESO_ANULACION (+ kg)
     |-- /admin/reportes -----------------> Exporta .xlsx SAC (34 cols · Hoja1)
     |-- /admin/kardex -------------------> Cuadre de Saldos (19 SKUs) y Bitácora
```

> **Importante:** Ningún pedido despachado se elimina físicamente de la base de datos. Toda devolución o rechazo en ruta se gestiona mediante **Anulación por Rebote**, preservando la trazabilidad histórica e invirtiendo el impacto físico en cámara de frío.

---

## 3. Acceso al Sistema, Seguridad y Gestión de Contraseñas (`/login`)

### 3.1. Inicio de Sesión en 2 Pasos

El acceso se realiza mediante la pantalla `/login`:

1. **Paso 1 de 2 — Identificación de Usuario (`Usuario Operativo`):**
   - Ingrese su nombre de usuario en minúsculas y sin espacios (por ejemplo: `vendedor1`, `despacho1`, `produccion1`, `admin`).
   - Presione **`Continuar`**. El sistema valida que el usuario exista y esté **activo** en `public.usuarios`.
2. **Paso 2A de 2 — Ingreso de Contraseña (Flujo Normal):**
   - Verifique el recuadro superior con su nombre completo, insignia de rol y usuario (`@username`). Si desea cambiar de cuenta, pulse **`Cambiar usuario`**.
   - Ingrese su contraseña (puede usar el icono del ojo para visualizarla u ocultarla) y presione **`Ingresar al Sistema`**.
3. **Paso 2B de 2 — Cambio Obligatorio de Contraseña (`requiere_cambio_clave`):**
   - Si Administración habilitó un restablecimiento de clave para su cuenta desde `/admin/catalogo`, tras completar el Paso 1 el sistema le pedirá directamente definir una **Nueva Contraseña** y **Confirmar Nueva Contraseña** (mínimo 6 caracteres) sin solicitar la clave anterior.
   - Al guardar, su sesión queda autenticada y la bandera `requiere_cambio_clave` se desactiva automáticamente.

### 3.2. Matriz de Roles y Control de Acceso (RBAC)

El middleware de seguridad (`src/proxy.ts` y `src/lib/supabase/middleware.ts`) y los layouts de servidor restringen cada ruta estrictamente al rol asignado:

| Rol del Sistema | Ruta Inicial | Rutas Permitidas | Módulos en Barra de Navegación |
| :--- | :--- | :--- | :--- |
| **`VENDEDOR`** | `/vendedor/nueva-venta` | `/vendedor/*` | `Nueva Preventa`, `Mis Pedidos` |
| **`DESPACHADOR`** | `/despacho` | `/despacho/*` | `Bandeja Despacho`, `Historial Despachos` |
| **`PRODUCCION`** | `/produccion/lotes` | `/produccion/*` | `Ingreso de Lotes`, `Transformar Granel`, `Historial Kardex` |
| **`ADMINISTRADOR`** | `/admin/historial` | `/admin/*` | `Historial y Rebotes`, `Reportes SAC`, `Kardex e Inventario`, `Catálogo y Usuarios` |

Si un usuario intenta abrir manualmente la URL de otro rol, el sistema lo redirige automáticamente a su ruta inicial correspondiente.

### 3.3. Instalación como Aplicación Móvil (PWA) y Uso de Borradores

El sistema cuenta con manifiesto web (`EuroPOS`) y barra de navegación inferior móvil (`Thumb-Zone`) optimizada para uso con una sola mano en celulares:

- **Android (Google Chrome):** Abra la URL del sistema $\rightarrow$ menú de tres puntos (`⋮`) $\rightarrow$ **`Instalar aplicación`** o **`Agregar a la pantalla principal`**.
- **iOS / iPhone (Safari):** Abra la URL en Safari $\rightarrow$ botón **Compartir** $\rightarrow$ **`Agregar a inicio`**.
- **Borradores Locales en Preventa:** La pantalla `/vendedor/nueva-venta` guarda automáticamente el borrador en curso en el almacenamiento local del dispositivo (`localStorage`), aislado por vendedor. Si el navegador se recarga o pierde señal momentáneamente, al volver encontrará su cliente, ítems, condición de pago y observaciones intactas.

---

## 4. Guía Operativa Rol 1: VENDEDOR (App Móvil PWA)

### 4.1. Nueva Preventa (`/vendedor/nueva-venta`)

Pantalla móvil diseñada para registrar pedidos en ruta en menos de 30 segundos.

#### Paso 1: Selección de Cliente y Ficha Comercial
1. Pulse el selector de cliente para abrir el buscador táctil sobre la cartera completa (`352 clientes SAC`).
2. Busque por **código SAC** (`CL-XXXXX`), **nombre comercial**, **razón social**, **NIT/CI** o **zona/localidad**. Si requiere dar de alta un cliente nuevo en ruta, utilice el botón de registro rápido disponible en el selector.
3. Al seleccionar el cliente, revise su **Ficha Comercial**:
   - **Condición habitual registrada en SAC:** `CONTADO` o `CRÉDITO` (con plazo habitual en días y límite de crédito referencial en Bs.).
   - **Alerta Informativa de Cortesía Habitual:** Si el cliente posee una regla registrada en SAC (por ejemplo: *"200 GR DE CORTESIA"* o *"GENERALMENTE PIDE 50 KG SE LE DA 1 DE CORTESIA"*), se muestra destacada para que el vendedor esté informado (las líneas de cortesía física se aplican en Planta durante el pesaje).

#### Paso 2: Condición de Pago del Pedido
- El pedido pre-carga automáticamente la forma de pago habitual del cliente (`CONTADO` o `CRÉDITO`), pero el vendedor puede ajustarla para la orden puntual:
  - **`CONTADO`:** Plazo `0` días.
  - **`CRÉDITO`:** Habilita el selector rápido de plazo (**`7`**, **`15`**, **`30` días**) o ingreso manual de días personalizados.

#### Paso 3: Selección de Productos (`19 SKUs`)
Cada tarjeta del catálogo muestra `codigo_sku`, nombre completo, formato (`GRANEL` o `VACIO`), precio vigente (`Bs./kg` o `Bs./unid.`) y estado de disponibilidad:

- **Productos por Kilo (`unidad_medida === 'KILO'`):**
  - **Fila 1 (Precisión):** Botón **`-`**, campo numérico central para ingreso directo en kilogramos enteros y botón **`+`**.
  - **Fila 2 (Accesos Rápidos):** Botones táctiles **`+1`**, **`+5`**, **`+10`** y **`+20`** para sumar kilos rápidamente con el pulgar.
- **Productos por Unidad (`unidad_medida === 'UNIDAD'` — ej. `CHMOR001` Morcilla al Vacío 500gr):**
  - El ingreso se realiza en **unidades/paquetes**.
  - El sistema calcula y muestra automáticamente la equivalencia física en kilogramos (`unidades × peso_unidad_kilos`, por ejemplo `4 unid. × 0.500 kg = 2.000 kg`) para el cálculo de precio y stock.
- **Alerta Roja `"Requiere Producción"`:**
  - Aparece cuando `stock_disponible_kilos <= 0`.
  - **Regla de negocio:** **Nunca bloquea la preventa.** El vendedor puede registrar y enviar el pedido normalmente; en cuanto confirma, el pedido queda comprometido y aparece destacado en rojo en el **Monitor de Déficit** del rol `PRODUCCION` para que Planta fabrique el faltante antes del despacho de madrugada.

#### Paso 4: Borrador Local, Observaciones y Confirmación
- **Persistencia en `localStorage`:** Si sale de la pantalla antes de enviar, un banner le indicará que existe un borrador restaurado (`euroalimentos_preventa_draft_v1_<vendedor>`), con opción para continuar editando o descartarlo.
- **Observaciones:** Campo de texto libre para instrucciones de entrega (horario, referencia de puesto, pedido especial de cortesía para que Despacho lo vea en balanza).
- **Envío:** Revise el total estimado en Bs. y kilos en el resumen inferior y presione **`Confirmar (Bs. ...)`**. Al guardarse en Supabase, el borrador local se limpia automáticamente y la orden nace en estado `PENDIENTE`.

---

### 4.2. Mis Pedidos y Seguimiento (`/vendedor/mis-pedidos`)

Permite a cada vendedor consultar **exclusivamente sus propios pedidos** (aislamiento de privacidad respecto a otros vendedores de la empresa):

- **Filtros:** Jornada / rango de fechas, buscador por cliente o nota, y pestañas por estado (`TODOS`, `PENDIENTE`, `DESPACHADO`, `ANULADO`).
- **Comparativa Estimado vs. Real:**
  - Mientras el pedido está `PENDIENTE`, muestra los `kilos_estimados` solicitados en ruta y el monto estimado.
  - Una vez despachado (`DESPACHADO`), muestra el número de **Nota de Venta** asignado, la condición (`CONTADO` / `CRÉDITO`), los **`kilos_reales`** exactos pesados en balanza, los kilos de cortesía entregados (`0.00 Bs`) y el monto definitivo facturado.

---

## 5. Guía Operativa Rol 2: PRODUCCIÓN (Planta y Cámara de Frío)

### 5.1. Ingreso de Lotes Terminados y Monitor de Déficit (`/produccion/lotes`)

Diseñada en dos columnas para operar en tablet o escritorio dentro de planta (con panel derecho fijo `sticky` y buscador en el monitor izquierdo):

1. **Columna Izquierda — Monitor de Déficit y Catálogo:**
   - Buscador instantáneo por SKU o nombre de producto.
   - Muestra para cada producto: **Stock Físico**, **Preventa Comprometida** y **Disponible / Déficit**.
   - Los productos cuya demanda de preventa supera el stock físico aparecen priorizados en alerta roja para fabricación inmediata. Al hacer clic en un producto de la lista, se selecciona automáticamente en el formulario de registro.
2. **Columna Derecha — Registrar Lote Producido:**
   - **Selector de Producto:** Muestra `codigo_sku`, nombre, formato y saldo actual en cámara.
   - **Código de Lote Interno:** Ingrese o genere el código de lote (mínimo 3 caracteres, ej. `L-20261119-01`).
   - **Fecha de Elaboración:** Fecha operativa del lote.
   - **Cantidad Producida:**
     - Para productos `KILO`: ingrese el peso neto terminado con hasta 3 decimales (`0.001 kg`).
     - Para productos `UNIDAD` (como `CHMOR001` 500gr): el formulario permite alternar entre modo **Unidades** (calculando automáticamente los kilogramos equivalentes según `peso_unidad_kilos = 0.500 kg` y añadiendo el detalle de unidades a la observación) o **Kilogramos**.
   - **Tarjeta `"Impacto en Cámara de Frío (Kardex en Vivo)"`:** Previsualiza el saldo anterior, el incremento y el saldo proyectado. Al confirmar, ejecuta el RPC `rpc_registrar_lote_produccion` y actualiza inmediatamente en pantalla el stock físico de la lista y el monitor sin necesidad de recargar la página (`F5`).

---

### 5.2. Transformación de Granel a Envasado al Vacío (`/produccion/transformacion`)

Utilizado cuando chorizo producido a **Granel (`GRANEL`)** pasa por máquina empacadora al **Vacío (`VACIO`)**:

1. Seleccione el **Producto Origen (`GRANEL`)** (valida existencia física disponible).
2. Seleccione el **Producto Destino (`VACIO`)**.
3. Ingrese **Kilos Origen Usados (`kg`)** y **Kilos Destino Obtenidos (`kg`)**.
4. **Cálculo Automático de Merma por Escurrido / Empaque:**
   - Fórmula en tiempo real y columna generada en PostgreSQL:
     `merma_kilos = kilos_origen_usados - kilos_destino_obtenidos`
   - El sistema calcula el porcentaje de merma y advierte visualmente si supera la tolerancia configurada en el perfil de producción (`tolerancia_merma_max_pct`, por defecto `5.00%`).
5. Al confirmar (`rpc_transformar_granel_a_vacio`), el sistema registra la transformación y genera en un solo movimiento atómico:
   - Un asiento **`SALIDA_TRANSFORMACION`** en el producto origen.
   - Un asiento **`ENTRADA_TRANSFORMACION`** en el producto destino.
   - Actualización inmediata del stock en cámara sin refrescar la página.

---

### 5.3. Historial de Planta (`/produccion/historial`)

Vista de consulta del turno de planta donde Producción revisa cronológicamente:
- Lotes ingresados (`INGRESO_PRODUCCION`) con código de lote interno y kilos producidos.
- Transformaciones realizadas (`GRANEL -> VACIO`) con kilos usados, kilos obtenidos y merma exacta registrada.
- Filtros por fecha, producto y tipo de operación.

---

## 6. Guía Operativa Rol 3: DESPACHADOR (Balanza de Gancho y Ticketera Epson)

### 6.1. Bandeja Matutina de Pedidos Pendientes (`/despacho`)

Centro de operaciones para la jornada de despacho (4:00 AM):

- **Tarjetas Resumen:** Muestran pedidos pendientes en cola, kilos estimados totales a despachar y estado general de cámara.
- **Filtros Operativos:** Buscador rápido (`#PED`, nombre de cliente o código `CL-XXXXX`), filtro por **Zona**, filtro por **Vendedor** y ordenamiento por llegada.
- **Checklist de Alistamiento en Canastillo (`ALISTADO: X/Y`):**
  - Cada línea del pedido puede marcarse táctilmente a medida que se carga al canastillo.
  - Cuando todas las líneas están marcadas (`X === Y`), la tarjeta muestra visualmente el estado de alistamiento completo antes de pasar a balanza.
- **Alertas Visibles:** Muestra etiquetas de **`CORTESÍA HABITUAL`**, **`CORTESÍA PURA`**, condición de venta (`CONTADO` / `CRÉDITO`) y observaciones enviadas por el vendedor.
- Presione sobre un pedido para abrir su **Estación de Pesaje Real** (`/despacho/[id]`).

---

### 6.2. Estación de Pesaje Real en Gancho y Cortesías (`/despacho/[id]`)

Pantalla optimizada para uso veloz junto a balanza digital e impresora térmica:

1. **Cabecera del Pedido y Banner Informativo de Cortesía Habitual:**
   - Muestra `#PED`, condición (`CONTADO` o `CRÉDITO X días`), datos del cliente y observaciones del vendedor.
   - Si el cliente tiene registrada `regla_cortesia_habitual`, se despliega una **alerta visual informativa ámbar** (`CORTESÍA HABITUAL DEL CLIENTE (REGLA SAC)`): *"Regla informativa — Agregue manualmente la línea de cortesía abajo si corresponde."* (sin automatismos que puedan inducir a error).
2. **Bloque 1 — `1. Pesaje en Gancho — Líneas Solicitadas`:**
   - Para cada ítem pedido por el vendedor, ingrese el **peso real de balanza** con precisión de **3 decimales (`0.001 kg`)**.
   - **Botones de Ajuste Fino:** `-100g`, `-50g`, `+50g`, `+100g`, `+500g` junto al campo numérico.
   - **Navegación con Teclado:** Al presionar **`Enter`** o **`Tab`**, el foco salta automáticamente al siguiente campo de pesaje para operar sin soltar la pieza o usar teclado numérico USB.
   - Para ítems en `UNIDAD` (`CHMOR001` 500gr), se muestra la equivalencia en unidades y peso real en kg.
3. **Bloque 2 — `2. Bonificaciones / Cortesías sin Costo (0.00 Bs)`:**
   - Pulse para agregar una línea de cortesía sin costo.
   - Se abre un **selector táctil con buscador modal** (búsqueda instantánea por SKU o nombre de producto, filtros `Todos`, `GRANEL`, `VACIO` y visualización del stock físico en cámara).
   - Ingrese los kilos reales pesados para la cortesía.
   - **Impacto contable e inventario:** La cortesía suma en **`Total Físico a Descontar`** (generando un movimiento `SALIDA_CORTESIA` real en Kardex), pero mantiene **`0.00 Bs`** en **`TOTAL A COBRAR (BS.)`**.
4. **Campo Opcional `N° Doc. SAC`:**
   - Permite registrar manualmente el correlativo de documento emitido en el sistema contable SAC si ya se conoce al despachar (si se deja vacío, la exportación SAC usará el número de Nota de Venta).
5. **Confirmación de Despacho (`CONFIRMAR DESPACHO Y GENERAR NOTA`):**
   - Al confirmar, el backend ejecuta transaccionalmente la asignación de `nro_nota_venta`, el cambio a `DESPACHADO`, la liberación de `stock_comprometido_kilos`, la deducción de `stock_fisico_kilos` y la creación de los asientos en `movimientos_kardex`, redirigiendo automáticamente al ticket de impresión.

---

### 6.3. Confirmación, Impresión Térmica (`/despacho/imprimir/[id]`) e Historial (`/despacho/historial`)

El componente `TicketTermicoEpson` genera comprobantes ESC/POS monoespaciados listos para impresoras **Epson TM-T20** u equivalentes, mediante un `<iframe>` dedicado sin márgenes de navegador (`@page size: 58mm auto` o `80mm auto`):

- **Selector de Ancho de Rollo:**
  - **`58 mm`** (`32` columnas, tipografía compacta)
  - **`80 mm`** (`48` columnas, estándar recomendado)
- **Estructura del Ticket:**
  1. **Cabecera:** `EUROALIMENTOS S.R.L.`, `Planta Procesadora de Embutidos`, `NOTA DE VENTA N° 00XXXX`, `Doc. SAC N° ...` (si aplica), referencia `#PED-XXX`, fecha/hora Bolivia y condición (`CONTADO` o `CRÉDITO X DÍAS`).
  2. **Trazabilidad:** Cliente (`codigo_cliente_sac - nombre_comercial`), Zona, Vendedor y Despachador / Balanza.
  3. **Detalle Facturado:** SKU, nombre, kilos reales (y unidades si aplica), precio unitario congelado y subtotal en Bs.
  4. **Detalle de Cortesías (si existen):** Marcado explícitamente como `[CORTESIA]` con monto `0.00 Bs` y peso real entregado.
  5. **Totales:** Peso Facturado (kg), Peso Cortesía (kg), **Total Físico Entregado (kg)** y **`TOTAL A COBRAR (BS.)`**.
- **Reimpresión (`/despacho/historial`):** Desde el **Historial de Despachos**, el despachador puede buscar cualquier nota ya despachada, abrir su vista previa térmica y pulsar **`Reimprimir Ticket Térmico`** en cualquier momento.

---

## 7. Guía Operativa Rol 4: ADMINISTRADOR (Gerencia, Auditoría y Contabilidad SAC)

### 7.1. Auditoría de Ventas y Anulación por Rebote (`/admin/historial`)

Módulo de supervisión gerencial sobre todas las órdenes del sistema (`PENDIENTE`, `DESPACHADO`, `ANULADO`):

- **Filtros Multicriterio:** Rango de fechas (`Hoy`, `Ayer`, `Últimos 7 días`, fechas personalizadas), estado, tipo de venta (`CONTADO` / `CRÉDITO`), zona, vendedor y buscador por número de nota, `#PED` o cliente.
- **Comparativa Auditada:** Para cada orden muestra `Kilos Estimados` (preventa) vs. `Kilos Reales Vendidos` (balanza) vs. `Kilos Cortesía`, además de edición de observaciones/pesos cuando corresponde en auditoría.
- **Anulación por Rebote (`Soft Delete` — `CU-A02`):**
  1. Localice un pedido en estado `DESPACHADO` que haya sufrido devolución total en ruta.
  2. Abra la acción de anulación por rebote (requiere permiso `puede_anular_despachos = true` en el perfil administrador).
  3. Seleccione o redacte obligatoriamente el **Motivo de Rebote** (mínimo 10 caracteres; sugerencias rápidas disponibles como *"Local cerrado en ruta"*, *"Rechazo por horario de entrega"*, *"Error de pedido del cliente"*).
  4. Al confirmar (`rpc_anular_pedido_rebote`):
     - El pedido cambia a estado **`ANULADO`** (nunca se borra de la base de datos).
     - Se crea el registro de auditoría en `public.anulaciones_pedido`.
     - Se genera automáticamente un movimiento **`REINGRESO_ANULACION`** en `movimientos_kardex` sumando nuevamente todos los kilos reales (ventas + cortesías) al `stock_fisico_kilos` de cámara de frío.

---

### 7.2. Exportación Contable para Sistema SAC (`/admin/reportes`)

Vista dedicada **100% exclusivamente a la exportación contable para el sistema SAC**, sin mezclarse con inventarios internos:

- **Selector de Periodicidad:**
  - **`Semanal` (Activo por defecto):** Calcula automáticamente la semana operativa actual (**Lunes a Sábado**). Incluye botones **`Semana Actual`**, **`Semana Anterior`** y selector de rango **`Desde` / `Hasta`**.
  - **`Diario`:** Permite elegir **`Hoy`**, **`Ayer`** o una **`Fecha`** puntual.
- **Filtros de Vista Previa y KPIs:**
  - KPIs en tiempo real del rango seleccionado: **`Notas Despachadas`**, **`Líneas Facturadas`**, **`Líneas Cortesía`** y **`Total Facturado Bs.`**.
  - Filtros por `Tipo Venta`, `Vendedor`, `Zona`, inclusión opcional de cortesías (`Incluir Cortesías (Precio 0.00 Bs)`) y buscador.
- **Descarga Oficial (`Descargar Excel SAC Semanal (.xlsx)` / `Descargar Excel SAC Diario (.xlsx)`):**
  - Botón verde esmeralda fijo en la cabecera superior derecha.
  - Genera un archivo `.xlsx` con **una única hoja llamada `Hoja1`**, **encabezados en la Fila 1** y **registros desde la Fila 2**, sin filas decorativas de título arriba ni fila de totales al pie, listo para importación directa en SAC (`VENTAS.xls`).

#### Especificación Exacta de las 34 Columnas del Excel SAC (`Hoja1`)

| # | Nombre Exacto de Columna | Regla de Generación / Origen en Base de Datos |
| :-: | :--- | :--- |
| 1 | `Fecha` | Fecha y hora en formato `YYYY-MM-DD HH:mm:ss` (zona `America/La_Paz`, ej. `2026-11-19 18:48:00`) |
| 2 | `Tipo Doc.` | Valor fijo `'VD'` |
| 3 | `Nro. Suc` | Valor fijo numérico `0` |
| 4 | `Nº doc/fac` | `nro_documento_sac` si fue registrado; caso contrario `nro_nota_venta` (numérico) |
| 5 | `N° Aut` | Vacío `''` |
| 6 | `Cod Control` | Vacío `''` |
| 7 | `Estado` | Valor fijo `'V'` |
| 8 | `Nit` | `Number(nit_ci) || 0` |
| 9 | `Razon Social` | `razon_social` del cliente, o `nombre_comercial` si no tiene razón social distinta |
| 10 | `Tipo Venta` | `'Credito'` cuando `tipo_venta === 'CREDITO'`; `'Contado'` cuando `tipo_venta === 'CONTADO'` |
| 11 | `Plazo` | `plazo_dias ?? 0` (numérico) |
| 12 | `Moneda` | Valor fijo `'BS'` |
| 13 | `TC` | Tipo de cambio fijo `6.96` |
| 14 | `Desc. Fin` | `0` |
| 15 | `Suc. Cliente` | `0` |
| 16 | `Cod. Cliente` | `codigo_cliente_sac` sin prefijo `'0-'` (ej. `'CL-00043'`) |
| 17 | `Nom. Cliente` | Nombre comercial del cliente |
| 18 | `Cod. Vendedor` | `codigo_empleado_sac` del vendedor (ej. `'EM-01'`) |
| 19 | `Nom. Vendedor` | Nombre completo del vendedor |
| 20 | `Codigo Prd.` | `codigo_sku` del producto (ej. `'CHC001'`) |
| 21 | `Nombre Prd.` | Nombre del producto |
| 22 | `Detalle Servicio` | Vacío `''` |
| 23 | `Cantidad` | Si `unidad_medida === 'UNIDAD'` (`CHMOR001` 500gr): unidades enteras `Math.round(kilos / peso_unidad_kilos)`. Si es `'KILO'`: kilogramos reales a 3 decimales |
| 24 | `Precio` | `0` si `es_cortesia === true`; caso contrario `precio_unitario_congelado` |
| 25 | `Desc x Prd.` | `0` |
| 26 | `Costo` | `costo_unitario_bs` vigente del producto (`productos.costo_unitario_bs`) |
| 27 | `Unid. Medida` | `'KILO'` o `'UNIDAD'` según el producto |
| 28 | `Empresa` | Valor fijo `'EUROALIMENTOS SRL'` |
| 29 | `Categoria` | Valor fijo `'PROD. TERMINADO'` |
| 30 | `Linea` | Vacío `''` |
| 31 | `Marca` | Vacío `''` |
| 32 | `Detalle Venta` | Si `es_cortesia === true`: `'NOTA DE VENTA-' + nro_nota + ' (CORTESIA)'`; si no: `'NOTA DE VENTA-' + nro_nota` |
| 33 | `Centro Costo` | Vacío `''` |
| 34 | `Objeto` | Vacío `''` |

---

### 7.3. Kardex e Inventario (`/admin/kardex`)

Módulo dedicado exclusivamente a la **auditoría interna de cámara física y movimientos** (sin botones de exportación a Excel), controlado por un selector de fechas superior (`Semana Actual`, `Hoy`, `Últimos 30 días` y rango manual `Desde` / `Hasta` + **`Consultar`**):

#### Pestaña 1 — `Cuadre de Saldos por Producto (19 SKUs)`
Incluye filtros rápidos por presentación (`Todos`, `GRANEL`, `VACIO`), buscador por SKU/descripción y tabla paginada (`15` / `30` / `50` por página) con totales conciliados al pie:

| Columna | Significado Contable / Físico |
| :--- | :--- |
| `SKU` | Código único del producto (`CHC001`, `CHMOR001`, etc.) |
| `Producto y Presentación` | Nombre del chorizo/embutido y formato (`GRANEL` o `VACIO`) |
| `Saldo Inicial (Kg)` | Saldo previo al primer movimiento dentro del periodo consultado (o stock actual si no hubo movimientos en el periodo) |
| `+ Producción (Kg)` | Suma de lotes ingresados por Planta (`INGRESO_PRODUCCION`) |
| `± Transf. Granel/Vacío (Kg)` | Balance neto por empaquetado (`ENTRADA_TRANSFORMACION` en destino, menos kilos obtenidos en origen) |
| `- Merma (Kg)` | Merma por escurrido o empaque registrada en `transformaciones_inventario` |
| `- Ventas (Kg)` | Suma de kilos reales facturados y despachados (`SALIDA_VENTA`) |
| `- Cortesías (Kg)` | Suma de kilos reales entregados sin costo (`SALIDA_CORTESIA`) |
| `+ Rebotes (Kg)` | Kilos devueltos a cámara por anulaciones de rebote (`REINGRESO_ANULACION`) |
| `Saldo Final (Kg)` | Existencia exacta al cierre del periodo (`saldo_nuevo_kilos` del último movimiento del rango) |

#### Pestaña 2 — `Bitácora de Auditoría Kardex`
Muestra todos los asientos registrados en `public.movimientos_kardex`, filtrables por **Producto (`Todos los SKUs`)**, **Tipo de Movimiento** (`INGRESO_PRODUCCION`, `SALIDA_VENTA`, `SALIDA_CORTESIA`, `REINGRESO_ANULACION`, `SALIDA_TRANSFORMACION`, `ENTRADA_TRANSFORMACION`) y búsqueda libre (`SKU`, `NV-`, código de lote, responsable u observación):

- Columnas auditadas: `Fecha y Hora`, `SKU y Producto`, `Tipo de Movimiento` (insignia semántica), `Referencia` (`NV-00XXXX`, `Lote ...` o `Transformación`), `Responsable`, `Variación (+/- Kg)`, `Saldo Anterior (Kg)`, `Saldo Nuevo (Kg)` y `Observación`.

---

### 7.4. Gestión de Catálogos Maestros y Usuarios (`/admin/catalogo`)

Centraliza la administración en tres pestañas:

1. **Catálogo de Productos (`CHORIZOS` — 19 SKUs):**
   - Alta, edición y activación/desactivación de variedades (`codigo_sku`, `nombre_producto`, `formato`, `unidad_medida`, `peso_unidad_kilos`, `precio_kilo_bs`, `costo_unitario_bs`, `stock_minimo_alerta`).
   - **Regla de Congelamiento de Precios (`precio_unitario_congelado`):** Al modificar `precio_kilo_bs` en el catálogo, el nuevo precio aplica únicamente a **nuevas preventas**. Todas las preventas ya creadas y notas ya despachadas conservan inalterable su `precio_unitario_congelado` original.
2. **Usuarios del Sistema (`USUARIOS`):**
   - Creación y edición de cuentas de colaboradores (`nombre_completo`, `username`, `rol`, `codigo_empleado_sac`, metadatos CTI del perfil).
   - **Botón `Habilitar Cambio Clave`:** Marca `requiere_cambio_clave = true` en el usuario seleccionado (permite también revertir con `Cancelar Cambio Clave`). La próxima vez que el colaborador ingrese su usuario en `/login`, el sistema le permitirá establecer una contraseña nueva sin conocer la anterior.
3. **Clientes y Zonas SAC (`CLIENTES` — 352 registros):**
   - Gestión de clientes (`codigo_cliente_sac`, `nombre_comercial`, `razon_social`, `nit_ci`, `forma_pago_habitual`, `plazo_dias`, `limite_credito_bs`, `regla_cortesia_habitual`, `observaciones`, `id_zona`) y gestión de **Zonas de Mercado**.

---

## 8. Glosario Operativo y Preguntas Frecuentes (FAQ)

### Glosario Rápido

- **Stock Físico (`stock_fisico_kilos`):** Kilos reales que existen físicamente dentro de la cámara de frío en ese instante.
- **Stock Comprometido (`stock_comprometido_kilos`):** Kilos reservados por pedidos en estado `PENDIENTE` que aún no han pasado por balanza.
- **Stock Disponible (`stock_disponible_kilos`):** Columna calculada `stock_fisico_kilos - stock_comprometido_kilos`. Si es `<= 0`, indica déficit frente a la preventa del día.
- **Congelamiento de Precio (`precio_unitario_congelado`):** Precio capturado al crear la preventa para proteger cotizaciones pactadas con el cliente ante cambios posteriores de tarifa.
- **Cortesía Pura vs. Línea de Cortesía:** Una línea de cortesía (`es_cortesia = true`) tiene subtotal `0.00 Bs` dentro de una venta normal; un pedido de cortesía pura (`es_pedido_cortesia_pura = true`) no tiene ningún ítem facturado (`Total = 0.00 Bs`). En ambos casos se descuentan kilos reales de cámara.
- **Rebote:** Devolución total de mercadería despachada que regresa físicamente a planta y se procesa mediante anulación lógica (`ANULADO`) en `/admin/historial`.

### Preguntas Frecuentes y Solución de Problemas

**1. ¿Qué hago si un vendedor intenta registrar un pedido y el producto marca "Requiere Producción"?**
El vendedor debe continuar y confirmar el pedido normalmente. El sistema nunca bloquea la preventa; el pedido queda en cola de despacho y el faltante aparece automáticamente en rojo en el **Monitor de Déficit** de `/produccion/lotes` para que Planta produzca los kilos necesarios antes del despacho.

**2. ¿Cómo corrijo un peso antes de confirmar el despacho en balanza?**
Mientras no haya presionado **`CONFIRMAR DESPACHO Y GENERAR NOTA`**, puede modificar libremente cualquiera de los pesos en `/despacho/[id]` digitando el valor exacto o usando los botones `-100g`, `-50g`, `+50g`, `+100g`, `+500g`. Si la nota ya fue confirmada y el error es de auditoría posterior, un usuario `ADMINISTRADOR` puede revisar el detalle en `/admin/historial` o anular por rebote si corresponde.

**3. ¿Qué pasa si un cliente rechaza o devuelve toda la mercadería en ruta (Rebote)?**
No intente modificar manualmente las tablas ni descontar en producción. El `ADMINISTRADOR` debe ingresar a `/admin/historial`, ubicar la Nota de Venta `DESPACHADO`, pulsar la acción de **Anular por Rebote** e ingresar el motivo detallado. El sistema cambiará el pedido a `ANULADO` y reingresará automáticamente los kilos físicos al Kardex (`REINGRESO_ANULACION`).

**4. ¿Cómo reimprimo una Nota de Venta térmica si se atascó el papel en la ticketera Epson?**
Ingrese en el módulo de Despacho a **Historial Despachos** (`/despacho/historial`), ubique la nota mediante el buscador o fecha, seleccione el pedido para abrir `/despacho/imprimir/[id]` (o el visor del historial), elija el ancho de rollo (`58mm` u `80mm`) y presione **`Reimprimir Ticket Térmico`**.

**5. ¿Por qué al abrir `/vendedor/nueva-venta` después de un cierre accidental siguen apareciendo mis ítems?**
Porque el formulario guarda automáticamente un borrador por vendedor en el navegador (`localStorage`). Si desea iniciar una preventa limpia desde cero, haga clic en el botón de descartar borrador que aparece en el banner superior.

**6. ¿Qué requisitos debo cumplir al importar el archivo Excel generado en `/admin/reportes` dentro del sistema SAC?**
Descargue el archivo desde **`Descargar Excel SAC Semanal (.xlsx)`** (o **`Diario`**). El archivo ya cumple con la estructura plana exacta exigida por SAC: hoja llamada **`Hoja1`**, encabezados en la **Fila 1**, datos desde la **Fila 2**, sin títulos decorativos ni fila de totales, con las **34 columnas** idénticas a `VENTAS.xls`, `Cod. Cliente` sin prefijo `0-`, `Precio = 0` en cortesías y cantidad convertida a unidades enteras en productos `UNIDAD` (`CHMOR001`).

**7. ¿Un colaborador olvidó su contraseña; cómo la restablezco sin acceso directo a la base de datos?**
Un `ADMINISTRADOR` debe ir a `/admin/catalogo` $\rightarrow$ pestaña **`Usuarios del Sistema`**, ubicar al colaborador y hacer clic en **`Habilitar Cambio Clave`**. Luego pida al colaborador ingresar su `username` en `/login`; el sistema lo llevará directamente a la pantalla para crear su nueva contraseña.
