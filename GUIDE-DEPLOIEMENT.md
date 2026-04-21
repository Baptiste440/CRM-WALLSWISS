import { useState } from 'react'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { KpiCard, StatusBadge, CampChip, Alert, fDateTime } from '../components/UI'
import LeadDetail from '../components/LeadDetail'

export default function Today() {
  const { leads, isDormant, settings, userName, getCamp } = useData()
  const { profile } = useAuth()
  const [detailId, setDetailId] = useState(null)

  if (!profile) return null

  const myLeads = leads.filter(l => l.agent_id === profile.id)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()

  const newLeads = myLeads.filter(l => l.status_id === 'NEW')
  const recalls = myLeads.filter(l => l.recall_date && new Date(l.recall_date).getTime() <= Date.now() + 3600000 && new Date(l.recall_date).getTime() > todayTs - 86400000)
  const rdvToday = myLeads.filter(l => l.rdv_date && new Date(l.rdv_date).getTime() >= todayTs && new Date(l.rdv_date).getTime() < todayTs + 86400000)
  const dormant = myLeads.filter(isDormant)

  const msStart = new Date(); msStart.setDate(1); msStart.setHours(0, 0, 0, 0)
  const r1Month = myLeads.filter(l => ['r1', 'r1h'].includes(l.status_id) && new Date(l.created_at).getTime() >= msStart.getTime()).length
  const goal = profile.goal_r1 || parseInt(settings.goalR1) || 15

  const h = new Date().getHours()
  const greet = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{greet} {profile.prenom} —</div>
          <div className="page-sub">{new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      {dormant.length > 0 && (
        <Alert type="warning">
          <strong>{dormant.length} lead(s) dormant(s)</strong> sans activité depuis +{settings.dormantHours || 48}h
        </Alert>
      )}
      {rdvToday.length > 0 && (
        <Alert type="info">
          {rdvToday.length} RDV prévu{rdvToday.length > 1 ? 's' : ''} aujourd'hui
        </Alert>
      )}

      <div className="kpi-grid kpi-4" style={{ marginBottom: 20 }}>
        <KpiCard label="Mes leads" value={myLeads.length} sub="Total assignés" color="var(--purple)" />
        <KpiCard label="À traiter" value={newLeads.length + recalls.length} sub="NEW + rappels" color="var(--blue-l)" />
        <KpiCard label="R1 ce mois" value={r1Month} sub={`Objectif : ${goal}`} color="var(--green-l)" goal={goal} goalValue={r1Month} />
        <KpiCard label="Dormants" value={dormant.length} sub={`+${settings.dormantHours || 48}h sans activité`} color="var(--amber-l)" />
      </div>

      {/* NEW LEADS */}
      {newLeads.length > 0 && (
        <Section title={`Nouveaux leads (${newLeads.length})`} color="var(--purple)">
          {newLeads.map(l => <LeadRow key={l.id} lead={l} onClick={() => setDetailId(l.id)} />)}
        </Section>
      )}

      {/* RECALLS */}
      {recalls.length > 0 && (
        <Section title={`Rappels prévus (${recalls.length})`} color="var(--blue-l)">
          {recalls.map(l => (
            <LeadRow key={l.id} lead={l} onClick={() => setDetailId(l.id)}>
              <span style={{ fontSize: 10, color: 'var(--blue-l)', fontFamily: 'var(--mono)' }}>📅 {fDateTime(l.recall_date)}</span>
            </LeadRow>
          ))}
        </Section>
      )}

      {/* RDV TODAY */}
      {rdvToday.length > 0 && (
        <Section title={`RDV aujourd'hui (${rdvToday.length})`} color="var(--green-l)">
          {rdvToday.map(l => (
            <div key={l.id} className="lead-row" onClick={() => setDetailId(l.id)}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--blue-l)', minWidth: 55 }}>
                {l.rdv_date ? new Date(l.rdv_date).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
              <div style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>{l.prenom} {l.nom}</div>
              <CampChip campId={l.campaign_id} />
              <StatusBadge statusId={l.status_id} />
            </div>
          ))}
        </Section>
      )}

      {newLeads.length === 0 && recalls.length === 0 && rdvToday.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)', fontSize: 12 }}>
          ✓ Rien à traiter pour l'instant — bon travail !
        </div>
      )}

      {detailId && <LeadDetail leadId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

function Section({ title, color, children }) {
  return (
    <div className="today-section" style={{ '--section-color': color }}>
      <div className="section-title">{title}</div>
      {children}
    </div>
  )
}

function LeadRow({ lead, onClick, children }) {
  return (
    <div className="lead-row" onClick={onClick}>
      <div style={{ fontWeight: 600, fontSize: 12, minWidth: 130 }}>{lead.prenom} {lead.nom}</div>
      <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <CampChip campId={lead.campaign_id} />
        <StatusBadge statusId={lead.status_id} />
        {lead.canton && <span style={{ fontSize: 10, color: 'var(--t3)' }}>{lead.canton}</span>}
        {children}
      </div>
    </div>
  )
}
