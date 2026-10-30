-- CoDIT 2027: the sharp header banner from codit2027.com (1440 × 200, empty left margin cropped off), served from
-- public/venue-covers/codit-2027.jpg in place of the low-resolution PaperCept thumbnail. fit = banner: shown whole at its own shape.
update venues set details = jsonb_set(details, '{cover}', jsonb_build_object(
  'url', '/venue-covers/codit-2027.jpg',
  'alt', 'CoDIT 2027 banner: Mallorca coast, July 8-11, 2027',
  'fit', 'banner',
  'focus', 'center',
  'credit', 'Banner from codit2027.com',
  'creditUrl', 'https://codit2027.com/'))
where slug = 'codit-2027';

-- The event page header uses a photo of the Mallorca coast (the banner stays on the event cards).
update venues set details = jsonb_set(details, '{cover,hero}', '"/venue-covers/codit-2027-hero.jpg"') where slug = 'codit-2027';
