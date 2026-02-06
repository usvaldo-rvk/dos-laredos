# DOS LAREDOS - Sistema WMS

Sistema de gestión de almacén (WMS) con arquitectura Event Sourcing para Distribuidora Dos Laredos.

## Características

- **Event Sourcing**: Todo se registra como eventos inmutables
- **Multi-almacén**: Soporte para múltiples almacenes (Laredo Poniente, Laredo México)
- **Offline-first**: Funciona sin conexión y sincroniza automáticamente
- **PWA**: Instalable en dispositivos móviles y tablets
- **Vista TV**: Pantallas especiales para zona de armado

## Stack Tecnológico

### Frontend
- React 18 + TypeScript
- Vite
- TailwindCSS
- TanStack Query
- Zustand
- React Router

### Backend
- Node.js + TypeScript
- Fastify
- Prisma ORM
- PostgreSQL
- Redis

## Requisitos Previos

- Node.js 20+
- Docker y Docker Compose
- npm o yarn

## Instalación

### 1. Clonar e instalar dependencias

```bash
cd dos-laredos
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

### 3. Iniciar base de datos con Docker

```bash
docker-compose up -d
```

### 4. Configurar Prisma

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 5. Iniciar desarrollo

```bash
npm run dev
```

El sistema estará disponible en:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Usuarios de Prueba

| Email | Contraseña | Rol | PIN |
|-------|------------|-----|-----|
| admin@doslaredos.com | admin123 | ADMIN | 1234 |
| supervisor@doslaredos.com | super123 | SUPERVISOR | 5678 |
| operario@doslaredos.com | oper123 | OPERARIO | - |

## Pantallas TV

URLs para pantallas de armado:
- Laredo Poniente: http://localhost:5173/tv/pedidos/tv-lp-principal
- Laredo México: http://localhost:5173/tv/pedidos/tv-lm-principal

## Estructura del Proyecto

```
dos-laredos/
├── apps/
│   ├── api/              # Backend Fastify
│   │   ├── src/
│   │   │   ├── modules/  # Módulos por dominio
│   │   │   └── shared/   # Utilidades compartidas
│   │   └── prisma/       # Schema y migraciones
│   │
│   └── web/              # Frontend React
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── stores/
│       │   └── services/
│       └── public/
│
├── packages/
│   └── shared/           # Tipos compartidos
│
└── docker-compose.yml
```

## Comandos Disponibles

```bash
# Desarrollo
npm run dev              # Inicia frontend y backend
npm run dev:api          # Solo backend
npm run dev:web          # Solo frontend

# Base de datos
npm run db:generate      # Genera cliente Prisma
npm run db:push          # Sincroniza schema
npm run db:migrate       # Ejecuta migraciones
npm run db:seed          # Datos iniciales
npm run db:studio        # Abre Prisma Studio

# Build
npm run build            # Build de producción
```

## Módulos del Sistema

| Módulo | Descripción |
|--------|-------------|
| Auth | Autenticación y autorización |
| Tarimas | Gestión de tarimas/pallets |
| Eventos | Registro de eventos (event sourcing) |
| Pedidos | Gestión de pedidos de clientes |
| Picking | Proceso de picking con validación |
| Clientes | Base de datos de clientes |
| Reportes | KPIs y reportes operativos |
| Notificaciones | Sistema de alertas |
| TV | Vista especial para pantallas de armado |

## Principios del Sistema

1. **Nada se edita, todo se registra como evento**
2. **La tarima es la unidad física de verdad**
3. **El evento es la unidad lógica de verdad**
4. **El inventario se calcula, nunca se captura**
5. **El sistema decide, el usuario confirma**
6. **Toda acción relevante es auditable**

## Licencia

Propiedad de Distribuidora Dos Laredos. Todos los derechos reservados.
