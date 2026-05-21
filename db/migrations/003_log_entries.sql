create table if not exists log_entries (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  logged_at timestamptz not null,
  log_date date not null,
  log_time text not null,
  repo text not null,
  tags jsonb not null default '[]'::jsonb,
  summary text not null,
  verification text not null,
  commit_ref text not null,
  push_status text not null,
  next_plan text not null,
  blockers text not null,
  source_path text not null,
  created_by text not null default 'agent',
  created_at timestamptz not null default now()
);

create index if not exists log_entries_project_logged_idx on log_entries(project_id, logged_at desc);
create index if not exists log_entries_log_date_idx on log_entries(log_date, log_time desc);
