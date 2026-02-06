# DOS LAREDOS - WMS Sistema de Gestión de Almacén
## Progreso de Desarrollo - Última actualización: 29 Enero 2026

---

## ARQUITECTURA DEL SISTEMA

### Stack Tecnológico
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Fastify + Prisma
- **Base de datos**: PostgreSQL
- **Autenticación**: JWT + PIN de supervisor (bcrypt)
- **Arquitectura de inventario**: Event-sourcing (el inventario se calcula desde eventos, nunca se almacena directamente)

### Almacenes
- Laredo Poniente
- Laredo México

---

## FUNCIONALIDADES IMPLEMENTADAS

### 1. Gestión de Tarimas (Pallets)
**Archivo principal**: `apps/api/src/modules/tarimas/tarimas.routes.ts`

- [x] CRUD completo de tarimas
- [x] Código QR único por tarima (formato: `DL-{timestamp}-{uuid}`)
- [x] Eventos registrados: CREACION, RECEPCION, PICK, MERMA, AJUSTE, REUBICACION
- [x] Cálculo de inventario desde eventos (event-sourcing)
- [x] Estados de tarima: ACTIVA, RESERVADA, AGOTADA, BLOQUEADA

**Endpoints**:
- GET /tarimas - Listar con filtros
- GET /tarimas/:id - Detalle con eventos
- GET /tarimas/qr/:qrCode - Buscar por QR
- POST /tarimas - Crear (recepción)
- PATCH /tarimas/:id/reubicar - Cambiar ubicación
- PATCH /tarimas/:id/estado - Cambiar estado (requiere supervisor)
- PATCH /tarimas/:id/precio - Actualizar precio unitario
- POST /tarimas/:id/merma - Registrar merma (SIEMPRE requiere PIN para operarios)
- POST /tarimas/:id/ajuste - Ajuste de inventario (puede ser + o -)

### 2. Sistema de Pedidos (Orders)
**Archivos**:
- `apps/api/src/modules/pedidos/pedidos.routes.ts`
- `apps/web/src/pages/pedidos/NuevoPedidoPage.tsx`
- `apps/web/src/pages/pedidos/PedidoDetallePage.tsx`

**Flujo implementado**:
1. Supervisor crea pedido seleccionando cliente y productos
2. Para cada producto, el supervisor ELIGE manualmente qué tarimas usar
3. Se muestra: QR de tarima, proveedor, ubicación, cantidad disponible, precio
4. El sistema genera "Instrucciones para Bodega" con pasos numerados
5. El pedido se crea en estado EN_PREPARACION

**Estados de pedido**: CREADO, INICIADO, EN_PREPARACION, COMPLETADO, CANCELADO

### 3. Picking de Bodega (NUEVO - 29 Enero 2026)
**Archivo**: `apps/web/src/pages/picking/PickingPage.tsx`

**Flujo implementado**:
1. Operario ve lista de pedidos EN_PREPARACION
2. Selecciona un pedido y ve las instrucciones paso a paso
3. Cada instrucción muestra: UBICACIÓN, TARIMA (QR), PROVEEDOR, CANTIDAD
4. Operario escanea QR de la tarima para verificar
5. Si QR coincide: puede confirmar cantidad
6. Si QR diferente: requiere PIN de supervisor para autorizar cambio
7. Al confirmar, se descuenta del inventario (evento PICK)
8. Progreso visual con barra y contador
9. Al completar todas las asignaciones, pedido se marca COMPLETADO

### 4. Sistema de Autorización por PIN
**Archivos**:
- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/web/src/pages/perfil/PerfilPage.tsx`

**Funcionalidades**:
- Supervisores y Admins pueden configurar su PIN de 4 dígitos
- El PIN se hashea con bcrypt
- Verificación busca en TODOS los admins/supervisores con PIN configurado
- Se registra quién autorizó cada acción en el historial

**Endpoints**:
- POST /auth/verify-pin - Verifica PIN y retorna datos del supervisor
- POST /auth/set-pin - Configura PIN del usuario actual
- DELETE /auth/delete-pin - Elimina PIN del usuario actual
- GET /auth/has-pin - Verifica si el usuario tiene PIN configurado

### 5. Página de Detalle de Tarima
**Archivo**: `apps/web/src/pages/tarimas/TarimaDetallePage.tsx`

- [x] Información completa de la tarima
- [x] Historial de eventos con timestamps
- [x] Muestra quién autorizó acciones con PIN (badge destacado)
- [x] Acciones: Actualizar precio, Registrar merma, Ajustar inventario
- [x] Modal de PIN para operarios (merma SIEMPRE requiere PIN)
- [x] Validación de capacidad DESACTIVADA (por solicitud del usuario)

### 6. Página de Perfil
**Archivo**: `apps/web/src/pages/perfil/PerfilPage.tsx`

- [x] Información del usuario
- [x] Configuración de PIN (solo supervisores/admins)
- [x] Opción de cambiar o eliminar PIN

---

## USUARIOS DE PRUEBA (del seed)

| Usuario | Email | Contraseña | Rol | PIN |
|---------|-------|------------|-----|-----|
| Administrador | admin@doslaredos.com | admin123 | ADMIN | 1234 |
| Supervisor | supervisor@doslaredos.com | super123 | SUPERVISOR | 5678 |
| Operario | operario@doslaredos.com | oper123 | OPERARIO | - |

---

## ARCHIVOS PRINCIPALES MODIFICADOS

### Backend (apps/api/src/)
```
modules/
├── auth/
│   └── auth.routes.ts          # Login, verify-pin, set-pin, delete-pin, has-pin
├── tarimas/
│   └── tarimas.routes.ts       # CRUD, merma, ajuste, precio
├── pedidos/
│   └── pedidos.routes.ts       # CRUD, asignación manual de tarimas
├── picking/
│   └── picking.routes.ts       # Confirmar picks, merma en picking
└── app.ts                      # Registro de rutas
```

### Frontend (apps/web/src/)
```
pages/
├── pedidos/
│   ├── NuevoPedidoPage.tsx     # Crear pedido con selección de tarimas
│   ├── PedidoDetallePage.tsx   # Ver pedido con instrucciones de bodega
│   └── PedidosPage.tsx         # Lista de pedidos
├── tarimas/
│   ├── TarimaDetallePage.tsx   # Detalle con historial y acciones
│   └── TarimasPage.tsx         # Lista de tarimas
├── picking/
│   └── PickingPage.tsx         # NUEVO: Proceso de picking para bodega
├── perfil/
│   └── PerfilPage.tsx          # Configuración de PIN
services/
└── api.ts                      # Servicios de API (authApi, tarimasApi, pedidosApi, pickingApi)
```

---

## DECISIONES DE DISEÑO

1. **Event-sourcing para inventario**: El inventario NUNCA se almacena directamente. Se calcula sumando/restando eventos (RECEPCION +, PICK -, MERMA -, AJUSTE +/-).

2. **Selección manual de tarimas**: El supervisor elige de qué tarimas tomar producto, NO el sistema automáticamente. Esto porque diferentes proveedores pueden tener el mismo producto.

3. **PIN siempre requerido para merma**: Los operarios SIEMPRE deben ingresar PIN de supervisor para registrar merma, sin importar la cantidad.

4. **Validación de capacidad desactivada**: Los ajustes pueden exceder la capacidad original de la tarima (solicitud del usuario).

5. **Override de tarima con PIN**: Si el operario escanea una tarima diferente a la asignada, puede continuar si un supervisor autoriza con PIN.

---

## PENDIENTE / POSIBLES MEJORAS

1. [ ] Reportes de inventario
2. [ ] Dashboard con estadísticas
3. [ ] Notificaciones push
4. [ ] Impresión de etiquetas QR
5. [ ] Exportar pedidos a PDF
6. [ ] Historial de pedidos del cliente
7. [ ] Búsqueda avanzada de tarimas
8. [ ] Configuración de límites de capacidad por sistema
9. [ ] Roles y permisos más granulares
10. [ ] App móvil para escáner

---

## CÓMO CONTINUAR

1. Iniciar el backend: `cd apps/api && npm run dev`
2. Iniciar el frontend: `cd apps/web && npm run dev`
3. La base de datos ya debe tener el seed ejecutado
4. Probar el flujo completo:
   - Login como supervisor
   - Crear un pedido seleccionando tarimas
   - Login como operario
   - Ir a Picking y procesar el pedido

---

## NOTAS TÉCNICAS

- Los modales usan `style` inline con `zIndex: 9999` para asegurar visibilidad
- El frontend usa React Query para cache y sincronización
- Las mutaciones invalidan queries relacionadas automáticamente
- Los formularios usan Zod para validación en backend
