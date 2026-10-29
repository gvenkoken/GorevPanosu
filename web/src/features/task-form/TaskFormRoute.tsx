import { useNavigate, useParams } from 'react-router-dom'
import type { createAdminApi } from '../../api/admin'
import { TaskForm } from './TaskForm'

export function TaskFormRoute({ api }: { api?: ReturnType<typeof createAdminApi> }) {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const back = () => navigate('/tasks')
  return <TaskForm key={taskId ?? 'new'} taskId={taskId} api={api} onSaved={back} onCancel={back} />
}
