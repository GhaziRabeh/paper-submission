-- Authors step: a co-author typed by email who already has an account is added directly.
--  * An account with a person is found by its sign-in email too, not only through person_emails (one account,
--    mbenabdallah774@gmail.com, had no person_emails row: typing it offered "new co-author" and saving would have
--    made a second person).
--  * An account that hasn't finished signing up (no person yet, e.g. never confirmed) is recognised as well:
--    find_person returns it with no person_id and initials only; set_authors then makes the placeholder person
--    from the name given at sign-up, claimed when they finish signing up (link_confirmed_user).

-- 1. Every account's sign-in email is listed on its person.
insert into public.person_emails (person_id, email, is_primary)
select p.id, lower(u.email), not exists (select 1 from public.person_emails x where x.person_id = p.id)
from auth.users u join public.persons p on p.user_id = u.id
where u.email is not null and p.deleted_at is null and p.merged_into is null
  and not exists (select 1 from public.person_emails e where e.email = u.email::extensions.citext);

-- 2. find_person: by PIN; by email (listed email, or an account's sign-in email); an account without a person
--    yet comes back with person_id null. Initials only for email lookups (no harvesting names).
create or replace function public.find_person(p_query text)
returns table(person_id uuid, display_name text, institution text, plenary_id text)
language plpgsql stable security definer set search_path = '' as $function$
declare q text := lower(btrim(coalesce(p_query, '')));
begin
  if private.current_person_id() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  q := regexp_replace(q, '^pin[\s:#-]*', '');
  if q ~ '^[1-9][0-9]{3,8}$' then
    return query select p.id, p.display_name,
      (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1), p.plenary_id
      from public.persons p where p.plenary_id = q and p.deleted_at is null and p.merged_into is null;
  elsif q ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return query select p.id,
      btrim(upper(left(coalesce(p.given_name, ''), 1)) || '. ' || upper(left(coalesce(p.family_name, ''), 1)) || '.'),
      null::text, null::text
      from public.persons p
      where p.deleted_at is null and p.merged_into is null
        and (exists (select 1 from public.person_emails e where e.person_id = p.id and e.email = q::extensions.citext)
             or exists (select 1 from auth.users u where u.id = p.user_id and lower(u.email) = q))
      limit 1;
    if not found then
      return query select null::uuid,
        btrim(upper(left(coalesce(u.raw_user_meta_data ->> 'given_name', ''), 1)) || '. ' || upper(left(coalesce(u.raw_user_meta_data ->> 'family_name', ''), 1)) || '.'),
        null::text, null::text
        from auth.users u
        where lower(u.email) = q and not exists (select 1 from public.persons p where p.user_id = u.id)
        limit 1;
    end if;
  end if;
end $function$;

-- 3. set_authors: a co-author typed by email is matched the same way; for an account without a person yet, the
--    placeholder takes the name given at sign-up when none was typed.
create or replace function public.set_authors(p_submission uuid, p_authors jsonb)
returns void language plpgsql security definer set search_path = '' as $function$
declare
  v_me uuid := private.current_person_id();
  v_item jsonb;
  v_pid uuid;
  v_pos smallint := 0;
  v_email text;
  v_given text;
  v_family text;
  v_ids uuid[] := '{}';
  v_corr int := 0;
begin
  if not private.can_edit_submission(p_submission) then raise exception 'cannot edit this paper' using errcode = '42501'; end if;
  if jsonb_typeof(p_authors) <> 'array' or jsonb_array_length(p_authors) = 0 or jsonb_array_length(p_authors) > 40 then
    raise exception 'between 1 and 40 authors' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_authors) loop
    v_pid := nullif(v_item ->> 'person_id', '')::uuid;
    if v_pid is null then
      v_email := lower(btrim(coalesce(v_item ->> 'email', '')));
      if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email %', v_email using errcode = '22023'; end if;
      select e.person_id into v_pid from public.person_emails e where e.email = v_email::extensions.citext;
      if v_pid is null then
        select p.id into v_pid from auth.users u join public.persons p on p.user_id = u.id
        where lower(u.email) = v_email and p.deleted_at is null and p.merged_into is null limit 1;
      end if;
      if v_pid is null then
        -- placeholder person: claimed automatically when they sign up with this email (link_confirmed_user)
        v_given := btrim(coalesce(v_item ->> 'given_name', ''));
        v_family := btrim(coalesce(v_item ->> 'family_name', ''));
        if v_given = '' and v_family = '' then
          select btrim(coalesce(u.raw_user_meta_data ->> 'given_name', '')), btrim(coalesce(u.raw_user_meta_data ->> 'family_name', ''))
            into v_given, v_family from auth.users u where lower(u.email) = v_email limit 1;
        end if;
        if coalesce(v_given, '') = '' and coalesce(v_family, '') = '' then
          raise exception 'name required for %', v_email using errcode = '22023';
        end if;
        insert into public.persons (given_name, family_name)
        values (left(coalesce(v_given, ''), 120), left(coalesce(v_family, ''), 120))
        returning id into v_pid;
        insert into public.person_emails (person_id, email, is_primary) values (v_pid, v_email, true);
        if coalesce(btrim(v_item ->> 'institution'), '') <> '' then
          insert into public.affiliations (person_id, institution, email_domain)
          values (v_pid, left(btrim(v_item ->> 'institution'), 200), split_part(v_email, '@', 2));
        end if;
      end if;
    elsif not exists (select 1 from public.persons where id = v_pid) then
      raise exception 'unknown person' using errcode = '22023';
    end if;
    if v_pid = any (v_ids) then raise exception 'an author is listed twice' using errcode = '22023'; end if;
    v_ids := v_ids || v_pid;
    if coalesce((v_item ->> 'corresponding')::boolean, false) then v_corr := v_corr + 1; end if;
  end loop;

  if not (v_me = any (v_ids)) then raise exception 'you must stay on the author list' using errcode = '22023'; end if;
  if v_corr <> 1 then raise exception 'choose exactly one corresponding author' using errcode = '22023'; end if;

  delete from public.submission_authors where submission_id = p_submission;
  for v_item in select * from jsonb_array_elements(p_authors) loop
    v_pos := v_pos + 1;
    insert into public.submission_authors (submission_id, person_id, position, is_corresponding)
    values (p_submission, v_ids[v_pos], v_pos, coalesce((v_item ->> 'corresponding')::boolean, false));
  end loop;
  update public.submissions set updated_at = now() where id = p_submission;
end $function$;
