import { useEffect, useRef, useState } from 'react'
import { createAdminApi } from '../../api/admin'
import type { Person } from '../../api/admin'
import { ApiError } from '../../api/client'
import { ActionButton } from '../../components/ActionButton'
import { FormField } from '../../components/FormField'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import './people.css'

type PeopleApi = Pick<ReturnType<typeof createAdminApi>, 'people'>
const defaultApi = createAdminApi()
const message = (error: unknown) => error instanceof Error ? error.message : 'İşlem gerçekleştirilemedi.'

export function PeopleScreen({ api = defaultApi }: { api?: PeopleApi }) {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | undefined>()
  const [fullName, setFullName] = useState('')
  const [editing, setEditing] = useState<Person | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [warning, setWarning] = useState<{ person: Person; count: number } | null>(null)
  const lock = useRef(false)
  const requestId = useRef(0)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const refreshRef = useRef<HTMLButtonElement>(null)

  async function load() {
    const id = ++requestId.current
    setLoading(true)
    setLoadError(null)
    try {
      const result = await api.people.list()
      if (id === requestId.current) setPeople(result)
    } catch (error) {
      if (id === requestId.current) setLoadError(message(error))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    return () => { requestId.current++ }
  }, [api])
  useEffect(() => {
    if (warning) cancelRef.current?.focus()
    else if (!busy && triggerRef.current) {
      if (triggerRef.current.isConnected && !triggerRef.current.disabled) triggerRef.current.focus()
      else refreshRef.current?.focus()
      triggerRef.current = null
    }
  }, [warning, busy])
  function resetForm() {
    setEditing(null)
    setFullName('')
    setNameError(undefined)
  }
  function replace(person: Person) {
    setPeople(current => current.map(item => item.id === person.id ? person : item))
  }
  async function save() {
    if (lock.current) return
    if (!fullName.trim()) { setNameError('Ad soyad zorunludur.'); return }
    lock.current = true
    setBusy(true)
    setError(null)
    setNameError(undefined)
    setSuccess(null)
    try {
      const input = { fullName: fullName.trim(), isActive: editing?.isActive ?? true }
      const person = editing ? await api.people.update(editing.id, input) : await api.people.create(input)
      if (editing) replace(person)
      else setPeople(current => [...current, person])
      setSuccess(editing ? 'Kişinin adı güncellendi.' : 'Kişi eklendi.')
      resetForm()
    } catch (error) {
      if (error instanceof ApiError) setNameError((error.fieldErrors.fullName ?? error.fieldErrors.FullName)?.join(' '))
      setError(message(error))
    } finally { lock.current = false; setBusy(false) }
  }
  async function deactivate(person: Person, confirm: boolean) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await api.people.deactivate(person.id, confirm)
      replace(updated)
      setWarning(null)
      setSuccess(`${updated.fullName} pasife alındı.`)
    } catch (error) {
      const count: unknown = error instanceof ApiError
        ? (error.problem as { openTaskCount?: unknown }).openTaskCount : undefined
      if (error instanceof ApiError && error.status === 409 && typeof count === 'number' && Number.isInteger(count) && count >= 0) {
        setWarning({ person, count })
      } else setError(message(error))
    } finally { lock.current = false; setBusy(false) }
  }
  const blocked = busy || loading || !!loadError || !!warning
  return <section className="people-screen" aria-label="Kişiler ekranı">
    <div className="people-toolbar">
      <h2>Kişiler</h2>
      <button ref={refreshRef} className="button button--secondary" disabled={busy || loading || !!warning} onClick={() => void load()}>Yenile</button>
    </div>
    {loading && <Notice>Kişiler yükleniyor…</Notice>}
    {loadError && <Notice variant="error">{loadError} <ActionButton onClick={() => void load()}>Tekrar dene</ActionButton></Notice>}
    {error && <Notice variant="error">{error}</Notice>}
    {success && <Notice variant="success">{success} <a href="#/tasks">Yeniden atamak için Görevler ekranına dön</a></Notice>}
    <form aria-label={editing ? 'Kişi adını düzelt' : 'Kişi ekle'} onSubmit={event => { event.preventDefault(); void save() }}>
      <h3>{editing ? 'Kişi adını düzelt' : 'Kişi ekle'}</h3>
      <FormField label="Ad soyad" value={fullName} error={nameError} disabled={blocked} onChange={event => setFullName(event.target.value)} />
      <ActionButton type="submit" disabled={blocked} pending={busy}>{editing ? 'Kaydet' : 'Ekle'}</ActionButton>
      {editing && <ActionButton variant="secondary" disabled={blocked} onClick={resetForm}>Vazgeç</ActionButton>}
    </form>
    {!loading && !loadError && (people.length === 0 ? <Notice>Henüz kişi yok.</Notice> : <ul className="people-list">
      {people.map(person => <li key={person.id}>
        <span>{person.fullName}</span>
        {person.isActive ? <span className="badge people-active">Aktif</span> : <StatusBadge status="inactive" />}
        <ActionButton variant="secondary" disabled={blocked} aria-label={`${person.fullName} adını düzelt`} onClick={() => {
          setEditing(person); setFullName(person.fullName); setNameError(undefined); setError(null); setSuccess(null)
        }}>Adını düzelt</ActionButton>
        {person.isActive && <ActionButton variant="danger" disabled={blocked || !!editing} aria-label={`${person.fullName} pasife al`} onClick={event => {
          triggerRef.current = event.currentTarget
          void deactivate(person, false)
        }}>Pasife al</ActionButton>}
      </li>)}
    </ul>)}
    {warning && <div className="people-warning" role="alertdialog" aria-labelledby="people-warning-title" aria-describedby="people-warning-description" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) { setWarning(null); setError(null) }
    }}>
      <h3 id="people-warning-title">Pasife alma onayı</h3>
      <p id="people-warning-description">{warning.person.fullName} için {warning.count} açık görev var. Devam ederseniz kişi Pasif olacak ve açık görevleri Atanmamış olacaktır. Tamamlanan görevlerde kişinin adı korunacaktır.</p>
      <button ref={cancelRef} className="button button--secondary" disabled={busy} onClick={() => { setWarning(null); setError(null) }}>Vazgeç</button>
      <ActionButton variant="danger" pending={busy} onClick={() => void deactivate(warning.person, true)}>Devam et</ActionButton>
    </div>}
  </section>
}
export default PeopleScreen
