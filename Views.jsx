import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useData } from '../lib/DataContext'
import Today from '../pages/Today'
import LeadsPage from '../pages/Leads'
import { Dashboard, Pipeline, Dormant, RDV } from '../pages/Views'
import { Stats, Dispatch, Campaigns, Teams } from '../pages/Management'
import Params from '../pages/Params'

const ICONS = {
  today: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 2v3M11 2v3M2 7h12"/></svg>,
  leads: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg>,
  rdv: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2M11 2v2M2 7h12"/><circle cx="8" cy="10" r="1.5"/></svg>,
  dashboard: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
  alllead: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><path d="M2 4h12M2 8h10M2 12h8"/></svg>,
  pipeline: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><rect x="1" y="3" width="3" height="10" rx="1"/><rect x="6" y="1" width="3" height="12" rx="1"/><rect x="11" y="5" width="3" height="8" rx="1"/></svg>,
  dormant: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 4v4l3 2"/></svg>,
  dispatch: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><path d="M2 8h12M8 2l6 6-6 6"/></svg>,
  camps: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><path d="M2 4h12v8H2z"/><path d="M2 7h12M5 4v8"/></svg>,
  teams: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><circle cx="5" cy="5" r="3"/><circle cx="11" cy="5" r="3"/><path d="M1 14c0-2.5 1.8-4 4-4M11 14c2 0 4-1.5 4-4"/></svg>,
  stats: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><path d="M2 12l3-4 3 2 3-5 3 3"/></svg>,
  params: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></svg>,
}

export default function App() {
  const { profile, signOut, isAdmin, isManager } = useAuth()
  const { leads, statuses, isDormant, syncStatus, syncMsg } = useData()
  const [page, setPage] = useState('today')
  const [clock, setClock] = useState('')

  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setClock(n.toLocaleString('fr-CH', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [])

  const myLeads = leads.filter(l => l.agent_id === profile?.id)
  const dormCount = isAdmin || isManager ? leads.filter(isDormant).length : myLeads.filter(isDormant).length
  const newCount = isAdmin || isManager ? leads.filter(l => l.status_id === 'NEW').length : myLeads.filter(l => l.status_id === 'NEW').length
  const rdvCount = (isAdmin || isManager ? leads : myLeads).filter(l => ['r1', 'r1h', 'r1nh'].includes(l.status_id)).length

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const myRecalls = myLeads.filter(l => l.recall_date && new Date(l.recall_date).getTime() <= Date.now() + 3600000 && new Date(l.recall_date).getTime() > today.getTime() - 86400000)
  const todayCount = myLeads.filter(l => l.status_id === 'NEW').length + myRecalls.length

  const roleClass = { admin: 'rb-admin', manager: 'rb-manager', agent: 'rb-agent', telephoniste: 'rb-telephoniste' }
  const roleLabel = { admin: 'ADMIN', manager: 'MANAGER', agent: 'AGENT', telephoniste: 'TÉL.' }

  const syncClass = syncStatus === 'ok' ? 'sync-ok' : syncStatus === 'error' ? 'sync-err' : 'sync-load'

  function NavItem({ id, label, badge, badgeType = 'nc-a' }) {
    return (
      <div className={`nav-item${page === id ? ' active' : ''}`} onClick={() => setPage(id)}>
        {ICONS[id] || ICONS.params}
        <span>{label}</span>
        {badge > 0 && <span className={`nav-count ${badgeType}`}>{badge}</span>}
      </div>
    )
  }

  const PAGE_MAP = {
    today: <Today />,
    'mes-leads': <LeadsPage mode="mes" />,
    rdv: <RDV />,
    dashboard: <Dashboard />,
    'all-leads': <LeadsPage mode="all" />,
    pipeline: <Pipeline />,
    dormant: <Dormant />,
    dispatch: <Dispatch />,
    campaigns: <Campaigns />,
    teams: <Teams />,
    stats: <Stats />,
    params: <Params />,
  }

  return (
    <div className="shell">
      {/* TOPBAR */}
      <header className="topbar">
        <div className="logo">Patrimoine<em>CRM</em> <small>v3</small></div>
        <div style={{ marginLeft: 12, display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage('mes-leads')}>+ Lead</button>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div className={`sync-pill ${syncClass}`}>
            <div className="sync-dot" />
            <span>{syncMsg}</span>
            {dormCount > 0 && <span style={{ marginLeft: 8, background: 'rgba(245,158,11,.2)', padding: '0 5px', borderRadius: 4 }}>⚠ {dormCount} dormant{dormCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--t3)' }}>{clock}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: '4px 10px', cursor: 'pointer' }} onClick={signOut} title="Déconnexion">
            <div className="avatar" style={{ background: profile?.color || '#3b82f6' }}>{profile?.prenom?.[0]}</div>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{profile?.prenom}</span>
            <span className={`role-badge ${roleClass[profile?.role] || 'rb-agent'}`}>{roleLabel[profile?.role] || profile?.role?.toUpperCase()}</span>
            <span style={{ fontSize: 9, color: 'var(--t3)' }}>↩</span>
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <nav className="sidebar">
        <div className="nav-sec">
          <div className="nav-lbl">Mon espace</div>
          <NavItem id="today" label="Aujourd'hui" badge={todayCount} badgeType="nc-r" />
          <NavItem id="mes-leads" label="Mes leads" badge={myLeads.filter(l => l.status_id === 'NEW').length} badgeType="nc-a" />
          <NavItem id="rdv" label="RDV" badge={myLeads.filter(l => ['r1', 'r1h', 'r1nh'].includes(l.status_id)).length} badgeType="nc-g" />
        </div>

        {(isAdmin || isManager) && <>
          <div className="nav-sec">
            <div className="nav-lbl">Vue globale</div>
            <NavItem id="dashboard" label="Dashboard" />
            <NavItem id="all-leads" label="Tous les leads" badge={newCount} badgeType="nc-a" />
            <NavItem id="pipeline" label="Pipeline" />
            <NavItem id="dormant" label="Dormance" badge={dormCount} badgeType="nc-r" />
          </div>
          <div className="nav-sec">
            <div className="nav-lbl">Gestion</div>
            <NavItem id="dispatch" label="Dispatch" />
            <NavItem id="campaigns" label="Campagnes" />
            <NavItem id="teams" label="Équipes" />
            <NavItem id="stats" label="Statistiques" />
          </div>
        </>}

        <div className="nav-sec">
          <div className="nav-lbl">Système</div>
          <NavItem id="params" label="Paramètres" />
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-clock">{clock}</div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {PAGE_MAP[page] || <Dashboard />}
      </main>
    </div>
  )
}
