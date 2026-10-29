import { useEffect, useState } from 'react'
import './styles/theme.css'

function currentRoute() {
  return window.location.hash === '#/people' ? 'people' : 'tasks'
}
export function App() {
  const [route, setRoute] = useState(currentRoute)
  useEffect(() => {
    const navigate = () => setRoute(currentRoute())
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  const title = route === 'people' ? 'Kişiler' : 'Görevler'
  return <div className="app-shell">
    <aside className="sidebar">
      <p className="brand">GörevPanosu</p>
      <nav aria-label="Ana gezinme">
        <a href="#/tasks" aria-current={route === 'tasks' ? 'page' : undefined}>Görevler</a>
        <a href="#/people" aria-current={route === 'people' ? 'page' : undefined}>Kişiler</a>
      </nav>
    </aside>
    <main><h1>{title}</h1><section className="panel" aria-label={title + ' ekranı'}>
      <p>{title} ekranı yakında burada olacak.</p>
    </section></main>
  </div>
}
