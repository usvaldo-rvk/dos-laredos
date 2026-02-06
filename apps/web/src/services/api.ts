import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para agregar token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token

  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },

  forgotPassword: async (email: string) => {
    const { data } = await api.post('/auth/forgot-password', { email })
    return data
  },

  resetPassword: async (token: string, password: string) => {
    const { data } = await api.post('/auth/reset-password', { token, password })
    return data
  },

  me: async () => {
    const { data } = await api.get('/auth/me')
    return data
  },

  verifyPin: async (pin: string, supervisorId?: string) => {
    const { data } = await api.post('/auth/verify-pin', { pin, supervisorId })
    return data
  },

  setPin: async (pin: string, currentPassword: string) => {
    const { data } = await api.post('/auth/set-pin', { pin, currentPassword })
    return data
  },

  deletePin: async (currentPassword: string) => {
    const { data } = await api.delete('/auth/pin', { data: { currentPassword } })
    return data
  },

  hasPin: async () => {
    const { data } = await api.get('/auth/has-pin')
    return data
  }
}

// Tarimas
export const tarimasApi = {
  list: async (params?: { almacenId?: string; estado?: string; page?: number }) => {
    const { data } = await api.get('/tarimas', { params })
    return data
  },

  get: async (id: string) => {
    const { data } = await api.get(`/tarimas/${id}`)
    return data
  },

  getByQr: async (qrCode: string) => {
    const { data } = await api.get(`/tarimas/qr/${qrCode}`)
    return data
  },

  create: async (tarima: any) => {
    const { data } = await api.post('/tarimas', tarima)
    return data
  },

  reubicar: async (id: string, ubicacionId: string, motivo?: string) => {
    const { data } = await api.patch(`/tarimas/${id}/reubicar`, { ubicacionId, motivo })
    return data
  },

  cambiarEstado: async (id: string, estado: string, motivo: string, supervisorId?: string) => {
    const { data } = await api.patch(`/tarimas/${id}/estado`, { estado, motivo, supervisorId })
    return data
  },

  actualizarPrecio: async (id: string, precioUnitario: number, supervisorId?: string) => {
    const { data } = await api.patch(`/tarimas/${id}/precio`, { precioUnitario, supervisorId })
    return data
  },

  registrarMerma: async (id: string, cantidad: number, motivo: string, supervisorId?: string) => {
    const { data } = await api.post(`/tarimas/${id}/merma`, { cantidad, motivo, supervisorId })
    return data
  },

  ajustarInventario: async (id: string, cantidad: number, motivo: string, supervisorId?: string) => {
    const { data } = await api.post(`/tarimas/${id}/ajuste`, { cantidad, motivo, supervisorId })
    return data
  },

  eliminar: async (id: string, motivo?: string) => {
    const { data } = await api.delete(`/tarimas/${id}`, { data: { motivo } })
    return data
  }
}

// Pedidos
export const pedidosApi = {
  list: async (params?: { almacenId?: string; estado?: string; page?: number }) => {
    const { data } = await api.get('/pedidos', { params })
    return data
  },

  get: async (id: string) => {
    const { data } = await api.get(`/pedidos/${id}`)
    return data
  },

  create: async (pedido: any) => {
    const { data } = await api.post('/pedidos', pedido)
    return data
  },

  asignar: async (id: string) => {
    const { data } = await api.post(`/pedidos/${id}/asignar`)
    return data
  },

  cerrar: async (id: string) => {
    const { data } = await api.post(`/pedidos/${id}/cerrar`)
    return data
  },

  cancelar: async (id: string, motivo?: string) => {
    const { data } = await api.post(`/pedidos/${id}/cancelar`, { motivo })
    return data
  },

  eliminar: async (id: string, confirmar?: boolean) => {
    const { data } = await api.delete(`/pedidos/${id}`, { params: { confirmar } })
    return data
  },

  // Enviar pedido a revisión (bodega reporta problema)
  enviarRevision: async (id: string, motivo: string) => {
    const { data } = await api.post(`/pedidos/${id}/revision`, { motivo })
    return data
  },

  // Resolver revisión y devolver a bodega
  resolverRevision: async (id: string, resolucion: string) => {
    const { data } = await api.post(`/pedidos/${id}/resolver-revision`, { resolucion })
    return data
  }
}

// Picking
export const pickingApi = {
  pendientes: async (almacenId?: string) => {
    const { data } = await api.get('/picking/pendientes', { params: { almacenId } })
    return data
  },

  escanear: async (qrCode: string) => {
    const { data } = await api.get(`/picking/escanear/${qrCode}`)
    return data
  },

  confirmar: async (asignacionId: string, cantidad: number, supervisorId?: string) => {
    const { data } = await api.post('/picking/confirmar', { asignacionId, cantidad, supervisorId })
    return data
  },

  merma: async (tarimaId: string, cantidad: number, motivo: string, supervisorId?: string) => {
    const { data } = await api.post('/picking/merma', { tarimaId, cantidad, motivo, supervisorId })
    return data
  },

  ajuste: async (tarimaId: string, cantidad: number, motivo: string) => {
    const { data } = await api.post('/picking/ajuste', { tarimaId, cantidad, motivo })
    return data
  }
}

// Clientes
export const clientesApi = {
  list: async (params?: { search?: string; page?: number }) => {
    const { data } = await api.get('/clientes', { params })
    return data
  },

  get: async (id: string) => {
    const { data } = await api.get(`/clientes/${id}`)
    return data
  },

  create: async (cliente: any) => {
    const { data } = await api.post('/clientes', cliente)
    return data
  },

  update: async (id: string, cliente: any) => {
    const { data } = await api.patch(`/clientes/${id}`, cliente)
    return data
  },

  historial: async (id: string) => {
    const { data } = await api.get(`/clientes/${id}/historial`)
    return data
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/clientes/${id}`)
    return data
  }
}

// Productos
export const productosApi = {
  list: async (params?: { search?: string; activo?: boolean; esRetornable?: boolean; page?: number; limit?: number }) => {
    const { data } = await api.get('/productos', { params })
    return data
  },

  get: async (id: string) => {
    const { data } = await api.get(`/productos/${id}`)
    return data
  },

  create: async (producto: any) => {
    const { data } = await api.post('/productos', producto)
    return data
  },

  update: async (id: string, producto: any) => {
    const { data } = await api.patch(`/productos/${id}`, producto)
    return data
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/productos/${id}`)
    return data
  },

  inventario: async (id: string, almacenId?: string) => {
    const { data } = await api.get(`/productos/${id}/inventario`, { params: { almacenId } })
    return data
  },

  agregarProveedor: async (id: string, proveedorId: string, precioCompra: number, valorDeposito?: number) => {
    const { data } = await api.post(`/productos/${id}/proveedores`, { proveedorId, precioCompra, valorDeposito })
    return data
  },

  quitarProveedor: async (id: string, proveedorId: string) => {
    const { data } = await api.delete(`/productos/${id}/proveedores/${proveedorId}`)
    return data
  }
}

// Proveedores
export const proveedoresApi = {
  list: async (params?: { search?: string; activo?: boolean; page?: number; limit?: number }) => {
    const { data } = await api.get('/proveedores', { params })
    return data
  },

  get: async (id: string) => {
    const { data } = await api.get(`/proveedores/${id}`)
    return data
  },

  create: async (proveedor: any) => {
    const { data } = await api.post('/proveedores', proveedor)
    return data
  },

  update: async (id: string, proveedor: any) => {
    const { data } = await api.patch(`/proveedores/${id}`, proveedor)
    return data
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/proveedores/${id}`)
    return data
  },

  productos: async (id: string) => {
    const { data } = await api.get(`/proveedores/${id}/productos`)
    return data
  }
}

// Catálogos (atajos para listas simples)
export const catalogosApi = {
  almacenes: async () => {
    const { data } = await api.get('/almacenes')
    return data
  },

  ubicaciones: async (almacenId: string) => {
    const { data } = await api.get(`/almacenes/${almacenId}/ubicaciones`)
    return data
  },

  productos: async (search?: string) => {
    const { data } = await api.get('/productos', { params: { search } })
    return data.data || data
  },

  proveedores: async () => {
    const { data } = await api.get('/proveedores')
    return data.data || data
  }
}

// Reportes
export const reportesApi = {
  inventario: async (almacenId?: string) => {
    const { data } = await api.get('/reportes/inventario', { params: { almacenId } })
    return data
  },

  movimientos: async (params: any) => {
    const { data } = await api.get('/reportes/movimientos', { params })
    return data
  },

  mermas: async (params: any) => {
    const { data } = await api.get('/reportes/mermas', { params })
    return data
  },

  productividad: async (params: any) => {
    const { data } = await api.get('/reportes/productividad', { params })
    return data
  },

  kpis: async (almacenId?: string) => {
    const { data } = await api.get('/reportes/kpis', { params: { almacenId } })
    return data
  },

  clientesTop: async (limit?: number) => {
    const { data } = await api.get('/reportes/clientes-top', { params: { limit } })
    return data
  },

  pagos: async (params?: { fechaInicio?: string; fechaFin?: string; metodoPago?: string }) => {
    const { data } = await api.get('/reportes/pagos', { params })
    return data
  },

  creditos: async (params?: { estado?: string }) => {
    const { data } = await api.get('/reportes/creditos', { params })
    return data
  },

  ingresos: async (periodo?: string) => {
    const { data } = await api.get('/reportes/ingresos', { params: { periodo } })
    return data
  },

  depositos: async (params?: { almacenId?: string; proveedorId?: string }) => {
    const { data } = await api.get('/reportes/depositos', { params })
    return data
  },

  ventas: async (params: { periodo?: string; fechaInicio?: string; fechaFin?: string; almacenId?: string }) => {
    const { data } = await api.get('/reportes/ventas', { params })
    return data
  },

  exportar: async (tipo: string, params: any) => {
    const response = await api.get(`/reportes/exportar/${tipo}`, {
      params,
      responseType: 'blob'
    })
    return response.data
  }
}

// Notificaciones
export const notificacionesApi = {
  list: async () => {
    const { data } = await api.get('/notificaciones')
    return data
  },

  countNoLeidas: async () => {
    const { data } = await api.get('/notificaciones/no-leidas/count')
    return data
  },

  marcarLeida: async (id: string) => {
    const { data } = await api.patch(`/notificaciones/${id}/leer`)
    return data
  },

  marcarTodasLeidas: async () => {
    const { data } = await api.patch('/notificaciones/leer-todas')
    return data
  },

  preferencias: async () => {
    const { data } = await api.get('/notificaciones/preferencias')
    return data
  },

  actualizarPreferencias: async (preferencias: any[]) => {
    const { data } = await api.patch('/notificaciones/preferencias', { preferencias })
    return data
  }
}

// TV
export const tvApi = {
  pedidos: async (token: string) => {
    const { data } = await api.get(`/tv/pedidos/${token}`)
    return data
  }
}

// Eventos (sync offline)
export const eventosApi = {
  sync: async (eventos: any[]) => {
    const { data } = await api.post('/eventos/sync', { eventos })
    return data
  }
}

// Pagos
export const pagosApi = {
  // Obtener pagos de un pedido
  getPorPedido: async (pedidoId: string) => {
    const { data } = await api.get(`/pagos/pedido/${pedidoId}`)
    return data
  },

  // Registrar un pago
  registrar: async (pago: {
    pedidoId: string
    metodoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO'
    monto: number
    referencia?: string
    comprobante?: string
    notas?: string
  }) => {
    const { data } = await api.post('/pagos', pago)
    return data
  },

  // Registrar múltiples pagos
  registrarMultiples: async (pedidoId: string, pagos: Array<{
    metodoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO'
    monto: number
    referencia?: string
    comprobante?: string
    notas?: string
  }>) => {
    const { data } = await api.post('/pagos/multiples', { pedidoId, pagos })
    return data
  },

  // Anular un pago
  anular: async (id: string) => {
    const { data } = await api.delete(`/pagos/${id}`)
    return data
  }
}

// Créditos
export const creditosApi = {
  // Listar créditos con filtros
  list: async (params?: { estado?: string; clienteId?: string; page?: number; limit?: number }) => {
    const { data } = await api.get('/creditos', { params })
    return data
  },

  // Créditos de un cliente
  getPorCliente: async (clienteId: string) => {
    const { data } = await api.get(`/creditos/cliente/${clienteId}`)
    return data
  },

  // Detalle de un crédito
  get: async (id: string) => {
    const { data } = await api.get(`/creditos/${id}`)
    return data
  },

  // Registrar abono
  registrarAbono: async (creditoId: string, abono: {
    metodoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
    monto: number
    referencia?: string
    comprobante?: string
  }) => {
    const { data } = await api.post(`/creditos/${creditoId}/abono`, abono)
    return data
  },

  // Historial de abonos
  getAbonos: async (creditoId: string) => {
    const { data } = await api.get(`/creditos/${creditoId}/abonos`)
    return data
  },

  // Resumen general
  resumenGeneral: async () => {
    const { data } = await api.get('/creditos/resumen/general')
    return data
  }
}

// Comprobantes (upload de imágenes)
export const comprobantesApi = {
  // Subir comprobante
  upload: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/comprobantes/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  },

  // Obtener info de comprobante
  getInfo: async (filename: string) => {
    const { data } = await api.get(`/comprobantes/info/${filename}`)
    return data
  }
}
