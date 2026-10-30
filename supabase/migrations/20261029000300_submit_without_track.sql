-- The track is optional when submitting: authors no longer pick one in the wizard (the Track field on Details is
-- hidden); program chairs can still set or change it. Same function as before without the "track missing" check.
create or replace function public.submit_paper(p_submission uuid, p_agree boolean, p_present boolean)
returns integer language plpgsql security definer set search_path = '' as $function$
declare
  s public.submissions;
  v_me uuid := private.current_person_id();
  v_words int;
  v_number int;
begin
  select * into s from public.submissions where id = p_submission for update;
  if s.id is null or not private.can_edit_submission(p_submission) then raise exception 'cannot submit this paper' using errcode = '42501'; end if;
  if not coalesce(p_agree, false) or not coalesce(p_present, false) then raise exception 'confirm both statements' using errcode = '22023'; end if;
  if coalesce(btrim(s.title), '') in ('', 'Untitled paper') then raise exception 'title missing' using errcode = '22023'; end if;
  v_words := coalesce(array_length(regexp_split_to_array(btrim(coalesce(s.abstract, '')), '\s+'), 1), 0);
  if coalesce(btrim(s.abstract), '') = '' or v_words > 250 then raise exception 'abstract missing or over 250 words' using errcode = '22023'; end if;
  if not coalesce((s.declarations ->> 'original')::boolean, false) then raise exception 'originality declaration missing' using errcode = '22023'; end if;
  if cardinality(s.keywords) < 3 then raise exception 'pick at least 3 keywords' using errcode = '22023'; end if;
  if (select count(*) from public.submission_authors where submission_id = p_submission and is_corresponding) <> 1 then
    raise exception 'one corresponding author needed' using errcode = '22023';
  end if;
  if not exists (select 1 from public.submission_files f where f.submission_id = p_submission and f.role = 'paper' and f.is_current
                 and coalesce(f.check_result ->> 'status', '') <> 'failed') then
    raise exception 'upload a PDF that passes the checks' using errcode = '22023';
  end if;
  if exists (select 1 from public.submission_conflicts c where c.submission_id = p_submission and coalesce(btrim(c.reason), '') = '') then
    raise exception 'give a reason for each conflict' using errcode = '22023';
  end if;

  if s.is_test then
    update public.submissions set test_submitted_at = now(), draft_step = 7, updated_at = now(),
           confirmations = jsonb_build_object('agree', true, 'present', true, 'at', now())
     where id = p_submission;
    insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
    values (v_me, s.venue_id, 'submission.test_submitted', 'submission', p_submission);
    return 0;
  end if;

  if s.stage = 'draft' then
    perform 1 from public.venues where id = s.venue_id for update;   -- serialise numbering per venue
    select coalesce(max(number), 0) + 1 into v_number from public.submissions where venue_id = s.venue_id and not is_test;
    update public.submissions
       set stage = 'submitted', number = v_number, submitted_at = now(), draft_step = 7,
           stage_detail = 'Editable until the deadline', confirmations = jsonb_build_object('agree', true, 'present', true, 'at', now()),
           updated_at = now()
     where id = p_submission;
    insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id, details)
    values (v_me, s.venue_id, 'submission.submitted', 'submission', p_submission, jsonb_build_object('number', v_number));
  else
    v_number := s.number;
    update public.submissions set confirmations = jsonb_build_object('agree', true, 'present', true, 'at', now()), updated_at = now() where id = p_submission;
    insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
    values (v_me, s.venue_id, 'submission.updated', 'submission', p_submission);
  end if;
  return v_number;
end $function$;
