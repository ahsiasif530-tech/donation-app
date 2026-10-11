-- Run once in Supabase Dashboard > SQL Editor > New query > Run.
-- The same changes are already in schema.sql for new setups.

-- 1. Settings (PayPal secrets, settings password hash) become unreadable to
--    every signed-in user, admins included; the server uses the service key.
drop policy if exists "settings_admin_all" on settings;

-- 2. Withdrawals are checked and recorded in one locked call, so two at once
--    can't take out more than the page has.
create or replace function add_withdrawal(p_page_id uuid, p_amount numeric, p_note text, p_created_by uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_available numeric;
begin
  perform 1 from pages where id = p_page_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'page_not_found');
  end if;

  select coalesce((select sum(amount) from donations where page_id = p_page_id and status = 'completed'), 0)
       - coalesce((select sum(amount) from withdrawals where page_id = p_page_id), 0)
    into v_available;

  if p_amount > v_available then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'available', v_available);
  end if;

  insert into withdrawals (page_id, amount, note, created_by)
  values (p_page_id, p_amount, p_note, p_created_by);
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function add_withdrawal(uuid, numeric, text, uuid) from public, anon, authenticated;
grant execute on function add_withdrawal(uuid, numeric, text, uuid) to service_role;
