import { useState } from 'react'
import { useData } from '../lib/DataContext'
import { supabase } from '../lib/supabase'
import { Toggle, Modal, Field, Alert } from '../components/UI'

export default function Params() {
  const { statuses, settings, upsertSetting } = useData()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ label: '', color: '#8b5cf6', phase: 'traitement', description: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const phases = { entrant: 'Entrant', traitement: 'Traitement', rdv: 'RDV', clos: 'Clos' }
  const phaseColors = { entrant: '#8b5cf6', traitement: '#f59e0b', rdv: '#3b82f6', clos: '#64748b' }
  const grouped = {}
  statuses.forEach(s => { if (!grouped[s.phase]) grouped[s.phase] = []; grouped[s.phase].push(s) })

  async function handleAdd() {
    if (!form.label) return
    setSaving(true)
    await supabase.from('statuses').insert({
      id: 'st_' + Date.now(),
      label: form.label, color: form.color,
      phase: form.phase, sort_order: statuses.length,
      description: form.description || null
    })
    setSaving(false)
    setAddOpen(false)
    setForm({ label: '', color: '#8b5cf6', phase: 'traitement', description: '' })
  }

  async function toggleStatus(id, disabled) {
    await supabase.from('statuses').update({ disabled: !disabled }).eq('id', id)
  }

  async function deleteStatus(id) {
    if (!confirm('Supprimer ce statut ?')) return
    await supabase.from('statuses').delete().eq('id', id)
  }

  const LOCKED = ['NEW', 'r1', 'r1h', 'r1nh']

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Paramètres système</div><div className="page-sub">Configuration complète — sans toucher au code, synchronisé Supabase en temps réel</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          {/* STATUSES */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <span className="card-title">Statuts des leads</span>
              <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ Statut</button>
            </div>
            <div className="card-body">
              {Object.entries(phases).map(([ph, label]) => {
                const sts = (grouped[ph] || []).sort((a, b) => a.sort_order - b.sort_order)
                if (!sts.length) return null
                return (
                  <div key={ph} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: phaseColors[ph], letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                    {sts.map(s => (
                      <div key={s.id} className="status-item" style={{ opacity: s.disabled ? .45 : 1 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</div>
                          {s.description && <div style={{ fontSize: 9, color: 'var(--t3)' }}>{s.description}</div>}
                        </div>
                        <Toggle checked={!s.disabled} onChange={() => toggleStatus(s.id, s.disabled)} />
                        {!LOCKED.includes(s.id) && (
                          <button className="btn btn-danger btn-xs" onClick={() => deleteStatus(s.id)}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* DORMANCE */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header"><span className="card-title">Seuil dormance</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Heures sans activité avant alerte</label>
                <input className="form-input" type="number" defaultValue={settings.dormantHours || 48} min={1} max={720}
                  onBlur={e => upsertSetting('dormantHours', e.target.value)} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6 }}>La modification est immédiate et synchronisée pour tous les utilisateurs.</div>
            </div>
          </div>
        </div>

        <div>
          {/* OBJECTIFS */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header"><span className="card-title">Objectifs mensuels par défaut</span></div>
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">R1 fixés / utilisateur / mois</label>
                <input className="form-input" type="number" defaultValue={settings.goalR1 || 15}
                  onBlur={e => upsertSetting('goalR1', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Leads traités / jour (indicatif)</label>
                <input className="form-input" type="number" defaultValue={settings.goalDay || 20}
                  onBlur={e => upsertSetting('goalDay', e.target.value)} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6 }}>Les objectifs individuels sont définis dans la fiche de chaque utilisateur (page Équipes).</div>
            </div>
          </div>

          {/* SUPABASE STATUS */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header"><span className="card-title">Connexion Supabase</span></div>
            <div className="card-body">
              <Alert type="success">Connecté à <span style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>tovjqpimnkrixcygeiyj</span></Alert>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 10 }}>
                Temps réel activé — les modifications d'un utilisateur sont visibles instantanément par tous les autres.
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                RLS actuellement désactivé. Pour activer l'isolation par rôle en production, exécutez le script RLS fourni dans Supabase SQL Editor.
              </div>
            </div>
          </div>

          {/* APPS SCRIPT */}
          <div className="card">
            <div className="card-header"><span className="card-title">Script Google Apps Script (ingestion auto)</span></div>
            <div className="card-body">
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 10 }}>
                Collez ce script dans chaque Google Sheet partenaire (Extensions → Apps Script) en remplaçant CAMPAIGN_ID par l'ID Supabase de la campagne correspondante.
              </div>
              <div style={{ background: 'var(--s2)', borderRadius: 'var(--r)', padding: 10, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--green-l)', lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre' }}>
{`function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const row = e.range.getRow();
  if (row < 2) return;
  
  const data = sheet
    .getRange(row, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  const hdrs = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  
  const payload = { campaign_id: 'CAMPAIGN_ID' };
  hdrs.forEach((h, i) => { payload[h] = data[i]; });
  
  UrlFetchApp.fetch(
    'https://tovjqpimnkrixcygeiyj.supabase.co'
    + '/rest/v1/rpc/ingest_lead',
    {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        p_prenom: payload['Prénom'] || '',
        p_nom: payload['Nom'] || '',
        p_tel: payload['Numéro de tel'] || '',
        p_email: payload['Adresse email'] || null,
        p_canton: payload['Canton'] || null,
        p_campaign_id: 'CAMPAIGN_ID',
        p_extra: payload
      }),
      headers: {
        'apikey': 'VOTRE_CLE_ANON',
        'Authorization': 'Bearer VOTRE_CLE_ANON'
      }
    }
  );
}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nouveau statut"
        footer={<><button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Annuler</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Création…' : 'Créer le statut'}</button></>}
      >
        <div className="form-grid">
          <Field label="Libellé *" full><input className="form-input" value={form.label} onChange={set('label')} placeholder="Ex: Injoignable longue durée" /></Field>
          <Field label="Couleur"><input className="form-input" type="color" value={form.color} onChange={set('color')} /></Field>
          <Field label="Phase">
            <select className="form-select" value={form.phase} onChange={set('phase')}>
              <option value="entrant">Entrant</option>
              <option value="traitement">Traitement</option>
              <option value="rdv">RDV</option>
              <option value="clos">Clos</option>
            </select>
          </Field>
          <Field label="Description (usage)" full><input className="form-input" value={form.description} onChange={set('description')} placeholder="Ex: Utilisé quand le prospect est injoignable depuis 30 jours" /></Field>
        </div>
      </Modal>
    </div>
  )
}
