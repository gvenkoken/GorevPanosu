import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { createAdminApi } from '../../api/admin'
import type { Person, Task } from '../../api/admin'
import { ActionButton } from '../../components/ActionButton'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import './tasks.css'

type TasksApi = ReturnType<typeof createAdminApi>
interface Props { api?: TasksApi; now?: () => Date }
const defaultApi = createAdminApi()
const systemTime = () => new Date()
const message = (error: unknown) => error instanceof Error ? error.message : 'İşlem gerçekleştirilemedi.'

export function TasksScreen({ api = defaultApi, now = systemTime }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const requestId = useRef(0)
  const actionLock = useRef(false)
  const deleteTrigger = useRef<HTMLButtonElement | null>(null)
  const cancelButton = useRef<HTMLButtonElement | null>(null)
  const refreshButton = useRef<HTMLButtonElement | null>(null)

  async function load() {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const [nextTasks, nextPeople] = await Promise.all([api.tasks.list(), api.people.list()])
      if (id !== requestId.current) return
      setTasks(nextTasks)
      setPeople(nextPeople)
      setUpdatedAt(now())
    } catch (error) {
      if (id === requestId.current) setError(message(error))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    return () => { requestId.current++ }
  }, [api])
  useEffect(() => {
    if (deleting) cancelButton.current?.focus()
    else if (!busy && deleteTrigger.current) {
      if (deleteTrigger.current.isConnected) deleteTrigger.current.focus()
      else refreshButton.current?.focus()
      deleteTrigger.current = null
    }
  }, [deleting, busy])

  async function mutate(operation: () => Promise<unknown>, removedId?: string) {
    if (actionLock.current) return
    actionLock.current = true
    setBusy(true)
    setActionError(null)
    try {
      const result = await operation()
      if (removedId) {
        setTasks(current => current.filter(task => task.id !== removedId))
        setDeleting(null)
      } else {
        const changed = result as Task
        setTasks(current => current.map(task => task.id === changed.id ? changed : task))
      }
    } catch (error) { setActionError(message(error)) }
    finally { actionLock.current = false; setBusy(false) }
  }
  function cancelDelete() {
    setDeleting(null)
  }
  const date = updatedAt ?? now()
  const localDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return <section className="tasks-screen" aria-label="Görevler ekranı">
    <div className="tasks-toolbar">
      <h2>Görevler</h2>
      <Link className="button button--primary" to="/tasks/new">Yeni görev</Link>
      <button ref={refreshButton} className="button button--secondary" disabled={loading || busy || !!deleting} onClick={() => void load()}>Yenile</button>
      <span>Son yenileme: {updatedAt ? <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleString('tr-TR')}</time> : 'Henüz yenilenmedi'}</span>
    </div>
    {loading && <Notice>Görevler yükleniyor…</Notice>}
    {error && <Notice variant="error">{error} <ActionButton onClick={() => void load()}>Tekrar dene</ActionButton></Notice>}
    {actionError && <Notice variant="error">{actionError}</Notice>}
    {!loading && !error && <>
      {tasks.length === 0 ? <Notice>Henüz görev yok.</Notice> : <div className="tasks-table-scroll" role="region" aria-label="Görev tablosu" tabIndex={0}>
        <table className="tasks-table">
          <thead><tr><th scope="col">Başlık</th><th scope="col">Atanan kişi</th><th scope="col">Son tarih</th><th scope="col">Durum</th><th scope="col">İşlemler</th></tr></thead>
          <tbody>{tasks.map(task => <tr key={task.id}>
            <th scope="row">{task.title}</th>
            <td><span>{people.find(person => person.id === task.assigneeId)?.fullName ?? (task.assigneeId ? 'Bilinmeyen kişi' : <StatusBadge status="unassigned" />)}</span>
              <label className="tasks-assignee">{task.title} için atama
                <select value={task.assigneeId ?? ''} disabled={busy || !!deleting} onChange={event => { const assigneeId = event.target.value || null; void mutate(() => api.tasks.assign(task.id, assigneeId)) }}>
                  <option value="">Atanmamış</option>
                  {people.filter(person => person.isActive || person.id === task.assigneeId).map(person => <option key={person.id} value={person.id} disabled={!person.isActive}>{person.fullName}{!person.isActive && ' (Pasif)'}</option>)}
                  {task.assigneeId && !people.some(person => person.id === task.assigneeId) && <option value={task.assigneeId} disabled>Bilinmeyen kişi</option>}
                </select>
              </label>
            </td>
            <td>{task.dueDate ? <><time dateTime={task.dueDate}>{task.dueDate.slice(0, 10).split('-').reverse().join('.')}</time>{task.status === 'Open' && task.dueDate.slice(0, 10) < localDay && <strong className="tasks-overdue">Gecikmiş</strong>}</> : 'Son tarih yok'}</td>
            <td><StatusBadge status={task.status === 'Open' ? 'open' : 'completed'} /></td>
            <td><div className="tasks-actions">
              <Link to={`/tasks/${encodeURIComponent(task.id)}/edit`}>Düzenle</Link>
              <ActionButton disabled={busy || !!deleting} onClick={() => void mutate(() => task.status === 'Open' ? api.tasks.complete(task.id) : api.tasks.reopen(task.id))}>{task.status === 'Open' ? 'Tamamla' : 'Yeniden aç'}</ActionButton>
              <ActionButton variant="danger" disabled={busy || !!deleting} onClick={event => { deleteTrigger.current = event.currentTarget; setDeleting(task) }}>Sil</ActionButton>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </>}
    {deleting && <div role="alertdialog" aria-labelledby="tasks-delete-title" aria-describedby="tasks-delete-description" onKeyDown={event => { if (event.key === 'Escape' && !busy) cancelDelete() }} className="tasks-delete">
      <h3 id="tasks-delete-title">Görevi sil</h3>
      <p id="tasks-delete-description">“{deleting.title}” silinsin mi? Bu işlem geri alınamaz.</p>
      <button ref={cancelButton} className="button button--secondary" disabled={busy} onClick={cancelDelete}>Vazgeç</button>
      <ActionButton variant="danger" pending={busy} onClick={() => void mutate(() => api.tasks.remove(deleting.id), deleting.id)}>Silmeyi onayla</ActionButton>
    </div>}
  </section>
}
export default TasksScreen
