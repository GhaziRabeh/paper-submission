-- Covers taken from each event's own website (linked from PaperCept), sharper than the PaperCept thumbnails and served
-- from public/venue-covers/. fit = banner: an image with the event's name, shown whole; fit = cover: a photo that fills the box.
-- ICSTCC 2026, ICC 2027, ECC 2027 and ICUAS 2027 use the event logo (ICUAS: its white logo set on navy).
-- ICSC 2026 and ICCA 2027: the PaperCept banner redrawn in high resolution (vector text over the Wikimedia city photo).
-- Every banner is 1600 × 400 and every photo 1600 × 900, so they all show at the same size on the cards.
with c(slug, file, fit, alt, site) as (values
  ('icsc-2026', 'icsc-2026.svg', 'banner', 'ICSC 2026 banner: the Dom Luís I bridge in Porto at night, December 16-18, 2026', 'https://commons.wikimedia.org/wiki/File:Puente_de_Don_Luis_I%2C_Oporto%2C_Portugal%2C_2019-06-02%2C_DD_29-31_HDR.jpg'),
  ('icca-2027', 'icca-2027.svg', 'banner', 'ICCA 2027 banner: Zhengzhou skyline, June 1-5, 2027', 'https://commons.wikimedia.org/wiki/File:Zhengdong_CBD_01.jpg'),
  ('icstcc-2026', 'icstcc-2026.jpg', 'banner', 'ICSTCC 2026 logo', 'https://icstcc.org/2026/'),
  ('icc-2027', 'icc-2027.jpg', 'banner', 'ICC Indian Control Conference logo, 11-13 Jan 2027, IIT Kharagpur', 'https://controlsociety.org/icc/'),
  ('ecc-2027', 'ecc-2027.svg', 'banner', 'ECC27 European Control Conference logo', 'https://ecc27.euca-ecc.org/'),
  ('icuas-2027', 'icuas-2027.jpg', 'banner', 'ICUAS logo', 'https://uasconferences.com/2027_icuas/'),
  ('cnca-2026', 'cnca-2026.jpg', 'banner', 'CNCA 2026 banner: Monterrey skyline line drawing, 6-9 October 2026', 'https://amca.mx/congresos/cnca2026/'),
  ('iscs-2027', 'iscs-2027.jpg', 'banner', 'ISCS 2027 banner: Meiji University, Surugadai Campus, Tokyo, March 2-5, 2027', 'https://iscs2027.sice-ctrl.jp/'),
  -- The PaperCept banner redrawn as a vector (text and IEEE logo vector, OES emblem from ieeeoes.org).
  ('ieee-joe', 'ieee-joe.svg', 'banner', 'IEEE Journal of Oceanic Engineering (JOE) banner with the IEEE Oceanic Engineering Society and IEEE logos', 'https://controls.papercept.net/conferences/scripts/start.pl'),
  ('icarcv-2026', 'icarcv-2026.jpg', 'cover', 'Sunset over the limestone islands of Ha Long Bay', 'https://www.carvs-icarcv.org/'),
  ('adconip-2026', 'adconip-2026.jpg', 'cover', 'Auckland Harbour Bridge and the city skyline at dusk', 'https://www.adconip2026.org/'),
  ('icuas-euam', 'icuas-euam.jpg', 'cover', 'An unmanned aircraft flying above the clouds', 'https://icuas.com/euam')
)
update venues v
set details = jsonb_set(v.details, '{cover}', jsonb_build_object(
  'url', '/venue-covers/' || c.file,
  'alt', c.alt,
  'fit', c.fit,
  'focus', 'center',
  'credit', case when c.site like 'https://commons.wikimedia.org/%' then 'Banner after PaperCept; photo CC BY-SA 4.0, via Wikimedia Commons' else 'Image from the event website' end,
  'creditUrl', c.site))
from c
where v.slug = c.slug;
