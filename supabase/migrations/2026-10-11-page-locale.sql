-- Run once in Supabase Dashboard > SQL Editor > New query > Run.
-- The same change is already in schema.sql for new setups.

-- The language a donation page is shown in: 'en' (English) or 'es'
-- (Mexican Spanish). Words for each are in src/lib/i18n.js.
alter table pages
  add column if not exists locale text not null default 'en' check (locale in ('en', 'es'));

update pages set locale = 'es' where slug = 'blesshand-mx';
