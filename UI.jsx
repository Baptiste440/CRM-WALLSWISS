import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

const DataCtx = createContext(null)

export function DataProvider({ children }) {
  const { profile, isAdmin, isManager } = useAuth()
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [statuses, setStatuses] = useState([])
  const [quotas, setQuotas] = useState([])
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState('loading') // 'ok'|'error'|'loading'
  const [syncMsg, setSyncMsg] = useState('Chargement…')
  const realtimeRef = useRef(null)

  const sync = useCallback(async (silent = false) => {
    if (!silent) { setSyncStatus('loading'); setSyncMsg('Chargement…') }
    try {
      const [t, u, c, st, q, s] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('crm_users').select('*, teams(name,color)').order('prenom'),
        supabase.from('campaigns').select('*').order('name'),
        supabase.from('statuses').select('*').order('sort_order'),
        supabase.from('quotas').select('*'),
        supabase.from('settings').select('*'),
      ])
      setTeams(t.data || [])
      setUsers(u.data || [])
      setCampaigns(c.data || [])
      setStatuses((st.data || []).filter(s => !s.disabled))
      setQuotas(q.data || [])
      setSettings(Object.fromEntries((s.data || []).map(r => [r.key, r.value])))
      await loadLeads()
      setSyncStatus('ok')
      setSyncMsg('Sync actif — ' + new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setSyncStatus('error')
      setSyncMsg('Erreur connexion')
    } finally {
      setLoading(false)
    }
  }, [profile, isAdmin, isManager])

  async function loadLeads() {
    let q = supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (!isAdmin && !isManager && profile) q = q.eq('agent_id', profile.id)
    const { data } = await q
    setLeads(data || [])
  }

  // Realtime subscription
  useEffect(() => {
    if (!profile) return
    sync()

    const channel = supabase.channel('crm-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        loadLeads()
        setSyncMsg('Sync actif — ' + new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, () => sync(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => sync(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_users' }, () => sync(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => sync(true))
      .subscribe()

    realtimeRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  // Helpers
  const getStatus = id => statuses.find(s => s.id === id) || { id, label: id, color: '#64748b', phase: 'traitement' }
  const getUser = id => users.find(u => u.id === id)
  const getCamp = id => campaigns.find(c => c.id === id)
  const getTeam = id => teams.find(t => t.id === id)
  const userName = id => { const u = getUser(id); return u ? `${u.prenom} ${u.nom[0]}.` : '—' }
  const campName = id => { const c = getCamp(id); return c ? c.name : '—' }

  const isDormant = lead => {
    const closed = statuses.filter(s => s.phase === 'clos').map(s => s.id)
    if (closed.includes(lead.status_id)) return false
    const th = parseInt(settings.dormantHours) || 48
    return Math.floor((Date.now() - new Date(lead.last_activity).getTime()) / 3600000) >= th
  }

  // Dispatch
  const computeNext = campId => {
    const campQ = quotas.filter(q => q.campaign_id === campId)
    const active = users.filter(u => u.actif && ['agent', 'telephoniste'].includes(u.role))
    const elig = active.filter(u => (campQ.find(q => q.user_id === u.id)?.quota || 0) > 0)
    const pool = elig.length ? elig : active
    if (!pool.length) return null
    const totalQ = pool.reduce((a, u) => a + (campQ.find(q => q.user_id === u.id)?.quota || 0), 0) || 1
    const closedIds = statuses.filter(s => s.phase === 'clos').map(s => s.id)
    const activeLeads = leads.filter(l => !closedIds.includes(l.status_id))
    let best = null, bs = -Infinity
    pool.forEach(u => {
      const q = campQ.find(x => x.user_id === u.id)?.quota || 0
      const qw = q / totalQ
      const c = activeLeads.filter(l => l.agent_id === u.id).length
      const mc = Math.max(...pool.map(a => activeLeads.filter(l => l.agent_id === a.id).length), 1)
      const score = qw - (c / mc * 0.3)
      if (score > bs) { bs = score; best = u }
    })
    return best
  }

  // Lead ops
  async function createLead(data) {
    const camp = getCamp(data.campaign_id)
    const dup = leads.find(l => (data.tel && l.tel === data.tel) || (data.email && l.email === data.email))
    let agentId = data.agent_id
    if (!agentId) {
      const agent = dup ? getUser(dup.agent_id) : computeNext(data.campaign_id)
      agentId = agent?.id || null
    }
    const { data: lead, error } = await supabase.from('leads').insert({
      ...data, agent_id: agentId, status_id: 'NEW', last_activity: new Date().toISOString()
    }).select().single()
    if (error) throw error
    await supabase.from('lead_log').insert({ lead_id: lead.id, action: `Lead créé — assigné à ${userName(agentId)}${dup ? ' (doublon détecté)' : ''}`, user_name: profile?.prenom || 'Admin', user_id: profile?.id })
    return lead
  }

  async function updateLead(id, updates, logMsg) {
    const { error } = await supabase.from('leads').update({ ...updates, last_activity: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    if (logMsg) await supabase.from('lead_log').insert({ lead_id: id, action: logMsg, user_name: profile?.prenom || '—', user_id: profile?.id })
  }

  async function transferLeads(leadIds, toUserId) {
    const toUser = getUser(toUserId)
    await Promise.all(leadIds.map(async id => {
      await supabase.from('leads').update({ agent_id: toUserId, last_activity: new Date().toISOString() }).eq('id', id)
      await supabase.from('lead_log').insert({ lead_id: id, action: `Transféré vers ${toUser?.prenom} ${toUser?.nom}`, user_name: profile?.prenom || 'Admin', user_id: profile?.id })
    }))
  }

  async function logCall(leadId, duration) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    const callLog = Array.isArray(lead.call_log) ? [...lead.call_log] : []
    callLog.push({ ts: Date.now(), dur: duration, user: profile?.prenom || '—' })
    await supabase.from('leads').update({ call_log: callLog, last_activity: new Date().toISOString() }).eq('id', leadId)
    await supabase.from('lead_log').insert({ lead_id: leadId, action: `Appel — durée: ${Math.floor(duration / 60)}min${duration % 60}s`, user_name: profile?.prenom || '—', user_id: profile?.id })
  }

  async function upsertSetting(key, value) {
    await supabase.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' })
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  async function saveQuotas(newQuotas) {
    await Promise.all(newQuotas.map(r =>
      supabase.from('quotas').upsert(r, { onConflict: 'campaign_id,user_id' })
    ))
    const { data } = await supabase.from('quotas').select('*')
    setQuotas(data || [])
  }

  return (
    <DataCtx.Provider value={{
      leads, users, teams, campaigns, statuses, quotas, settings,
      loading, syncStatus, syncMsg, sync,
      getStatus, getUser, getCamp, getTeam, userName, campName, isDormant, computeNext,
      createLead, updateLead, transferLeads, logCall, upsertSetting, saveQuotas,
      loadLeads, profile
    }}>
      {children}
    </DataCtx.Provider>
  )
}

export const useData = () => useContext(DataCtx)
