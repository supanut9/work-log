create table if not exists projects (
  id text primary key,
  path text not null,
  name text not null,
  enabled boolean not null default true,
  repo_kind text not null,
  product text not null,
  branch_policy text not null,
  push_policy text not null,
  milestone_tag_policy text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_tags (
  project_id text not null references projects(id) on delete cascade,
  tag text not null,
  primary key (project_id, tag)
);

create table if not exists repo_snapshots (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  captured_at timestamptz not null default now(),
  branch text,
  dirty_files integer not null default 0,
  ahead integer,
  behind integer,
  has_origin boolean not null default false,
  fetch_status text not null,
  last_commit_hash text,
  last_commit_subject text,
  remote_url text
);

create table if not exists work_entries (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  entry_type text not null,
  title text not null,
  body text not null,
  card_id text,
  status text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists commit_records (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  commit_hash text not null,
  message text not null,
  card_id text,
  repo_id text not null,
  scope text not null,
  committed_at timestamptz,
  pushed_at timestamptz,
  push_status text not null default 'unknown'
);

create table if not exists plans (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null,
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists repo_snapshots_project_captured_idx on repo_snapshots(project_id, captured_at desc);
create index if not exists repo_snapshots_attention_idx on repo_snapshots(fetch_status, dirty_files, ahead, behind);
create index if not exists work_entries_project_created_idx on work_entries(project_id, created_at desc);
create index if not exists work_entries_card_idx on work_entries(card_id);
create index if not exists commit_records_project_committed_idx on commit_records(project_id, committed_at desc);
create index if not exists plans_project_status_idx on plans(project_id, status);

