-- Additive migration for existing installations. Apply this file to add the
-- year-wise create RPC; do not rerun the full bootstrap schema for this change.
-- SECURITY INVOKER keeps the existing table grants and RLS policies in force.
-- The RPC inserts the member batch and initial payments as one transaction.
create or replace function public.create_yearwise_members_with_initial_payments(
  p_members jsonb,
  p_payments jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_member record;
  v_payment record;
  v_member_id text;
  v_payment_id text;
  v_member_ids text[] := array[]::text[];
  v_payment_ids text[] := array[]::text[];
begin
  if auth.uid() is null or not coalesce(public.is_e_register_admin(), false) then
    raise insufficient_privilege using message = 'Admin authorization is required.';
  end if;

  if p_members is null
    or jsonb_typeof(p_members) <> 'array'
    or jsonb_array_length(p_members) = 0 then
    raise invalid_parameter_value using message = 'At least one member is required.';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise invalid_parameter_value using message = 'Payment details must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_members) as m(
      id text,
      sno integer,
      account_number text,
      name text,
      status text,
      join_date date,
      entry_amount numeric
    )
    where nullif(btrim(coalesce(m.id, '')), '') is null
      or m.sno is null
      or m.sno <= 0
      or nullif(btrim(coalesce(m.account_number, '')), '') is null
      or nullif(btrim(coalesce(m.name, '')), '') is null
      or m.status not in ('Active', 'Inactive', 'Pending')
      or m.join_date is null
      or m.entry_amount is null
      or m.entry_amount < 0
  ) then
    raise invalid_parameter_value using message = 'Member details are incomplete or invalid.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_payments) as p(
      id text,
      member_id text,
      payment_date date,
      amount numeric,
      payment_mode text,
      status text,
      receipt_id text
    )
    where nullif(btrim(coalesce(p.id, '')), '') is null
      or nullif(btrim(coalesce(p.member_id, '')), '') is null
      or p.payment_date is null
      or p.amount is null
      or p.amount <= 0
      or p.payment_mode not in ('UPI', 'Cash', 'Bank Transfer', 'Cheque')
      or p.status not in ('Paid', 'Pending', 'Failed')
      or nullif(btrim(coalesce(p.receipt_id, '')), '') is null
  ) then
    raise invalid_parameter_value using message = 'Initial payment details are incomplete or invalid.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_payments) as p(member_id text)
    where not exists (
      select 1
      from jsonb_to_recordset(p_members) as m(id text, entry_amount numeric)
      where m.id = p.member_id
        and m.entry_amount > 0
    )
  ) then
    raise invalid_parameter_value using message = 'An initial payment must belong to a new member with a positive entry amount.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_members) as m(id text, entry_amount numeric)
    where m.entry_amount > 0
      and (
        select count(*)
        from jsonb_to_recordset(p_payments) as p(member_id text)
        where p.member_id = m.id
      ) <> 1
  ) then
    raise invalid_parameter_value using message = 'Each positive entry amount requires exactly one initial payment.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_members) as m(id text, join_date date, entry_amount numeric)
    join jsonb_to_recordset(p_payments) as p(member_id text, payment_date date, amount numeric)
      on p.member_id = m.id
    where p.amount is distinct from m.entry_amount
      or p.payment_date is distinct from m.join_date
  ) then
    raise invalid_parameter_value using message = 'Initial payment amount and date must match the member entry.';
  end if;

  for v_member in
    select *
    from jsonb_to_recordset(p_members) as m(
      id text,
      sno integer,
      account_number text,
      name text,
      initials text,
      avatar_color text,
      hometown text,
      phone text,
      email text,
      status text,
      join_date date,
      entry_amount numeric
    )
  loop
    insert into public.members (
      id, sno, account_number, name, initials, avatar_color,
      hometown, phone, email, status, join_date, entry_amount
    ) values (
      v_member.id,
      v_member.sno,
      v_member.account_number,
      v_member.name,
      coalesce(v_member.initials, ''),
      coalesce(v_member.avatar_color, '#2563EB'),
      coalesce(v_member.hometown, ''),
      coalesce(v_member.phone, ''),
      coalesce(v_member.email, ''),
      v_member.status,
      v_member.join_date,
      v_member.entry_amount
    ) returning id into v_member_id;

    v_member_ids := array_append(v_member_ids, v_member_id);
  end loop;

  for v_payment in
    select *
    from jsonb_to_recordset(p_payments) as p(
      id text,
      member_id text,
      payment_date date,
      amount numeric,
      payment_mode text,
      status text,
      receipt_id text,
      description text
    )
  loop
    insert into public.payments (
      id, member_id, payment_date, amount, payment_mode,
      status, receipt_id, description
    ) values (
      v_payment.id,
      v_payment.member_id,
      v_payment.payment_date,
      v_payment.amount,
      v_payment.payment_mode,
      v_payment.status,
      v_payment.receipt_id,
      coalesce(v_payment.description, '')
    ) returning id into v_payment_id;

    v_payment_ids := array_append(v_payment_ids, v_payment_id);
  end loop;

  return jsonb_build_object(
    'member_ids', to_jsonb(v_member_ids),
    'payment_ids', to_jsonb(v_payment_ids)
  );
exception
  when insufficient_privilege then
    raise exception using
      errcode = '42501',
      message = 'Your account is not authorized to create these records.';
  when others then
    raise exception using
      errcode = 'P0001',
      message = 'Unable to create members and initial payments. No changes were saved. Please try again.';
end;
$function$;

revoke all on function public.create_yearwise_members_with_initial_payments(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_yearwise_members_with_initial_payments(jsonb, jsonb) to authenticated;
