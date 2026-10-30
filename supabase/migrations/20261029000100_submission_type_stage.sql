-- "How to submit" table on the event page: the submission stage and opening date of each paper type, set by the
-- organizers instead of worked out by the page.
--   stage:    'first' (First Submission) or 'final' (Final Submission). null = automatic: open types are first,
--             closed ones final (the behaviour before this column).
--   opens_at: when this type opens. null = the event's "Submission site opens" date.
alter table public.submission_types
  add column if not exists stage text check (stage in ('first', 'final')),
  add column if not exists opens_at timestamptz;

comment on column public.submission_types.stage is 'Submission stage on the event page: first = First Submission, final = Final Submission; null = automatic (open types first, closed final).';
comment on column public.submission_types.opens_at is 'When this type opens (Open column on the event page); null = the event''s submission-site opening date.';

-- CoDIT 2027: its four public types are in the first submission stage.
update public.submission_types t set stage = 'first'
from public.venues v
where v.id = t.venue_id and v.slug = 'codit-2027' and t.enabled and t.stage is null;
