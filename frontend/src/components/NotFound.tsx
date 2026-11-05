import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { Empty } from './Feedback'

export function NotFound() {
  return (
    <div className="page">
      <Empty icon={<Compass size={32} />} titulo="Esta página no existe">
        <Link to="/dashboard" className="btn primary">
          Ir al inicio
        </Link>
      </Empty>
    </div>
  )
}
