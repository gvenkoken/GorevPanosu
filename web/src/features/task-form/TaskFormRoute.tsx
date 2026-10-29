import { useEffect, useState } from 'react'
import { TasksScreen } from '../tasks/TasksScreen'
import { TaskForm } from './TaskForm'

// Mount in the application's tasks section to handle the task list links.
export function TaskFormRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const navigate = () => setHash(window.location.hash)
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  if (hash === '#/tasks/new') return <TaskForm key="new" />
  const edit = /^#\/tasks\/([^/]+)\/edit$/.exec(hash)
  if (edit) {
    try {
      const taskId = decodeURIComponent(edit[1])
      return <TaskForm key={taskId} taskId={taskId} />
    } catch { return <p role="alert">Geçersiz görev bağlantısı.</p> }
  }
  return <TasksScreen />
}
