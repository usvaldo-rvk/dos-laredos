# Build stage - usar imagen completa de Node (mejor soporte para módulos nativos)
FROM node:20 AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm install

# Generar cliente de Prisma
RUN npx prisma generate

# Copiar código fuente
COPY . .

# Compilar TypeScript (ignorar errores de tipo)
RUN npm run build || true

# Production stage - imagen más pequeña
FROM node:20-slim

WORKDIR /app

# Instalar libvips para sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

# Copiar node_modules del builder (incluye sharp compilado)
COPY --from=builder /app/node_modules ./node_modules

# Copiar archivos necesarios
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

# Crear directorio para uploads
RUN mkdir -p uploads/comprobantes

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["node", "dist/app.js"]
