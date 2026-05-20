alter table projects add column if not exists app_kind text;
alter table projects add column if not exists task_board text;
alter table projects add column if not exists phase_docs jsonb not null default '[]'::jsonb;
alter table projects add column if not exists architecture_docs jsonb not null default '[]'::jsonb;
alter table projects add column if not exists runbooks jsonb not null default '[]'::jsonb;
alter table projects add column if not exists tech jsonb not null default '[]'::jsonb;
alter table projects add column if not exists stats jsonb not null default '[]'::jsonb;

create index if not exists projects_metadata_gaps_idx on projects(enabled, task_board);

