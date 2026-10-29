import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { createAdminApi } from './api/admin'
import { PeopleScreen } from './features/people/PeopleScreen'
import { TasksScreen } from './features/tasks/TasksScreen'
import { TaskFormRoute } from './features/task-form/TaskFormRoute'
import './styles/theme.css'

const defaultApi = createAdminApi()

export function App({ api = defaultApi }: { api?: ReturnType<typeof createAdminApi> }) {
  const { pathname } = useLocation()
  return <div className="app-shell">
    <aside className="sidebar">
      <p className="brand">GörevPanosu</p>
      <nav aria-label="Ana gezinme">
        <NavLink to={pathname === '/' ? '/' : '/tasks'}>Görevler</NavLink>
        <NavLink to="/people">Kişiler</NavLink>
      </nav>
    </aside>
    <main><Routes>
      <Route path="/" element={<TasksScreen api={api} />} />
      <Route path="/tasks" element={<TasksScreen api={api} />} />
      <Route path="/tasks/new" element={<TaskFormRoute api={api} />} />
      <Route path="/tasks/:taskId/edit" element={<TaskFormRoute api={api} />} />
      <Route path="/people" element={<PeopleScreen api={api} />} />
    </Routes></main>
  </div>
}
