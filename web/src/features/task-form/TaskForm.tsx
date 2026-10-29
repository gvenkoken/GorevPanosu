import { useEffect, useId, useRef, useState } from 'react'
import { createAdminApi } from '../../api/admin'
import type { Person, Task, TaskInput } from '../../api/admin'
import { ApiError } from '../../api/client'
import { ActionButton } from '../../components/ActionButton'
import { FormField } from '../../components/FormField'
import { Notice } from '../../components/Notice'

interface Props {
  taskId?: string
  api?: ReturnType<typeof createAdminApi>
  onSaved?: (task: Task) => void
  onCancel?: () => void
}
const defaultApi = createAdminApi()
const empty: TaskInput = { title: '', description: null, dueDate: null, assigneeId: null }
const back = () => { window.location.hash = '/tasks' }
const message = (error: unknown) => error instanceof Error ? error.message : 'İşlem gerçekleştirilemedi.'

export function TaskForm({ taskId, api = defaultApi, onSaved = back, onCancel = back }: Props) {
  const [values, setValues] = useState<TaskInput>(empty)
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const lock = useRef(false)
  const id = useId()

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(undefined)
    setErrors({})
    setSaveError(undefined)
    Promise.all([api.people.list(), taskId ? api.tasks.get(taskId) : Promise.resolve(null)])
      .then(([nextPeople, task]) => {
        if (!active) return
        setPeople(nextPeople.filter(person => person.isActive))
        setValues(task ? { title: task.title, description: task.description, dueDate: task.dueDate?.slice(0, 10) ?? null, assigneeId: task.assigneeId } : { ...empty })
      })
      .catch(error => { if (active) setLoadError(message(error)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, taskId, attempt])

  function change(field: keyof TaskInput, value: string) {
    setValues(current => ({ ...current, [field]: field === 'title' ? value : value || null }))
    setErrors(current => ({ ...current, [field]: '' }))
  }
  async function save() {
    if (lock.current) return
    const titleError = !values.title.trim() ? 'Başlık zorunludur.' : values.title.length > 120 ? 'Başlık en fazla 120 karakter olabilir.' : undefined
    setErrors(titleError ? { title: titleError } : {})
    setSaveError(undefined)
    if (titleError) return
    lock.current = true
    setSaving(true)
    try {
      const saved = taskId ? await api.tasks.update(taskId, values) : await api.tasks.create(values)
      onSaved(saved)
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        const fields: Record<string, string> = {}
        const other: string[] = []
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          const field = Object.keys(empty).find(name => name.toLowerCase() === key.replace(/^\$\./, '').toLowerCase())
          if (field) fields[field] = messages.join(' ')
          else other.push(messages.join(' '))
        }
        setErrors(fields)
        if (other.length || !Object.keys(fields).length) setSaveError(other.join(' ') || error.message)
      } else setSaveError(message(error))
    } finally { lock.current = false; setSaving(false) }
  }

  return <section aria-label="Görev formu">
    <h2>{taskId ? 'Görevi düzenle' : 'Yeni görev'}</h2>
    {loading ? <Notice>Form yükleniyor…</Notice> : loadError ? <Notice variant="error">{loadError} <ActionButton onClick={() => setAttempt(value => value + 1)}>Tekrar dene</ActionButton></Notice> :
      <form noValidate onSubmit={event => { event.preventDefault(); void save() }}>
        {saveError && <Notice variant="error">{saveError}</Notice>}
        <fieldset disabled={saving}>
          <legend>Görev bilgileri</legend>
          <FormField label="Başlık" required value={values.title} onChange={event => change('title', event.target.value)} error={errors.title} hint={`Kalan karakter: ${120 - values.title.length}`} />
          <div className="form-field">
            <label htmlFor={id + '-description'}>Açıklama</label>
            <textarea id={id + '-description'} value={values.description ?? ''} onChange={event => change('description', event.target.value)} aria-invalid={!!errors.description} aria-describedby={errors.description ? id + '-description-error' : undefined} />
            {errors.description && <p className="field-error" id={id + '-description-error'}>{errors.description}</p>}
          </div>
          <FormField label="Son tarih" type="date" value={values.dueDate ?? ''} onChange={event => change('dueDate', event.target.value)} error={errors.dueDate} />
          <div className="form-field">
            <label htmlFor={id + '-assignee'}>Atanan kişi</label>
            <select id={id + '-assignee'} value={values.assigneeId ?? ''} onChange={event => change('assigneeId', event.target.value)} aria-invalid={!!errors.assigneeId} aria-describedby={errors.assigneeId ? id + '-assignee-error' : undefined}>
              <option value="">Atanmamış</option>
              {people.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
            </select>
            {values.assigneeId && !people.some(person => person.id === values.assigneeId) && <p>Mevcut atanan kişi aktif değil. Aktif bir kişi veya Atanmamış seçebilirsiniz.</p>}
            {errors.assigneeId && <p className="field-error" id={id + '-assignee-error'}>{errors.assigneeId}</p>}
          </div>
          <ActionButton type="submit" pending={saving} pendingLabel="Kaydediliyor…">Kaydet</ActionButton>
          <ActionButton variant="secondary" onClick={onCancel}>Vazgeç</ActionButton>
        </fieldset>
      </form>}
    {(loading || loadError) && <ActionButton variant="secondary" onClick={onCancel}>Vazgeç</ActionButton>}
  </section>
}
export default TaskForm
