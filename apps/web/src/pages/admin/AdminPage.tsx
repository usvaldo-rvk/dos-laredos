import { Link } from 'react-router-dom'
import { Users, Settings, Tv, Bell, Building2 } from 'lucide-react'

const adminSections = [
  {
    name: 'Usuarios',
    description: 'Gestionar usuarios y permisos',
    href: '/admin/usuarios',
    icon: Users,
    color: 'bg-blue-500'
  },
  {
    name: 'Configuración',
    description: 'Configuración del sistema',
    href: '/admin/configuracion',
    icon: Settings,
    color: 'bg-gray-500'
  },
  {
    name: 'Pantallas TV',
    description: 'Gestionar pantallas de armado',
    href: '/admin/pantallas-tv',
    icon: Tv,
    color: 'bg-purple-500'
  },
  {
    name: 'Notificaciones',
    description: 'Configurar alertas del sistema',
    href: '/admin/notificaciones',
    icon: Bell,
    color: 'bg-amber-500'
  },
  {
    name: 'Almacenes',
    description: 'Gestionar almacenes y ubicaciones',
    href: '/admin/almacenes',
    icon: Building2,
    color: 'bg-green-500'
  }
]

export default function AdminPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administración</h1>
        <p className="text-gray-600">Configuración y gestión del sistema</p>
      </div>

      {/* Grid de secciones */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminSections.map((section) => (
          <Link
            key={section.name}
            to={section.href}
            className="card p-6 hover:shadow-md transition group"
          >
            <div className="flex items-center gap-4">
              <div className={`${section.color} p-3 rounded-lg group-hover:scale-110 transition`}>
                <section.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{section.name}</h3>
                <p className="text-sm text-gray-500">{section.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
