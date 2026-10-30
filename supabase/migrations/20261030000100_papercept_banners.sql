-- Venue covers: the conference banners shown on PaperCept (controls.papercept.net/conferences/scripts/start.pl),
-- matched by acronym. The banners are 468 × 60 strips, so they use fit = contain (shown whole on white).
-- The previous cover is kept in details.cover_previous; to undo:
--   update venues set details = jsonb_set(details - 'cover_previous', '{cover}', details->'cover_previous') where details ? 'cover_previous';
with b(slug, file) as (values
  ('icuas-euam', 'icuaseuam_lg.png'), ('ieee-joe', 'ieeejoe_lg.png'),
  ('cnca-2026', 'CNCA26_lg.png'), ('icstcc-2026', 'STCC26_lg.png'), ('icarcv-2026', 'ARCV26_lg.png'),
  ('adconip-2026', 'ACIP26_lg.png'), ('icsc-2026', 'ICSC26_lg.png'),
  ('icc-2027', 'ICC27_lg.png'), ('iscs-2027', 'ISCS27_lg.png'), ('icca-2027', 'ICCA27_lg.jpg'),
  ('codit-2027', 'CODIT27_lg.jpg'), ('ecc-2027', 'ECC27_lg.jpg'), ('icuas-2027', 'ICUAS27_lg.jpg')
)
update venues v
set details = coalesce(v.details, '{}'::jsonb)
  || jsonb_build_object('cover_previous', v.details->'cover')
  || jsonb_build_object('cover', jsonb_build_object(
       'url', 'https://controls.papercept.net/conferences/scripts/config/banners/thumbnails/' || b.file,
       'alt', v.short_name || ' banner',
       'fit', 'contain',
       'focus', 'center',
       'credit', 'Banner via PaperCept',
       'creditUrl', 'https://controls.papercept.net/conferences/scripts/start.pl'))
from b
where v.slug = b.slug
  and coalesce(v.details->'cover'->>'fit', '') <> 'contain';
