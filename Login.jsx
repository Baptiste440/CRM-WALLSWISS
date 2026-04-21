import { useState, useMemo } from 'react'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { StatusBadge, CampChip, Modal, Field, Empty, fDateTime, fDOB } from '../components/UI'
import LeadDetail from '../components/LeadDetail'

function AddLeadModal({ open, onClose }) {
  const { campaigns, users, createLead, computeNext } = useData()
  const { profile } = useAuth()
  const [form, setForm] = useState({ prenom: '', nom: '', tel: '', email: '', dob: '', canton: '', sitpro: '', campaign_id: '', agent_id: '', recall_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleAdd() {
    if (!form.prenom || !form.nom || !form.tel) { setError('Prénom, nom et téléphone requis.'); return }
    setSaving(true)
    try {
      await createLead({ ...form, dob: form.dob || null, email: form.email || null, canton: form.canton || null, sitpro: form.sitpro || null, recall_date: form.recall_date ? new Date(form.recall_date).toISOString() : null, extra: {} })
      onClose()
      setForm({ prenom: '', nom: '', tel: '', email: '', dob: '', canton: '', sitpro: '', campaign_id: '', agent_id: '', recall_date: '', notes: '' })
      setError('')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const { isAdmin, isManager } = useAuth()

  return (
    <Modal open={open} onClose={onClose} title="Nouveau lead"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Création…' : 'Créer le lead'}</button></>}
    >
      {error && <div style={{ color: 'var(--red-l)', fontSize: 11, marginBottom: 10 }}>{error}</div>}
      <div className="form-grid">
        <Field label="Prénom *"><input className="form-input" value={form.prenom} onChange={set('prenom')} placeholder="Jean" /></Field>
        <Field label="Nom *"><input className="form-input" value={form.nom} onChange={set('nom')} placeholder="Dupont" /></Field>
        <Field label="Téléphone *"><input className="form-input" value={form.tel} onChange={set('tel')} placeholder="+41 79 000 00 00" /></Field>
        <Field label="Email"><input className="form-input" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Date de naissance"><input className="form-input" type="date" value={form.dob} onChange={set('dob')} /></Field>
        <Field label="Canton / Pays"><input className="form-input" value={form.canton} onChange={set('canton')} placeholder="GE" /></Field>
        <Field label="Situation professionnelle">
          <select className="form-select" value={form.sitpro} onChange={set('sitpro')}>
            <option value="">—</option>
            {['Salarié','Indépendant','Dirigeant','Professions libérales','Retraité','Fonctionnaire'].map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Campagne source">
          <select className="form-select" value={form.campaign_id} onChange={set('campaign_id')}>
            <option value="">— Sélectionner</option>
            {campaigns.filter(c => c.actif).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {(isAdmin || isManager) && (
          <Field label="Assigner à">
            <select className="form-select" value={form.agent_id} onChange={set('agent_id')}>
              <option value="">Auto-dispatch</option>
              {users.filter(u => u.actif && ['agent','telephoniste'].includes(u.role)).map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </Field>
        )}
        <Field label="Rappel prévu"><input className="form-input" type="datetime-local" value={form.recall_date} onChange={set('recall_date')} /></Field>
        <Field label="Notes initiales" full><textarea className="form-textarea" value={form.notes} onChange={set('notes')} placeholder="Contexte, projet patrimonial…" /></Field>
      </div>
    </Modal>
  )
}

function TransferModal({ open, onClose, leads: allLeads }) {
  const { users, transferLeads, userName } = useData()
  const [toUser, setToUser] = useState('')
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)
  const toggle = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  async function handleTransfer() {
    if (!toUser || !selected.length) return
    setSaving(true)
    await transferLeads(selected, toUser)
    setSaving(false)
    onClose()
    setSelected([])
  }

  return (
    <Modal open={open} onClose={onClose} title="Transférer des leads"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={handleTransfer} disabled={saving || !selected.length || !toUser}>{saving ? 'Transfert…' : `Transférer ${selected.length > 0 ? `(${selected.length})` : ''}`}</button></>}
    >
      <div className="alert alert-warning" style={{ marginBottom: 12 }}>Historique conservé — aucune perte d'information.</div>
      <Field label="Transférer vers">
        <select className="form-select" value={toUser} onChange={e => setToUser(e.target.value)}>
          <option value="">— Sélectionner</option>
          {users.filter(u => u.actif && u.role !== 'admin').map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role})</option>)}
        </select>
      </Field>
      <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto' }}>
        {allLeads.slice(0, 40).map(l => (
          <div key={l.id} onClick={() => toggle(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r)', border: '1px solid var(--b1)', background: selected.includes(l.id) ? 'var(--blue-bg)' : 'var(--s2)', marginBottom: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} style={{ width: 13, height: 13, accentColor: 'var(--blue)' }} onClick={e => e.stopPropagation()} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{l.prenom} {l.nom}</div>
              <div style={{ fontSize: 9, color: 'var(--t3)', display: 'flex', gap: 5 }}>
                <CampChip campId={l.campaign_id} /> → {userName(l.agent_id)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default function LeadsPage({ mode = 'all' }) {
  const { leads, users, teams, campaigns, statuses, isDormant, userName, hAgo, createLead } = useData()
  const { profile, isAdmin, isManager } = useAuth()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCamp, setFilterCamp] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)

  const myLeads = mode === 'mes' ? leads.filter(l => l.agent_id === profile?.id) : leads

  const filtered = useMemo(() => {
    let list = myLeads
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(l => (l.prenom + ' ' + l.nom + (l.tel || '') + (l.email || '')).toLowerCase().includes(q))
    }
    if (filterStatus) list = list.filter(l => l.status_id === filterStatus)
    if (filterCamp) list = list.filter(l => l.campaign_id === filterCamp)
    if (filterUser && mode === 'all') list = list.filter(l => l.agent_id === filterUser)
    if (filterTeam && mode === 'all') {
      const tUsers = users.filter(u => u.team_id === filterTeam).map(u => u.id)
      list = list.filter(l => tUsers.includes(l.agent_id))
    }
    return list
  }, [myLeads, search, filterStatus, filterCamp, filterUser, filterTeam])

  async function exportCSV() {
    const h = 'Prénom,Nom,Téléphone,Email,Date naissance,Canton,Sit.pro,Campagne,Statut,Utilisateur,Date entrée,Date RDV\n'
    const rows = filtered.map(l => [l.prenom, l.nom, l.tel || '', l.email || '', l.dob || '', l.canton || '', l.sitpro || '', campaigns.find(c => c.id === l.campaign_id)?.name || '', statuses.find(s => s.id === l.status_id)?.label || l.status_id, userName(l.agent_id), l.created_at ? new Date(l.created_at).toLocaleDateString('fr-CH') : '', l.rdv_date ? fDateTime(l.rdv_date) : ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h + rows], { type: 'text/csv;charset=utf-8;' })); a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  const dormantCount = filtered.filter(isDormant).length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{mode === 'mes' ? 'Mes leads' : 'Tous les leads'}</div>
          <div className="page-sub">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}{mode === 'mes' ? ' assignés' : ' — base globale admin'}{dormantCount > 0 ? ` · ⚠ ${dormantCount} dormant(s)` : ''}</div>
        </div>
        <div className="page-actions">
          {(isAdmin || isManager) && mode === 'all' && <button className="btn btn-warning btn-sm" onClick={() => setTransferOpen(true)}>⇄ Transférer</button>}
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ Nouveau lead</button>
        </div>
      </div>

      <div className="filter-bar">
        <input className="filter-input" placeholder="Nom, téléphone, email…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="filter-select" value={filterCamp} onChange={e => setFilterCamp(e.target.value)}>
          <option value="">Toutes campagnes</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {mode === 'all' && (isAdmin || isManager) && <>
          <select className="filter-select" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">Tous utilisateurs</option>
            {users.filter(u => u.actif).map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
          </select>
          <select className="filter-select" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
            <option value="">Toutes équipes</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </>}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Téléphone</th>
                <th>Né le</th>
                <th>Campagne</th>
                <th>Statut</th>
                {mode === 'all' && <th>Utilisateur</th>}
                {mode === 'all' && (isAdmin || isManager) && <th>Équipe</th>}
                <th>Activité</th>
                <th>RDV</th>
                <th>Dormance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <Empty text="Aucun lead trouvé" />}
              {filtered.map(l => {
                const dorm = isDormant(l)
                const u = users.find(x => x.id === l.agent_id)
                const team = u ? teams.find(t => t.id === u.team_id) : null
                return (
                  <tr key={l.id} className={`clickable${dorm ? ' row-dormant' : ''}`} onClick={() => setDetailId(l.id)}>
                    <td>
                      <strong>{l.prenom} {l.nom}</strong>
                      {dorm && <span style={{ fontSize: 8, color: 'var(--amber-l)', marginLeft: 5, fontWeight: 700 }}>⚠</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{l.tel || '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{fDOB(l.dob)}</td>
                    <td><CampChip campId={l.campaign_id} /></td>
                    <td><StatusBadge statusId={l.status_id} /></td>
                    {mode === 'all' && <td style={{ fontSize: 11 }}>{userName(l.agent_id)}</td>}
                    {mode === 'all' && (isAdmin || isManager) && (
                      <td>{team ? <span style={{ fontSize: 9, color: team.color, fontWeight: 700 }}>{team.name}</span> : '—'}</td>
                    )}
                    <td style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--t2)' }}>{fDateTime(l.last_activity)}</td>
                    <td style={{ fontSize: 10, color: 'var(--blue-l)' }}>{l.rdv_date ? fDateTime(l.rdv_date) : '—'}</td>
                    <td>{dorm ? <span style={{ fontSize: 10, color: 'var(--amber-l)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{Math.floor((Date.now() - new Date(l.last_activity).getTime()) / 3600000)}h</span> : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-xs" onClick={() => setDetailId(l.id)}>Ouvrir</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && <LeadDetail leadId={detailId} onClose={() => setDetailId(null)} />}
      {addOpen && <AddLeadModal open onClose={() => setAddOpen(false)} />}
      {transferOpen && <TransferModal open leads={filtered} onClose={() => setTransferOpen(false)} />}
    </div>
  )
}
