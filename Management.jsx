import { useEffect, useState } from 'react'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { Modal, Tabs, StatusBadge, CampChip, Field, fDateTime, fDOB } from './UI'

export default function LeadDetail({ leadId, onClose }) {
  const { leads, users, statuses, campaigns, getStatus, getCamp, getUser, userName, updateLead } = useData()
  const { profile, isAdmin, isManager } = useAuth()
  const [tab, setTab] = useState('info')
  const [log, setLog] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [callTimer, setCallTimer] = useState(null)
  const [callSeconds, setCallSeconds] = useState(0)
  const [calling, setCalling] = useState(false)
  const [callStart, setCallStart] = useState(null)
  const { logCall } = useData()

  const lead = leads.find(l => l.id === leadId)

  useEffect(() => {
    if (!lead) return
    setForm({
      prenom: lead.prenom || '', nom: lead.nom || '', tel: lead.tel || '',
      email: lead.email || '', dob: lead.dob || '', canton: lead.canton || '',
      sitpro: lead.sitpro || '', status_id: lead.status_id || 'NEW',
      agent_id: lead.agent_id || '', notes: lead.notes || '',
      rdv_date: lead.rdv_date ? new Date(lead.rdv_date).toISOString().slice(0, 16) : '',
      recall_date: lead.recall_date ? new Date(lead.recall_date).toISOString().slice(0, 16) : '',
    })
    loadLog()
  }, [leadId, leads])

  useEffect(() => {
    if (calling) {
      const t = setInterval(() => setCallSeconds(s => s + 1), 1000)
      setCallTimer(t)
      return () => clearInterval(t)
    } else {
      if (callTimer) { clearInterval(callTimer); setCallTimer(null) }
      setCallSeconds(0)
    }
  }, [calling])

  async function loadLog() {
    const { data } = await supabase.from('lead_log').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50)
    setLog(data || [])
  }

  async function handleSave() {
    setSaving(true)
    const updates = {
      prenom: form.prenom, nom: form.nom, tel: form.tel || null, email: form.email || null,
      dob: form.dob || null, canton: form.canton || null, sitpro: form.sitpro || null,
      status_id: form.status_id, agent_id: form.agent_id || null, notes: form.notes || null,
      rdv_date: form.rdv_date ? new Date(form.rdv_date).toISOString() : null,
      recall_date: form.recall_date ? new Date(form.recall_date).toISOString() : null,
    }
    await updateLead(leadId, updates, `Modifié: ${Object.keys(updates).join(', ')}`)
    setSaving(false)
    onClose()
  }

  async function handleCallToggle() {
    if (calling) {
      setCalling(false)
      await logCall(leadId, callSeconds)
      await loadLog()
    } else {
      setCalling(true)
      setCallStart(Date.now())
    }
  }

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const camp = getCamp(lead?.campaign_id)
  const canEdit = isAdmin || isManager || lead?.agent_id === profile?.id

  if (!lead) return null

  const TABS = [
    { id: 'info', label: 'Informations' },
    { id: 'status', label: 'Statut & Notes' },
    { id: 'rdv', label: 'RDV & Rappels' },
    { id: 'log', label: 'Historique' },
  ]

  return (
    <Modal open title={<><span>{lead.prenom} {lead.nom}</span> <StatusBadge statusId={lead.status_id} /></>} onClose={onClose} wide
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        {canEdit && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>}
      </>}
    >
      {/* CALL BUTTON */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 16px', borderBottom: '1px solid var(--b1)', marginBottom: 16 }}>
        <button className={`call-btn${calling ? ' active' : ''}`} onClick={handleCallToggle}>
          {calling ? '⏹ Raccrocher' : '📞 Appeler'}
        </button>
        <span className={`call-timer${calling ? ' running' : ''}`}>{fmt(callSeconds)}</span>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t2)' }}>
          {camp && <CampChip campId={lead.campaign_id} />}
          <span style={{ marginLeft: 6 }}>{camp?.name}</span>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'info' && (
        <div className="form-grid">
          <Field label="Prénom"><input className="form-input" value={form.prenom} onChange={e => setForm(p => ({ ...p, prenom: e.target.value }))} disabled={!canEdit} /></Field>
          <Field label="Nom"><input className="form-input" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} disabled={!canEdit} /></Field>
          <Field label="Téléphone"><input className="form-input" value={form.tel} onChange={e => setForm(p => ({ ...p, tel: e.target.value }))} disabled={!canEdit} /></Field>
          <Field label="Email"><input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={!canEdit} /></Field>
          <Field label="Date de naissance"><input className="form-input" type="date" value={form.dob} onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} disabled={!canEdit} /></Field>
          <Field label="Canton / Pays"><input className="form-input" value={form.canton} onChange={e => setForm(p => ({ ...p, canton: e.target.value }))} disabled={!canEdit} /></Field>
          <Field label="Situation professionnelle">
            <select className="form-select" value={form.sitpro} onChange={e => setForm(p => ({ ...p, sitpro: e.target.value }))} disabled={!canEdit}>
              <option value="">—</option>
              {['Salarié','Indépendant','Dirigeant','Professions libérales','Retraité','Fonctionnaire'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Campagne"><div style={{ paddingTop: 6, fontSize: 12 }}><CampChip campId={lead.campaign_id} /> {camp?.name}</div></Field>
          {/* Extra fields from campaign mapping */}
          {camp && Object.entries(camp.mapping || {}).filter(([k]) => k.startsWith('extra')).map(([k, lbl]) => (
            <Field key={k} label={lbl}><input className="form-input" defaultValue={(lead.extra || {})[k] || ''} disabled={!canEdit} /></Field>
          ))}
        </div>
      )}

      {tab === 'status' && (
        <div className="form-grid">
          <Field label="Statut">
            <select className="form-select" value={form.status_id} onChange={e => setForm(p => ({ ...p, status_id: e.target.value }))} disabled={!canEdit}>
              {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          {(isAdmin || isManager) && (
            <Field label="Utilisateur assigné">
              <select className="form-select" value={form.agent_id} onChange={e => setForm(p => ({ ...p, agent_id: e.target.value }))}>
                <option value="">—</option>
                {users.filter(u => u.actif).map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role})</option>)}
              </select>
            </Field>
          )}
          <Field label="Notes" full>
            <textarea className="form-textarea" style={{ minHeight: 120 }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} disabled={!canEdit} placeholder="Contexte, infos importantes…" />
          </Field>
        </div>
      )}

      {tab === 'rdv' && (
        <div className="form-grid">
          <Field label="Rappel planifié">
            <input className="form-input" type="datetime-local" value={form.recall_date} onChange={e => setForm(p => ({ ...p, recall_date: e.target.value }))} disabled={!canEdit} />
          </Field>
          <Field label="Date RDV (R1)">
            <input className="form-input" type="datetime-local" value={form.rdv_date} onChange={e => setForm(p => ({ ...p, rdv_date: e.target.value }))} disabled={!canEdit} />
          </Field>
          <Field label="Historique des appels" full>
            <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 10, maxHeight: 160, overflowY: 'auto' }}>
              {(lead.call_log || []).length === 0
                ? <span style={{ fontSize: 10, color: 'var(--t3)' }}>Aucun appel enregistré</span>
                : [...(lead.call_log || [])].reverse().map((c, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--t2)', padding: '3px 0', borderBottom: '1px solid var(--b1)', fontFamily: 'var(--mono)' }}>
                    {fDateTime(c.ts)} — {Math.floor(c.dur / 60)}min{c.dur % 60}s — {c.user}
                  </div>
                ))
              }
            </div>
          </Field>
        </div>
      )}

      {tab === 'log' && (
        <div>
          {log.length === 0
            ? <div style={{ color: 'var(--t3)', fontSize: 11, textAlign: 'center', padding: 20 }}>Aucun historique</div>
            : log.map(e => (
              <div key={e.id} className="log-entry">
                <div className="log-dot" style={{ background: 'var(--blue)' }} />
                <div>
                  <div className="log-text">{e.action}</div>
                  <div className="log-time">{fDateTime(e.created_at)} — {e.user_name || '—'}</div>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </Modal>
  )
}
