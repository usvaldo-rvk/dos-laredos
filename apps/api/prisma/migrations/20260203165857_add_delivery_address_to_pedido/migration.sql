-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('OPERARIO', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoTarima" AS ENUM ('ACTIVA', 'RESERVADA', 'AGOTADA', 'BLOQUEADA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CREACION', 'RECEPCION', 'ASIGNACION_PICK', 'PICK', 'MERMA', 'REUBICACION', 'AJUSTE', 'CIERRE_TARIMA');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('CREADO', 'INICIADO', 'EN_PREPARACION', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoAsignacion" AS ENUM ('ABIERTA', 'CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PERSONA', 'EMPRESA');

-- CreateEnum
CREATE TYPE "TipoUbicacion" AS ENUM ('PASILLO', 'FILA', 'ZONA');

-- CreateEnum
CREATE TYPE "TipoEnvase" AS ENUM ('LATA', 'BOTELLA', 'OTRO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CREDITO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'CREDITO');

-- CreateEnum
CREATE TYPE "EstadoCredito" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('RECOLECCION', 'ENVIO');

-- CreateTable
CREATE TABLE "almacenes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almacenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" TEXT NOT NULL,
    "almacen_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoUbicacion" NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "presentacion" TEXT NOT NULL,
    "unidad_medida" TEXT NOT NULL,
    "tipo_envase" "TipoEnvase",
    "capacidad_ml" INTEGER,
    "unidades_por_carton" INTEGER,
    "es_retornable" BOOLEAN NOT NULL DEFAULT false,
    "precio_publico" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "rfc" TEXT,
    "direccion" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_proveedores" (
    "id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "precio_compra" DECIMAL(10,2) NOT NULL,
    "valor_deposito" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCliente" NOT NULL,
    "nombre_empresa" TEXT,
    "nombre_contacto" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "telefono_secundario" TEXT,
    "email" TEXT,
    "rfc" TEXT,
    "direccion_calle" TEXT,
    "direccion_numero" TEXT,
    "direccion_colonia" TEXT,
    "direccion_ciudad" TEXT,
    "direccion_estado" TEXT,
    "direccion_cp" TEXT,
    "coordenadas_lat" DOUBLE PRECISION,
    "coordenadas_lng" DOUBLE PRECISION,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "pin_hash" TEXT,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_almacenes" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "almacen_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_almacenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_notificacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "tipos_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferencias_notificacion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo_notificacion_id" TEXT NOT NULL,
    "email_habilitado" BOOLEAN NOT NULL DEFAULT true,
    "push_habilitado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "preferencias_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo_notificacion_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarimas" (
    "id" TEXT NOT NULL,
    "almacen_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "ubicacion_id" TEXT,
    "capacidad_total" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2),
    "deposito_por_envase" DECIMAL(10,2),
    "lote" TEXT,
    "fecha_produccion" TIMESTAMP(3),
    "fecha_caducidad" TIMESTAMP(3),
    "estado" "EstadoTarima" NOT NULL DEFAULT 'ACTIVA',
    "qr_code" TEXT NOT NULL,
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarimas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_tarima" (
    "id" TEXT NOT NULL,
    "tarima_id" TEXT NOT NULL,
    "almacen_id" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "rol_usuario" "Rol" NOT NULL,
    "supervisor_id" TEXT,
    "cantidad" INTEGER,
    "pedido_id" TEXT,
    "ubicacion_origen_id" TEXT,
    "ubicacion_destino_id" TEXT,
    "motivo" TEXT,
    "timestamp_local" TIMESTAMP(3) NOT NULL,
    "timestamp_servidor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sync_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_tarima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "almacen_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "numero_pedido" TEXT NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'CREADO',
    "notas" TEXT,
    "fecha_requerida" TIMESTAMP(3),
    "creado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tipo_entrega" "TipoEntrega" NOT NULL DEFAULT 'RECOLECCION',
    "direccion_calle" TEXT,
    "direccion_numero" TEXT,
    "direccion_colonia" TEXT,
    "direccion_ciudad" TEXT,
    "direccion_estado" TEXT,
    "direccion_cp" TEXT,
    "direccion_referencia" TEXT,
    "subtotal" DECIMAL(10,2),
    "descuento" DECIMAL(10,2) DEFAULT 0,
    "total" DECIMAL(10,2),
    "estado_pago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_lineas" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "cantidad_solicitada" INTEGER NOT NULL,
    "cantidad_surtida" INTEGER NOT NULL DEFAULT 0,
    "precio_unitario" DECIMAL(10,2),
    "costo_unitario" DECIMAL(10,2),
    "subtotal" DECIMAL(10,2),
    "proveedor_id" TEXT,
    "proveedor_nombre" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_pick" (
    "id" TEXT NOT NULL,
    "pedido_linea_id" TEXT NOT NULL,
    "tarima_id" TEXT NOT NULL,
    "cantidad_asignada" INTEGER NOT NULL,
    "cantidad_confirmada" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoAsignacion" NOT NULL DEFAULT 'ABIERTA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asignaciones_pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_sistema" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "umbrales_stock" (
    "id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "almacen_id" TEXT NOT NULL,
    "cantidad_minima" INTEGER NOT NULL,
    "cantidad_critica" INTEGER NOT NULL,

    CONSTRAINT "umbrales_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pantallas_tv" (
    "id" TEXT NOT NULL,
    "almacen_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pantallas_tv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "referencia" TEXT,
    "comprobante" TEXT,
    "notas" TEXT,
    "registrado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "monto_original" DECIMAL(10,2) NOT NULL,
    "monto_pendiente" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoCredito" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_vencimiento" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creditos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abonos" (
    "id" TEXT NOT NULL,
    "credito_id" TEXT NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "referencia" TEXT,
    "comprobante" TEXT,
    "registrado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "almacenes_codigo_key" ON "almacenes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_almacen_id_codigo_key" ON "ubicaciones"("almacen_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_sku_key" ON "productos"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_codigo_key" ON "proveedores"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_proveedores_producto_id_proveedor_id_key" ON "productos_proveedores"("producto_id", "proveedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_almacenes_usuario_id_almacen_id_key" ON "usuarios_almacenes"("usuario_id", "almacen_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_notificacion_codigo_key" ON "tipos_notificacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_notificacion_usuario_id_tipo_notificacion_id_key" ON "preferencias_notificacion"("usuario_id", "tipo_notificacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "tarimas_qr_code_key" ON "tarimas"("qr_code");

-- CreateIndex
CREATE INDEX "tarimas_almacen_id_estado_idx" ON "tarimas"("almacen_id", "estado");

-- CreateIndex
CREATE INDEX "tarimas_producto_id_idx" ON "tarimas"("producto_id");

-- CreateIndex
CREATE INDEX "tarimas_qr_code_idx" ON "tarimas"("qr_code");

-- CreateIndex
CREATE INDEX "eventos_tarima_tarima_id_idx" ON "eventos_tarima"("tarima_id");

-- CreateIndex
CREATE INDEX "eventos_tarima_almacen_id_timestamp_local_idx" ON "eventos_tarima"("almacen_id", "timestamp_local");

-- CreateIndex
CREATE INDEX "eventos_tarima_tipo_idx" ON "eventos_tarima"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_pedido_key" ON "pedidos"("numero_pedido");

-- CreateIndex
CREATE INDEX "pedidos_almacen_id_estado_idx" ON "pedidos"("almacen_id", "estado");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_idx" ON "pedidos"("cliente_id");

-- CreateIndex
CREATE INDEX "asignaciones_pick_tarima_id_estado_idx" ON "asignaciones_pick"("tarima_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_sistema_clave_key" ON "configuracion_sistema"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "umbrales_stock_producto_id_almacen_id_key" ON "umbrales_stock"("producto_id", "almacen_id");

-- CreateIndex
CREATE UNIQUE INDEX "pantallas_tv_token_key" ON "pantallas_tv"("token");

-- CreateIndex
CREATE INDEX "pagos_pedido_id_idx" ON "pagos"("pedido_id");

-- CreateIndex
CREATE INDEX "pagos_metodo_pago_idx" ON "pagos"("metodo_pago");

-- CreateIndex
CREATE INDEX "creditos_cliente_id_idx" ON "creditos"("cliente_id");

-- CreateIndex
CREATE INDEX "creditos_estado_idx" ON "creditos"("estado");

-- CreateIndex
CREATE INDEX "abonos_credito_id_idx" ON "abonos"("credito_id");

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_proveedores" ADD CONSTRAINT "productos_proveedores_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_proveedores" ADD CONSTRAINT "productos_proveedores_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_almacenes" ADD CONSTRAINT "usuarios_almacenes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_almacenes" ADD CONSTRAINT "usuarios_almacenes_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_notificacion" ADD CONSTRAINT "preferencias_notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_notificacion" ADD CONSTRAINT "preferencias_notificacion_tipo_notificacion_id_fkey" FOREIGN KEY ("tipo_notificacion_id") REFERENCES "tipos_notificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_tipo_notificacion_id_fkey" FOREIGN KEY ("tipo_notificacion_id") REFERENCES "tipos_notificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarimas" ADD CONSTRAINT "tarimas_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarimas" ADD CONSTRAINT "tarimas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarimas" ADD CONSTRAINT "tarimas_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarimas" ADD CONSTRAINT "tarimas_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tarima" ADD CONSTRAINT "eventos_tarima_tarima_id_fkey" FOREIGN KEY ("tarima_id") REFERENCES "tarimas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tarima" ADD CONSTRAINT "eventos_tarima_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tarima" ADD CONSTRAINT "eventos_tarima_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tarima" ADD CONSTRAINT "eventos_tarima_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tarima" ADD CONSTRAINT "eventos_tarima_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tarima" ADD CONSTRAINT "eventos_tarima_ubicacion_origen_id_fkey" FOREIGN KEY ("ubicacion_origen_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tarima" ADD CONSTRAINT "eventos_tarima_ubicacion_destino_id_fkey" FOREIGN KEY ("ubicacion_destino_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_lineas" ADD CONSTRAINT "pedido_lineas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_lineas" ADD CONSTRAINT "pedido_lineas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_pick" ADD CONSTRAINT "asignaciones_pick_pedido_linea_id_fkey" FOREIGN KEY ("pedido_linea_id") REFERENCES "pedido_lineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_pick" ADD CONSTRAINT "asignaciones_pick_tarima_id_fkey" FOREIGN KEY ("tarima_id") REFERENCES "tarimas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "umbrales_stock" ADD CONSTRAINT "umbrales_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "umbrales_stock" ADD CONSTRAINT "umbrales_stock_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantallas_tv" ADD CONSTRAINT "pantallas_tv_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos" ADD CONSTRAINT "creditos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos" ADD CONSTRAINT "creditos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_credito_id_fkey" FOREIGN KEY ("credito_id") REFERENCES "creditos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
