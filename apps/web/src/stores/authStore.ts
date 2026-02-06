import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Almacen {
  id: string
  codigo: string
  nombre: string
}

interface User {
  id: string
  email: string
  nombre: string
  rol: 'OPERARIO' | 'SUPERVISOR' | 'ADMIN'
  almacenes: Almacen[]
}

interface AuthState {
  user: User | null
  token: string | null
  almacenActivo: Almacen | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  setAlmacenActivo: (almacen: Almacen) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      almacenActivo: null,
      isAuthenticated: false,

      login: (user, token) => {
        set({
          user,
          token,
          isAuthenticated: true,
          almacenActivo: user.almacenes[0] || null
        })
      },

      logout: () => {
        set({
          user: null,
          token: null,
          almacenActivo: null,
          isAuthenticated: false
        })
      },

      setAlmacenActivo: (almacen) => {
        set({ almacenActivo: almacen })
      }
    }),
    {
      name: 'dos-laredos-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        almacenActivo: state.almacenActivo,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
