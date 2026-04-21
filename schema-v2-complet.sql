-- ============================================================
-- PATRIMOINE CRM — Schéma Supabase COMPLET v2
-- Avec authentification, RLS, temps réel
-- 
-- INSTRUCTIONS :
-- 1. Ouvrir Supabase → SQL Editor → New query
-- 2. Coller CE FICHIER ENTIER
-- 3. Cliquer Run
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── TEAMS ───────────────────────────────────────────────────
create table if not exists public.teams (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  color       text default '#3b82f6',
  manager_id  uuid,
  created_at  timestamptz default now()
);

-- ─── CRM USERS (profils liés à auth.users) ───────────────────
create table if not exists public.crm_users (
  id          uuid primary key default uuid_generate_v4(),
  auth_id     uuid unique references auth.users(id) on delete set null,
  prenom      text not null,
  nom         text not null,
  email       text,
  role        text not null check (role in ('admin','manager','agent','telephoniste')),
  team_id     uuid references public.teams(id) on delete set null,
  quota       integer default 0,
  color       text default '#3b82f6',
  actif       boolean default true,
  goal_r1     integer default 15,
  created_at  timestamptz default now()
);

-- FK manager sur teams (après création de crm_users)
alter table public.teams
  add constraint if not exists fk_teams_manager
  foreign key (manager_id) references public.crm_users(id) on delete set null;

-- ─── CAMPAIGNS ───────────────────────────────────────────────
create table if not exists public.campaigns (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  code        text not null,
  color       text default '#3b82f6',
  description text,
  actif       boolean default true,
  mapping     jsonb default '{}',
  created_at  timestamptz default now()
);

-- ─── STATUSES (entièrement configurables via interface) ───────
create table if not exists public.statuses (
  id          text primary key,
  label       text not null,
  color       text default '#64748b',
  phase       text not null check (phase in ('entrant','traitement','rdv','clos')),
  sort_order  integer default 0,
  description text,
  disabled    boolean default false,
  created_at  timestamptz default now()
);

insert into public.statuses (id, label, color, phase, sort_order) values
  ('NEW',      'NEW',              '#8b5cf6', 'entrant',    0),
  ('rappeler', 'À rappeler',       '#06b6d4', 'traitement', 1),
  ('nrp1',     'NRP 1',            '#f59e0b', 'traitement', 2),
  ('nrp2',     'NRP 2',            '#f59e0b', 'traitement', 3),
  ('nrp3',     'NRP 3',            '#ef9a07', 'traitement', 4),
  ('nrp4',     'NRP 4',            '#e8860a', 'traitement', 5),
  ('nrp5',     'NRP 5',            '#d97706', 'traitement', 6),
  ('r1',       'R1 fixé',          '#3b82f6', 'rdv',        7),
  ('r1h',      'R1 honoré',        '#10b981', 'rdv',        8),
  ('r1nh',     'R1 non honoré',    '#ef4444', 'rdv',        9),
  ('pi',       'Pas intéressé',    '#64748b', 'clos',       10),
  ('hc',       'Hors cible',       '#475569', 'clos',       11),
  ('mn',       'Mauvais numéro',   '#334155', 'clos',       12),
  ('dup',      'Doublon confirmé', '#1e293b', 'clos',       13),
  ('devis',    'Devis signé',      '#059669', 'clos',       14)
on conflict (id) do nothing;

-- ─── QUOTAS (par campagne × utilisateur) ─────────────────────
create table if not exists public.quotas (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id     uuid not null references public.crm_users(id) on delete cascade,
  quota       integer default 0,
  unique(campaign_id, user_id)
);

-- ─── LEADS ───────────────────────────────────────────────────
create table if not exists public.leads (
  id             uuid primary key default uuid_generate_v4(),
  prenom         text not null,
  nom            text not null,
  tel            text,
  email          text,
  dob            date,
  canton         text,
  sitpro         text,
  campaign_id    uuid references public.campaigns(id) on delete set null,
  status_id      text references public.statuses(id) on delete set default default 'NEW',
  agent_id       uuid references public.crm_users(id) on delete set null,
  responsable_id uuid references public.crm_users(id) on delete set null,
  notes          text,
  extra          jsonb default '{}',
  rdv_date       timestamptz,
  recall_date    timestamptz,
  call_log       jsonb default '[]',
  last_activity  timestamptz default now(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Index performances
create index if not exists idx_leads_status     on public.leads(status_id);
create index if not exists idx_leads_agent      on public.leads(agent_id);
create index if not exists idx_leads_campaign   on public.leads(campaign_id);
create index if not exists idx_leads_tel        on public.leads(tel) where tel is not null;
create index if not exists idx_leads_email      on public.leads(email) where email is not null;
create index if not exists idx_leads_created    on public.leads(created_at desc);
create index if not exists idx_leads_activity   on public.leads(last_activity desc);
create index if not exists idx_leads_rdv        on public.leads(rdv_date) where rdv_date is not null;
create index if not exists idx_leads_recall     on public.leads(recall_date) where recall_date is not null;

-- ─── LEAD LOG (audit immuable) ────────────────────────────────
create table if not exists public.lead_log (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  action      text not null,
  user_name   text,
  user_id     uuid references public.crm_users(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists idx_log_lead    on public.lead_log(lead_id);
create index if not exists idx_log_created on public.lead_log(created_at desc);

-- ─── SETTINGS (clé-valeur globale) ───────────────────────────
create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

insert into public.settings (key, value) values
  ('dormantHours', '48'),
  ('goalR1', '15'),
  ('goalDay', '20')
on conflict (key) do nothing;

-- ─── TRIGGER : updated_at sur leads ──────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ─── TRIGGER : auto-créer profil crm_users à l'inscription ──
-- Quand un admin crée un user dans Supabase Auth, ce trigger
-- crée automatiquement son profil CRM si auth_id correspond.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  -- Mettre à jour auth_id si un profil avec le même email existe déjà
  update public.crm_users
  set auth_id = new.id
  where email = new.email and auth_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─── FONCTION INGESTION WEBHOOK (depuis Apps Script) ─────────
create or replace function public.ingest_lead(
  p_prenom      text,
  p_nom         text,
  p_tel         text,
  p_email       text      default null,
  p_dob         text      default null,
  p_canton      text      default null,
  p_sitpro      text      default null,
  p_campaign_id uuid      default null,
  p_extra       jsonb     default '{}'
)
returns jsonb language plpgsql security definer as $$
declare
  v_dup       leads%rowtype;
  v_agent     crm_users%rowtype;
  v_lead_id   uuid;
  v_is_dup    boolean := false;
  v_closed    text[];
begin
  -- IDs des statuts "clos"
  select array_agg(id) into v_closed
  from public.statuses where phase = 'clos';

  -- Détection doublon (tel ou email)
  select * into v_dup from public.leads
  where (p_tel is not null and p_tel != '' and tel = p_tel)
     or (p_email is not null and p_email != '' and email = p_email)
  order by created_at desc limit 1;

  if found then
    v_is_dup := true;
    select * into v_agent from public.crm_users where id = v_dup.agent_id;
  else
    -- Dispatch : quota pondéré + dynamique
    with totals as (
      select sum(q.quota) as total_q
      from public.quotas q
      where q.campaign_id = p_campaign_id
    ),
    charges as (
      select l.agent_id, count(*) as cnt
      from public.leads l
      where l.status_id != all(v_closed)
      group by l.agent_id
    ),
    max_charge as (
      select coalesce(max(cnt), 1) as mc from charges
    )
    select cu.* into v_agent
    from public.crm_users cu
    join public.quotas q   on q.user_id = cu.id and q.campaign_id = p_campaign_id
    left join charges      on charges.agent_id = cu.id
    cross join totals
    cross join max_charge
    where cu.actif = true
      and cu.role in ('agent', 'telephoniste')
      and q.quota > 0
      and (totals.total_q is null or totals.total_q > 0)
    order by
      (q.quota::float / nullif(totals.total_q, 0))
      - 0.3 * (coalesce(charges.cnt, 0)::float / max_charge.mc)
    desc limit 1;

    -- Fallback si pas de quota configuré
    if v_agent.id is null then
      select cu.* into v_agent
      from public.crm_users cu
      where cu.actif = true and cu.role in ('agent', 'telephoniste')
      order by (
        select count(*) from public.leads l
        where l.agent_id = cu.id and l.status_id != all(v_closed)
      ) asc
      limit 1;
    end if;
  end if;

  -- Insertion du lead
  insert into public.leads (
    prenom, nom, tel, email, dob, canton, sitpro,
    campaign_id, status_id, agent_id, extra,
    last_activity, created_at
  ) values (
    p_prenom, p_nom,
    nullif(p_tel, ''), nullif(p_email, ''),
    case when p_dob is not null and p_dob != '' then p_dob::date else null end,
    nullif(p_canton, ''), nullif(p_sitpro, ''),
    p_campaign_id, 'NEW', v_agent.id, p_extra,
    now(), now()
  ) returning id into v_lead_id;

  -- Log
  insert into public.lead_log (lead_id, action, user_name)
  values (
    v_lead_id,
    case
      when v_is_dup then 'Lead créé via ingestion (doublon détecté → même agent conservé)'
      else 'Lead créé via ingestion automatique (Apps Script)'
    end,
    'Système'
  );

  return jsonb_build_object(
    'lead_id',  v_lead_id,
    'agent_id', v_agent.id,
    'agent',    v_agent.prenom || ' ' || v_agent.nom,
    'is_dup',   v_is_dup,
    'status',   'ok'
  );
end;
$$;

-- ─── RLS (Row Level Security) ─────────────────────────────────
-- Activer RLS sur toutes les tables
alter table public.leads        enable row level security;
alter table public.crm_users    enable row level security;
alter table public.campaigns    enable row level security;
alter table public.teams        enable row level security;
alter table public.statuses     enable row level security;
alter table public.quotas       enable row level security;
alter table public.lead_log     enable row level security;
alter table public.settings     enable row level security;

-- ── Fonction helper : récupérer le rôle de l'utilisateur connecté
create or replace function public.my_role()
returns text language sql security definer stable as $$
  select role from public.crm_users where auth_id = auth.uid() limit 1;
$$;

-- ── Fonction helper : récupérer l'ID crm_user connecté
create or replace function public.my_crm_id()
returns uuid language sql security definer stable as $$
  select id from public.crm_users where auth_id = auth.uid() limit 1;
$$;

-- ── POLICIES : crm_users ──────────────────────────────────────
-- Lire : tout le monde voit la liste (pour les sélecteurs)
create policy "crm_users_select_all" on public.crm_users
  for select using (true);

-- Modifier : admin uniquement
create policy "crm_users_update_admin" on public.crm_users
  for update using (public.my_role() in ('admin', 'manager'));

create policy "crm_users_insert_admin" on public.crm_users
  for insert with check (public.my_role() = 'admin');

-- ── POLICIES : leads ──────────────────────────────────────────
-- Admin/manager voient tout
create policy "leads_select_admin" on public.leads
  for select using (public.my_role() in ('admin', 'manager'));

-- Agent/téléphoniste ne voient que leurs leads
create policy "leads_select_own" on public.leads
  for select using (
    public.my_role() in ('agent', 'telephoniste')
    and agent_id = public.my_crm_id()
  );

-- Création : tout utilisateur authentifié peut créer
create policy "leads_insert_auth" on public.leads
  for insert with check (auth.uid() is not null);

-- Modification : admin/manager peuvent tout modifier
create policy "leads_update_admin" on public.leads
  for update using (public.my_role() in ('admin', 'manager'));

-- Modification : agent/téléphoniste ne modifient que leurs leads
create policy "leads_update_own" on public.leads
  for update using (
    public.my_role() in ('agent', 'telephoniste')
    and agent_id = public.my_crm_id()
  );

-- Suppression : admin uniquement (ne pas autoriser en pratique)
create policy "leads_delete_admin" on public.leads
  for delete using (public.my_role() = 'admin');

-- ── POLICIES : lead_log ───────────────────────────────────────
-- Admin/manager voient tout
create policy "log_select_admin" on public.lead_log
  for select using (public.my_role() in ('admin', 'manager'));

-- Agent voit le log de ses leads
create policy "log_select_own" on public.lead_log
  for select using (
    public.my_role() in ('agent', 'telephoniste')
    and lead_id in (
      select id from public.leads where agent_id = public.my_crm_id()
    )
  );

-- Insertion : tout utilisateur authentifié
create policy "log_insert_auth" on public.lead_log
  for insert with check (auth.uid() is not null);

-- ── POLICIES : tables de référence (lecture universelle) ──────
create policy "campaigns_select"  on public.campaigns for select using (true);
create policy "campaigns_write"   on public.campaigns for all    using (public.my_role() in ('admin', 'manager'));

create policy "statuses_select"   on public.statuses  for select using (true);
create policy "statuses_write"    on public.statuses  for all    using (public.my_role() in ('admin', 'manager'));

create policy "teams_select"      on public.teams     for select using (true);
create policy "teams_write"       on public.teams     for all    using (public.my_role() in ('admin', 'manager'));

create policy "quotas_select"     on public.quotas    for select using (true);
create policy "quotas_write"      on public.quotas    for all    using (public.my_role() in ('admin', 'manager'));

create policy "settings_select"   on public.settings  for select using (true);
create policy "settings_write"    on public.settings  for all    using (public.my_role() in ('admin', 'manager'));

-- ── REALTIME : activer sur les tables clés ───────────────────
begin;
  -- Activer la publication realtime
  alter publication supabase_realtime add table public.leads;
  alter publication supabase_realtime add table public.statuses;
  alter publication supabase_realtime add table public.campaigns;
  alter publication supabase_realtime add table public.crm_users;
  alter publication supabase_realtime add table public.settings;
commit;

-- ─── DONNÉES INITIALES ───────────────────────────────────────
-- Insérer les 3 équipes de départ
insert into public.teams (name, color) values
  ('Équipe Alpha',  '#3b82f6'),
  ('Équipe Beta',   '#10b981'),
  ('Équipe Gamma',  '#8b5cf6')
on conflict do nothing;

-- ─── RÉSUMÉ DES ÉTAPES POST-SCHÉMA ───────────────────────────
-- 
-- ÉTAPE 1 — Créer le compte admin dans Supabase Auth :
--   Authentication → Users → "Invite user" ou "Add user"
--   Email : baptiste@patrimoinecrm.ch (ou le vôtre)
--   Mot de passe : choisir un mot de passe fort
--
-- ÉTAPE 2 — Créer le profil admin dans crm_users :
--   Après avoir noté l'UUID auth de l'étape 1, exécuter :
--   INSERT INTO public.crm_users (auth_id, prenom, nom, email, role, color, actif)
--   VALUES ('UUID-DE-AUTH', 'Baptiste', 'Haensler', 'email@...', 'admin', '#3b82f6', true);
--
-- ÉTAPE 3 — Pour chaque nouvel utilisateur :
--   a) Créer son compte dans Authentication → Users
--   b) Dans Équipes (interface CRM), créer son profil avec son email
--   c) Le trigger handle_new_auth_user() lie automatiquement auth_id ↔ profil
--
-- ─────────────────────────────────────────────────────────────
