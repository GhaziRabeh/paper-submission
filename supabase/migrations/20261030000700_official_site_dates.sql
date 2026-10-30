-- Important dates checked against each event's official website (linked from its PaperCept banner), 30 Oct 2026.
-- Deadlines are 23:59 in the zone the site states (AoE for CoDIT, Pacific Time for ISCS), else the event's local time.
-- ICARCV, AdCONIP and ICUAS already matched; ICCA's site could not be read.

-- ECC 2027: papers and invited session proposals extended 31 Oct -> 9 Nov 2026 (23:59 CET)
update venue_dates set starts_at = '2026-11-09T22:59:00Z', is_extended = true, extended_from = '2026-10-31T22:59:00Z'
where id in ('4f62cfaf-d1a6-4521-bf3d-bb44b79f2a3b', 'e8288033-0ede-42d1-8a9c-ca6b5e5b82af');
-- ICC 2027: poster submission 30 Oct 2026 (23:59 IST)
update venue_dates set starts_at = '2026-10-30T18:29:00Z' where id = '81d7dbfb-94e0-41f7-9c5f-2dc7588bb570';
-- CoDIT 2027: all deadlines 23:59 AoE
update venue_dates set starts_at = '2026-12-01T11:59:00Z' where id = 'a7368ba5-42ae-4ec2-836c-3ef612d966e4';
update venue_dates set starts_at = '2027-02-03T11:59:00Z' where id = 'f4b1d86d-66a4-452a-8c1a-0528db643776';
update venue_dates set starts_at = '2027-04-28T11:59:00Z' where id = '9fcd4a7e-5ff5-41c8-9a7a-8920191eb7e6';
update venue_dates set starts_at = '2027-05-23T11:59:00Z' where id in ('17312536-7040-4037-a4fe-d6b0813d32f8', '1d0a9d56-c964-440b-83fc-452d30da55a4');
-- ISCS 2027: initial submission 16 Oct 2026 23:59:59 Pacific Time, extended from 9 Oct
update venue_dates set starts_at = '2026-10-17T06:59:59Z', is_extended = true, extended_from = '2026-10-10T06:59:59Z'
where id = '7f9af0e8-1236-4f47-bd80-f69534feff37';

-- Dates the sites list that the app did not have
insert into venue_dates (venue_id, kind, label, starts_at, is_hard, is_extended, extended_from)
select v.id, x.kind::venue_date_kind, x.label, x.at::timestamptz, false, x.ext, x.was::timestamptz from venues v join (values
  ('icsc-2026', 'notification', 'Paper decision notification', '2026-11-17T23:59:00Z', false, null),
  ('icsc-2026', 'final', 'Final submission', '2026-12-07T23:59:00Z', false, null),
  ('icsc-2026', 'registration', 'Registration', '2026-12-10T23:59:00Z', false, null),
  ('icstcc-2026', 'proposal', 'Invited session proposals', '2026-05-04T20:59:00Z', true, '2026-04-20T20:59:00Z'),
  ('icstcc-2026', 'notification', 'Notification of acceptance', '2026-07-15T20:59:00Z', false, null),
  -- 14 Aug per the site's Final Submission and Registration pages (the Key Dates block also shows the old 31 Jul)
  ('icstcc-2026', 'final', 'Camera-ready manuscript and early registration', '2026-08-14T20:59:00Z', true, '2026-07-31T20:59:00Z'),
  ('cnca-2026', 'notification', 'Notification of acceptance (from)', '2026-08-21T05:59:00Z', false, null)
) as x(slug, kind, label, at, ext, was) on v.slug = x.slug
where not exists (select 1 from venue_dates d where d.venue_id = v.id and d.label = x.label);
