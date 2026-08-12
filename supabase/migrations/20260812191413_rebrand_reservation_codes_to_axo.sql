-- Preserve the current atomic reservation implementation and change only the
-- public code prefix used by future reservations. Existing reservation codes
-- remain unchanged for auditability.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'private.reserve_car_atomic(uuid,timestamptz,timestamptz,uuid,uuid,text,text,text)'::regprocedure
  )
  into v_definition;

  if strpos(v_definition, '''AXO-''') > 0 then
    return;
  end if;

  if strpos(v_definition, '''HMX-''') = 0 then
    raise exception 'Expected reservation code prefix was not found';
  end if;

  execute replace(v_definition, '''HMX-''', '''AXO-''');
end
$migration$;
