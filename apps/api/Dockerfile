# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias del sistema para sharp y otras librerías nativas
RUN apk add --no-cache python3 make g++ vips-dev

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODAS las dependencias (incluyendo dev para compilar)
RUN npm ci

# Generar cliente de Prisma
RUN npx prisma generate

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema necesarias en runtime
RUN apk add --no-cache vips

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar solo dependencias de producción
RUN npm ci --only=production

# Generar cliente de Prisma
RUN npx prisma generate

# Copiar archivos compilados desde el builder
COPY --from=builder /app/dist ./dist

# Copiar assets (logo, etc.)
COPY --from=builder /app/assets ./assets

# Crear directorio para uploads
RUN mkdir -p uploads/comprobantes

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["node", "dist/app.js"]
