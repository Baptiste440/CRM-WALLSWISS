import { useData } from '../lib/DataContext'

// ─── FORMAT HELPERS ───────────────────────────────────────────
export const fDate = ts => ts ? new Date(ts).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
export const fDateTime = ts => ts ? new Date(ts).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
export const fDOB = d => d ? new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
export const hAgo = ts => Math.floor((Date.now() - new Date(ts).getTime()) / 3600000)

// ─── STATUS BADGE ─────────────────────────────────────────────
export function StatusBadge({ statusId }) {
  const { getStatus } = useData()
  const s = getStatus(statusId)
  return (
    <span className="sbadge" style={{ color: s.color, borderColor: s.color + '30', background: s.color + '18' }}>
      {s.label}
    </span>
  )
}

// ─── CAMPAIGN CHIP ────────────────────────────────────────────
export function CampChip({ campId }) {
  const { getCamp } = useData()
  const c = getCamp(campId)
  if (!c) return <span style={{ color: 'var(--t3)', fontSize: 10 }}>—</span>
  return (
    <span className="chip" style={{ color: c.color, borderColor: c.color + '40', background: c.color + '12' }}>
      {c.code}
    </span>
  )
}

// ─── ROLE BADGE ───────────────────────────────────────────────
export function RoleBadge({ role }) {
  const map = { admin: 'rb-admin', manager: 'rb-manager', agent: 'rb-agent', telephoniste: 'rb-telephoniste' }
  const labels = { admin: 'ADMIN', manager: 'MANAGER', agent: 'AGENT', telephoniste: 'TÉLÉPHONISTE' }
  return <span className={`role-badge ${map[role] || 'rb-agent'}`}>{labels[role] || role.toUpperCase()}</span>
}

// ─── AVATAR ───────────────────────────────────────────────────
export function Avatar({ user, size = '' }) {
  if (!user) return null
  return (
    <div className={`avatar ${size}`} style={{ background: user.color || '#3b82f6' }}>
      {user.prenom?.[0] || '?'}
    </div>
  )
}

// ─── KPI CARD ─────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color = 'var(--blue)', goal, goalValue }) {
  const pct = goal ? Math.min(100, Math.round((goalValue || 0) / goal * 100)) : null
  const gColor = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--blue)' : 'var(--amber)'
  return (
    <div className="kpi" style={{ '--kc': color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {goal && <div className="goal-bar"><div className="goal-fill" style={{ width: pct + '%', background: gColor }} /></div>}
    </div>
  )
}

// ─── ALERT ────────────────────────────────────────────────────
export function Alert({ type = 'info', children, onAction, actionLabel }) {
  const cls = { info: 'alert-info', warning: 'alert-warning', success: 'alert-success', error: 'alert-error' }
  return (
    <div className={`alert ${cls[type]}`}>
      {children}
      {onAction && <span style={{ marginLeft: 6, cursor: 'pointer', textDecoration: 'underline' }} onClick={onAction}>{actionLabel}</span>}
    </div>
  )
}

// ─── MODAL ────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal-box${wide ? ' wide' : ''}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ─── TABS ─────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.id} className={`tab-btn${active === t.id ? ' active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── BAR CHART ROW ────────────────────────────────────────────
export function BarRow({ label, value, max, color, showPct = false }) {
  const pct = max ? Math.round(value / max * 100) : 0
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%', background: color || 'var(--blue)' }} /></div>
      <div className="bar-value">{showPct ? pct + '%' : value}</div>
    </div>
  )
}

// ─── TOGGLE ───────────────────────────────────────────────────
export function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-wrap">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  )
}

// ─── FORM FIELDS ──────────────────────────────────────────────
export function Field({ label, children, full }) {
  return (
    <div className={`form-group${full ? ' full' : ''}`}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

// ─── LOADING ──────────────────────────────────────────────────
export function Loading({ text = 'Chargement…' }) {
  return (
    <div className="loading-page">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────
export function Empty({ text = 'Aucun résultat' }) {
  return <tr><td colSpan={20} style={{ textAlign: 'center', padding: 28, color: 'var(--t3)' }}>{text}</td></tr>
}
