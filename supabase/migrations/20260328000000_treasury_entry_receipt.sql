-- Optional receipt attachment URL for treasury ledger entries (Phase 8 Finanzen).
alter table public.treasury_entries
  add column if not exists receipt_url text;

comment on column public.treasury_entries.receipt_url is 'Public URL after optional receipt upload (pdf/jpg/png).';
