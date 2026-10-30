-- PINs start at 10000 (5 to 9 digits). Existing PINs move up by 9000 (1001 -> 10001), the counter continues after
-- the highest one, and the check constraint refuses anything below 10000.
update public.persons set plenary_id = (plenary_id::bigint + 9000)::text
where plenary_id ~ '^[1-9][0-9]{3}$';
update public.account_help_requests set plenary_id = (plenary_id::bigint + 9000)::text
where plenary_id ~ '^[1-9][0-9]{3}$';

alter table public.persons drop constraint persons_plenary_id_check;
alter table public.persons add constraint persons_plenary_id_check check (plenary_id ~ '^[1-9][0-9]{4,8}$');

alter sequence private.pin_seq minvalue 10000 start with 10000 restart with 10000;
select setval('private.pin_seq', greatest(10000, (select coalesce(max(plenary_id::bigint), 10000) from public.persons)));
