-- ============================================================================
-- Night Shield — seed data
--
-- Mirrors src/services/seed.ts so a Supabase project shows the same Tilburg as
-- the local provider.
--
-- Safe to re-run. Content rows key off the unique indexes declared in
-- 0001_schema.sql (installations.title, third_spaces.name, routes.title,
-- events(title, start_time)); the generated safety reports are guarded by a
-- NOT EXISTS instead, since they have nothing unique to conflict on.
--
-- Event times are written as Europe/Amsterdam wall-clock, not the server's
-- session timezone, so "19:00" means 19:00 in Tilburg wherever this is run.
--
-- Photos are real, freely-licensed Wikimedia Commons photographs of the actual
-- places. Check each file's attribution requirements before public launch.
-- ============================================================================

-- Helper so the coordinates below read as (lat, lng) like everywhere else.
create or replace function pg_temp.pt(lat double precision, lng double precision)
returns geography(point, 4326)
language sql
immutable
as $$ select st_setsrid(st_makepoint(lng, lat), 4326)::geography $$;

-- ---------------------------------------------------------------------------
-- Installations
-- ---------------------------------------------------------------------------

insert into public.installations
  (title, artist, description, location, address, images, category, is_temporary,
   accessibility, moderation_status)
values
  (
    'The Loom Wall', 'Sanne de Wit',
    'A ten-metre weaving painted across the old depot wall, lit from below after dusk. The pattern is taken from a 1920s Tilburg textile sample book.',
    pg_temp.pt(51.5606, 5.0803), 'Burgemeester Brokxlaan 1000, Spoorzone',
    array['https://commons.wikimedia.org/wiki/Special:FilePath/Spoorzone%20tilburg%20AVS%209329.jpg?width=900',
          'https://commons.wikimedia.org/wiki/Special:FilePath/Spoorzone%20Tilburg%202018%202.jpg?width=900',
          'https://commons.wikimedia.org/wiki/Special:FilePath/Gebouw%2088.jpg?width=900'],
    'mural', false, array['wheelchair', 'well_lit', 'step_free'], 'approved'
  ),
  (
    'Harbour Signals', 'Collectief Nachtlicht',
    'Twelve buoys along the quay pulse slowly in teal and pink. They brighten when someone walks past — the harbour notices you.',
    pg_temp.pt(51.5495, 5.0995), 'Piushaven kade, Tilburg',
    array['https://commons.wikimedia.org/wiki/Special:FilePath/De%20Piushaven%20in%20Tilburg%20in%202019.jpg?width=900',
          'https://commons.wikimedia.org/wiki/Special:FilePath/De%20Piushaven%20in%20de%20zomer%20van%202020.jpg?width=900'],
    'light', true, array['wheelchair', 'well_lit'], 'approved'
  ),
  (
    'Everyone Is From Somewhere', 'Rui Ferreira & buurtgroep Dwaalgebied',
    'A portrait mural made with sixty residents of the Dwaalgebied. Each face was photographed on the street it looks onto.',
    pg_temp.pt(51.5580, 5.0870), 'Willem II-straat, Dwaalgebied',
    array['https://commons.wikimedia.org/wiki/Special:FilePath/2108%20Tilburg%20-%20Centrum%20039-%20Jan%20Geerling.jpg?width=900',
          'https://commons.wikimedia.org/wiki/Special:FilePath/2109%20Tilburg%20-%20Centrum%20136-%20Jan%20Geerling.jpg?width=900'],
    'mural', false, array['wheelchair', 'step_free'], 'approved'
  ),
  (
    'Hall of Fame — open wall', 'Rotating',
    'A legal graffiti wall repainted almost weekly. Bring your own cans; the wall is yours between sunrise and sunset.',
    pg_temp.pt(51.5710, 5.0680), 'Quirijnstokstraat, Tilburg-Noord',
    array['https://commons.wikimedia.org/wiki/Special:FilePath/Graffiti%20on%20factory%20wall%2C%20Locksbrook%20-%20geograph.org.uk%20-%201310262.jpg?width=900',
          'https://commons.wikimedia.org/wiki/Special:FilePath/Artist%20spray%20painting%20flowers%20(Unsplash).jpg?width=900',
          'https://commons.wikimedia.org/wiki/Special:FilePath/Space%20Invaders%20and%20spray%20can%20mosaic%20graffiti%20in%20Paris.jpg?width=900'],
    'graffiti', false, array['parking'], 'approved'
  ),
  (
    'Quiet Grove', 'Mieke Bosch',
    'A sound installation in the park: eight speakers hidden in the trees play recordings of the Leij stream as it sounded before it was culverted.',
    pg_temp.pt(51.5462, 5.0929), 'Leijpark, Tilburg',
    array['https://commons.wikimedia.org/wiki/Special:FilePath/Leijpark%201%2C%20Tilburg.jpg?width=900'],
    'sound', true, array['quiet', 'wheelchair', 'pet_friendly'], 'approved'
  ),
  (
    'Overhead', 'Studio Kuipers',
    'Mirrored panels under the station canopy that catch the platform lights. Best seen from the bicycle ramp at night.',
    pg_temp.pt(51.5606, 5.0836), 'Tilburg Centraal, Spoorlaan',
    array['https://commons.wikimedia.org/wiki/Special:FilePath/Tilburg%20Centraal%20Station%20Mosaicpanelen%202.jpg?width=900',
          'https://commons.wikimedia.org/wiki/Special:FilePath/Tilburg%20Centraal%20Station%20Mosaicpaneel%201.jpg?width=900'],
    'sculpture', false,
    array['wheelchair', 'well_lit', 'step_free', 'hearing_loop'], 'approved'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Third spaces
-- ---------------------------------------------------------------------------

insert into public.third_spaces
  (name, type, description, location, address, hours_open, cost, accessibility, image_url)
values
  (
    'LocHal Library', 'library',
    'A converted locomotive hall. Free to sit, work and read; the ground-floor café stays open late on Thursdays.',
    pg_temp.pt(51.5609, 5.0797), 'Burgemeester Brokxlaan 1000',
    'Mon–Fri 08:00–22:00 · Sat–Sun 10:00–18:00', 'Free',
    array['wheelchair', 'quiet', 'step_free', 'hearing_loop', 'gender_neutral_toilets'],
    'https://commons.wikimedia.org/wiki/Special:FilePath/LocHal%2020190606%20-%2001.jpg?width=900'
  ),
  (
    'Café de Werkplaats', 'cafe',
    'Neighbourhood café run by volunteers. Coffee is €1, nobody minds how long you stay, and there is always someone to talk to.',
    pg_temp.pt(51.5688, 5.0731), 'Wagnerplein 12, Tilburg-Noord',
    'Tue–Sat 10:00–23:00', 'Under €5',
    array['wheelchair', 'pet_friendly', 'step_free'],
    'https://commons.wikimedia.org/wiki/Special:FilePath/Heuvel%20(Tilburg)%20029copy1.jpg?width=900'
  ),
  (
    'Wilhelminapark', 'park',
    'The oldest park in the city. Lit paths on the north side, benches facing the bandstand, busy until late in summer.',
    pg_temp.pt(51.5643, 5.0790), 'Wilhelminapark, Tilburg',
    'Always open', 'Free',
    array['wheelchair', 'pet_friendly', 'well_lit'],
    'https://commons.wikimedia.org/wiki/Special:FilePath/Vijver%20Wilhelminapark%20(Tilburg).jpg?width=900'
  ),
  (
    'Veemarkt Studios', 'studio',
    'Shared maker space in the Veemarktkwartier. Drop-in evenings on Wednesdays — sewing machines, a laser cutter and a very loud kettle.',
    pg_temp.pt(51.5590, 5.0895), 'Veemarktstraat 44',
    'Wed 18:00–22:00 drop-in · otherwise by arrangement', '€5 per evening',
    array['wheelchair', 'step_free'],
    'https://commons.wikimedia.org/wiki/Special:FilePath/Textielmuseum%20Tilburg%20editathon%202.jpg?width=900'
  ),
  (
    'Buurthuis De Symfonie', 'community_centre',
    'Community centre with a warm room in winter, language café on Tuesdays and a games night that welcomes newcomers.',
    pg_temp.pt(51.5622, 5.0069), 'Eilenbergstraat 250, Reeshof',
    'Mon–Fri 09:00–21:00', 'Free',
    array['wheelchair', 'quiet', 'hearing_loop', 'service_animal', 'step_free'],
    'https://commons.wikimedia.org/wiki/Special:FilePath/Drieburcht%2C%20renovatie%20Wagnerplein%20Tilburg%201.jpg?width=900'
  ),
  (
    'Kiosk Piushaven', 'cafe',
    'Waterside kiosk with outdoor heaters. Stays open while the harbour lights are on, which is most of the year.',
    pg_temp.pt(51.5503, 5.0978), 'Piushaven 1',
    'Daily 11:00–00:00', 'Under €10',
    array['wheelchair', 'well_lit', 'pet_friendly'],
    'https://commons.wikimedia.org/wiki/Special:FilePath/De%20Havenmeester%20Tilburg.jpg?width=900'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Routes
-- ---------------------------------------------------------------------------

insert into public.routes
  (title, description, type, distance_km, estimated_time_minutes,
   start_location, end_location, stops, accessibility, moderation_status)
values
  (
    'The Lit Way Home',
    'Station to Piushaven along streets that stay lit and busy after midnight. Built from three years of resident reports.',
    'safe', 2.4, 32,
    pg_temp.pt(51.5606, 5.0836), pg_temp.pt(51.5503, 5.0978),
    '[
      {"order":1,"title":"Tilburg Centraal — south exit","note":"Start at the taxi rank. Staff on the platform until 01:00.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Station%20Tilburg%202025%209.jpg?width=900","location":{"latitude":51.5606,"longitude":5.0836}},
      {"order":2,"title":"Spoorlaan","note":"Wide pavement, continuous lighting, night bus stop halfway.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Spoorzone%20Tilburg%202023.jpg?width=900","location":{"latitude":51.5598,"longitude":5.0868}},
      {"order":3,"title":"Stadhuisplein","note":"Open square, people around until late. Public toilets on the east side.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Stadhuisplein%2C%20Tilburg%20P1170101.jpg?width=900","location":{"latitude":51.5595,"longitude":5.0890}},
      {"order":4,"title":"Piushavenlaan","note":"Quieter, but the harbour lights start here and the kiosk is open.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Piushaven%20Tilburg%20Welkom%20(01).jpg?width=900","location":{"latitude":51.5545,"longitude":5.0942}},
      {"order":5,"title":"Piushaven kade","note":"You have arrived. Benches, water, and the Harbour Signals installation.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/De%20Piushaven%20in%20Tilburg%20in%202019.jpg?width=900","location":{"latitude":51.5503,"longitude":5.0978}}
    ]'::jsonb,
    array['wheelchair', 'well_lit', 'step_free'], 'approved'
  ),
  (
    'Dwaalgebied Art Walk',
    'An hour through the wandering quarter: murals, galleries with lit windows, and two courtyards most people walk straight past.',
    'art_walk', 1.8, 55,
    pg_temp.pt(51.5565, 5.0770), pg_temp.pt(51.5590, 5.0895),
    '[
      {"order":1,"title":"Koningsplein","note":"Meet at the fountain. Pick up a paper map from the kiosk if you want one.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Koningsplein%2C%20Tilburg%20050copy.jpg?width=900","location":{"latitude":51.5565,"longitude":5.0770}},
      {"order":2,"title":"Everyone Is From Somewhere","note":"Sixty neighbours, one wall. Look for your own street in the background.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/2108%20Tilburg%20-%20Centrum%20040-%20Jan%20Geerling.jpg?width=900","location":{"latitude":51.5580,"longitude":5.0870}},
      {"order":3,"title":"Willem II-straat galleries","note":"Six ground-floor studios. Lights stay on until 23:00 even when closed.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Willem%20II%20Straat%20Tilburg%20P1170079.jpg?width=900","location":{"latitude":51.5590,"longitude":5.0880}},
      {"order":4,"title":"Veemarktkwartier courtyard","note":"Through the archway. Studios, a bar, and usually someone rehearsing.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Tilburg%20textielmuseum1.jpg?width=900","location":{"latitude":51.5590,"longitude":5.0895}}
    ]'::jsonb,
    array['wheelchair', 'step_free'], 'approved'
  ),
  (
    'North of the Tracks',
    'For people who like not knowing what is next. Crosses into Tilburg-Noord, ends at the open graffiti wall.',
    'exploration', 3.6, 70,
    pg_temp.pt(51.5609, 5.0797), pg_temp.pt(51.5710, 5.0680),
    '[
      {"order":1,"title":"LocHal","note":"Start warm. Grab a coffee, then out the north doors.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/LocHal%2020190606%20-%2006.jpg?width=900","location":{"latitude":51.5609,"longitude":5.0797}},
      {"order":2,"title":"Spoorpark","note":"Cut across the lawn. The water tower is the landmark to aim for.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Spoorpark%20(Tilburg)%20016.jpg?width=900","location":{"latitude":51.5652,"longitude":5.0742}},
      {"order":3,"title":"Wagnerplein","note":"Market square. Café de Werkplaats is on the corner if you need a break.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Bravo%20bushalte%20wagnerplein%20in%20Tilburg.jpg?width=900","location":{"latitude":51.5688,"longitude":5.0731}},
      {"order":4,"title":"Hall of Fame","note":"The wall changes every week. Photograph it — it will not look like this again.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Buitenmuur.jpg?width=900","location":{"latitude":51.5710,"longitude":5.0680}}
    ]'::jsonb,
    array['pet_friendly'], 'approved'
  ),
  (
    'The Quiet Green',
    'A low-stimulation loop through two parks. Step-free the whole way, benches every 200 metres, no through traffic.',
    'safe', 2.1, 40,
    pg_temp.pt(51.5643, 5.0790), pg_temp.pt(51.5643, 5.0790),
    '[
      {"order":1,"title":"Wilhelminapark bandstand","note":"Benches face away from the road. Good place to wait for someone.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Wilhelminapark%2063%2C%20Tilburg%20RM.jpg?width=900","location":{"latitude":51.5643,"longitude":5.0790}},
      {"order":2,"title":"Spoorpark lake","note":"Flat path all the way round. Toilets by the pavilion.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Spoorpark%20(Tilburg)%20018.jpg?width=900","location":{"latitude":51.5652,"longitude":5.0742}},
      {"order":3,"title":"Back through the rose garden","note":"Quietest stretch of the loop, lit but not bright.","image_url":"https://commons.wikimedia.org/wiki/Special:FilePath/Vijver%20Wilhelminapark%20(Tilburg).jpg?width=900","location":{"latitude":51.5648,"longitude":5.0776}}
    ]'::jsonb,
    array['wheelchair', 'quiet', 'step_free', 'pet_friendly'], 'approved'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Events
--
-- Times are relative to when the seed runs so the calendar is never empty.
-- ---------------------------------------------------------------------------

insert into public.events
  (title, description, category, location, address, start_time, end_time,
   capacity, cost_euros, organizer_name, image_url, accessibility,
   is_virtual, virtual_url, is_featured)
values
  (
    'Screenprint your own patch',
    'Bring a jacket, leave with a patch. All materials provided, no experience needed.',
    'workshop', pg_temp.pt(51.5590, 5.0895), 'Veemarktstraat 44',
    ((current_date + 2) + time '19:00') at time zone 'Europe/Amsterdam', ((current_date + 2) + time '21:30') at time zone 'Europe/Amsterdam',
    16, 5, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Taller%20de%20serigraf%C3%ADa%20-%20La%20Ermita%201.jpg?width=900',
    array['wheelchair', 'step_free'], false, null, true
  ),
  (
    'Night walk: The Lit Way Home',
    'We walk the safe route together, then talk about what makes a street feel walkable.',
    'social', pg_temp.pt(51.5606, 5.0836), 'Tilburg Centraal, south exit',
    ((current_date + 4) + time '20:30') at time zone 'Europe/Amsterdam', ((current_date + 4) + time '22:00') at time zone 'Europe/Amsterdam',
    30, 0, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Pedestrian%20crossing%20at%20night%2C%20Redland%20-%20geograph.org.uk%20-%206034970.jpg?width=900',
    array['wheelchair', 'well_lit', 'step_free', 'service_animal'], false, null, true
  ),
  (
    'Artist talk: Sanne de Wit on The Loom Wall',
    'How a 1920s sample book became a ten-metre wall. Followed by questions and a walk to the piece itself.',
    'art_talk', pg_temp.pt(51.5609, 5.0797), 'LocHal, Stadszaal',
    ((current_date + 7) + time '19:30') at time zone 'Europe/Amsterdam', ((current_date + 7) + time '21:00') at time zone 'Europe/Amsterdam',
    60, 0, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/LocHal%2020190606%20-%2011.jpg?width=900',
    array['wheelchair', 'hearing_loop', 'step_free', 'quiet'], false, null, true
  ),
  (
    'Late opening — Kiosk Piushaven',
    'The harbour stays lit until 02:00 with a DJ on the terrace. Free entry, drinks at normal prices.',
    'nightlife', pg_temp.pt(51.5503, 5.0978), 'Piushaven 1',
    ((current_date + 5) + time '22:00') at time zone 'Europe/Amsterdam', ((current_date + 6) + time '02:00') at time zone 'Europe/Amsterdam',
    150, 0, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/De%20Havenmeester%20Tilburg.jpg?width=900',
    array['wheelchair', 'well_lit'], false, null, false
  ),
  (
    'Language café',
    'Practise Dutch, English, Arabic or Tigrinya over tea. Come as a learner or a speaker, both are needed.',
    'social', pg_temp.pt(51.5622, 5.0069), 'Buurthuis De Symfonie, Reeshof',
    ((current_date + 1) + time '19:00') at time zone 'Europe/Amsterdam', ((current_date + 1) + time '21:00') at time zone 'Europe/Amsterdam',
    40, 0, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Booksa%20-%20Workshop%20of%20creative%20writing%20of%20short%20stories%2055%2B.jpg?width=900',
    array['wheelchair', 'quiet', 'hearing_loop', 'service_animal'], false, null, false
  ),
  (
    'Online: map your own safe route',
    'A one-hour call where we build a personal route together and add it to Night Shield. Join from anywhere.',
    'workshop', null, null,
    ((current_date + 9) + time '18:00') at time zone 'Europe/Amsterdam', ((current_date + 9) + time '19:00') at time zone 'Europe/Amsterdam',
    25, 0, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Spoorpark%20(Tilburg)%20006.jpg?width=900',
    array['hearing_loop', 'quiet'], true,
    'https://meet.example.org/night-shield-mapping', false
  ),
  (
    'Zine night: writing the city',
    'We made a twenty-page zine in one evening. Copies are in the LocHal reading room.',
    'workshop', pg_temp.pt(51.5609, 5.0797), 'LocHal, Kennismakerij',
    ((current_date - 6) + time '19:00') at time zone 'Europe/Amsterdam', ((current_date - 6) + time '22:00') at time zone 'Europe/Amsterdam',
    20, 3, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Zine%20Making%203.jpg?width=900',
    array['wheelchair', 'quiet', 'step_free'], false, null, false
  )
on conflict do nothing;

-- ---- generated: season events (start) ----
-- ---------------------------------------------------------------------------
-- Season events, mid-October to New Year's Eve 2026
--
-- Same rows as the season() block in src/services/seed.ts, generated from one
-- list so the two backends agree. Unlike the events above these are fixed
-- dates, not relative to when the seed runs: Halloween, Sinterklaas and New
-- Year's Eve only make sense on their own days. All are example content (the
-- local provider shows them with an "Example" badge; this schema has no
-- is_example column).
-- ---------------------------------------------------------------------------

insert into public.events
  (title, description, category, location, address, start_time, end_time,
   capacity, cost_euros, organizer_name, image_url, accessibility,
   is_virtual, virtual_url, is_featured, attendance_code)
values
  (
    'Life drawing for beginners',
    'Draw a clothed model in short poses, from one minute to twenty. Paper and charcoal are on the table, and nobody looks at your drawing unless you want them to. No experience needed.',
    'workshop', pg_temp.pt(51.5590, 5.0895), 'Veemarkt Studios, Veemarktstraat 62',
    timestamp '2026-10-14 19:30' at time zone 'Europe/Amsterdam', timestamp '2026-10-14 21:30' at time zone 'Europe/Amsterdam',
    18, 3, 'Veemarkt Studios',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Textielmuseum%20Tilburg%20editathon%202.jpg?width=900',
    array['wheelchair', 'step_free', 'quiet'], false, null, false, 'DRAWIN14'
  ),
  (
    'Art walk: murals after dark',
    'A guided walk past the big walls of the Spoorzone, with a stop at each one to hear who painted it and why. The route stays on lit streets. About ninety minutes at an easy pace.',
    'art_talk', pg_temp.pt(51.5609, 5.0797), 'LocHal, main entrance',
    timestamp '2026-10-17 20:00' at time zone 'Europe/Amsterdam', timestamp '2026-10-17 21:30' at time zone 'Europe/Amsterdam',
    30, 0, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Riverside%20Skatepark%20Micro%20Mini%20Ramp%2020180505.jpg?width=900',
    array['wheelchair', 'step_free', 'well_lit', 'service_animal'], false, null, false, 'MURALW17'
  ),
  (
    'Open mic: poetry and spoken word',
    'Five minutes on the stage, in any language. Read from your phone, from paper or from memory. Sign up at the door; people who have never performed go first.',
    'art_talk', pg_temp.pt(51.5590, 5.0895), 'Veemarkt Studios, Veemarktstraat 62',
    timestamp '2026-10-21 20:00' at time zone 'Europe/Amsterdam', timestamp '2026-10-21 22:30' at time zone 'Europe/Amsterdam',
    60, 0, 'Veemarkt Studios',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Open%20Mic%20Night%20(62617955).jpeg?width=900',
    array['wheelchair', 'step_free', 'hearing_loop'], false, null, false, 'POETRY21'
  ),
  (
    'Club night: Veemarkt Late',
    'House and disco until two. Free water at the bar and a quiet room upstairs if you need a break. Getting home: night bus times are on a board at the door, a staffed taxi point runs until closing, and there is a lift-share board for people going the same way. The awareness team wears purple and you can find them all night.',
    'nightlife', pg_temp.pt(51.5590, 5.0895), 'Veemarktkwartier, courtyard studio',
    timestamp '2026-10-24 22:00' at time zone 'Europe/Amsterdam', timestamp '2026-10-25 02:00' at time zone 'Europe/Amsterdam',
    250, 8, 'Veemarkt Studios',
    'https://commons.wikimedia.org/wiki/Special:FilePath/De%20Havenmeester%20Tilburg.jpg?width=900',
    array['wheelchair', 'well_lit', 'gender_neutral_toilets'], false, null, false, 'VMLATE24'
  ),
  (
    'Repair Café: coats and bike lights',
    'The clocks go back today, so bring the bike light that stopped working and the coat with the broken zip. Volunteers show you how to fix them. Free.',
    'workshop', pg_temp.pt(51.5648, 5.0776), 'Buurthuis De Symfonie, Eilenbergstraat 250',
    timestamp '2026-10-25 14:00' at time zone 'Europe/Amsterdam', timestamp '2026-10-25 17:00' at time zone 'Europe/Amsterdam',
    null, 0, 'Buurthuis De Symfonie',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Bike%20workshop%20-%20bicycle%20repair%20shop.jpg?width=900',
    array['wheelchair', 'step_free', 'hearing_loop', 'service_animal'], false, null, false, 'LIGHTS25'
  ),
  (
    'Pumpkin lantern workshop',
    'Carve a pumpkin lantern for Halloween. We have the pumpkins, the tools and the candles. Lanterns can stay at the café for the weekend so the square glows.',
    'workshop', pg_temp.pt(51.5688, 5.0731), 'Café de Werkplaats, Wagnerplein 12',
    timestamp '2026-10-28 19:00' at time zone 'Europe/Amsterdam', timestamp '2026-10-28 21:30' at time zone 'Europe/Amsterdam',
    24, 2, 'Café de Werkplaats',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Heuvel%20(Tilburg)%20029copy1.jpg?width=900',
    array['wheelchair', 'step_free', 'pet_friendly'], false, null, false, 'CARVEP28'
  ),
  (
    'Halloween night: costumes optional',
    'Dress up or come as you are. A costume is never an invitation: ask before you touch anyone. Quiet room, free water, and no masks at the bar. Getting home: night bus times are on a board at the door, a staffed taxi point runs until closing, and there is a lift-share board for people going the same way. The awareness team wears purple and you can find them all night.',
    'nightlife', pg_temp.pt(51.5590, 5.0895), 'Veemarkt Studios, Veemarktstraat 62',
    timestamp '2026-10-31 21:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-01 01:00' at time zone 'Europe/Amsterdam',
    200, 5, 'Veemarkt Studios',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Heuvel%20(Tilburg)%20032copy3.jpg?width=900',
    array['wheelchair', 'step_free', 'gender_neutral_toilets', 'well_lit'], false, null, false, 'SPOOKY31'
  ),
  (
    'Slow walk: autumn in the Wilhelminapark',
    'A slow walk round the park after the Halloween weekend. No goal and no speed: we stop to look at the trees, then end with tea at the bandstand.',
    'social', pg_temp.pt(51.5643, 5.0790), 'Wilhelminapark, by the bandstand',
    timestamp '2026-11-01 15:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-01 17:00' at time zone 'Europe/Amsterdam',
    null, 0, 'Spoorpark vrijwilligers',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Vijver%20Wilhelminapark%20(Tilburg).jpg?width=900',
    array['wheelchair', 'step_free', 'pet_friendly', 'quiet'], false, null, false, 'AUTUMN01'
  ),
  (
    'Workshop: boundaries and saying no',
    'A calm, practical evening on setting boundaries on a night out: how to say no clearly, how to help a friend, and who to call. No physical contact, and you can watch instead of taking part.',
    'workshop', pg_temp.pt(51.5609, 5.0797), 'LocHal, Kennismakerij',
    timestamp '2026-11-04 19:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-04 21:00' at time zone 'Europe/Amsterdam',
    20, 0, 'Inclusivity Department',
    'https://commons.wikimedia.org/wiki/Special:FilePath/LocHal%2020190606%20-%2012.jpg?width=900',
    array['wheelchair', 'step_free', 'quiet', 'hearing_loop', 'gender_neutral_toilets'], false, null, false, 'BOUNDS04'
  ),
  (
    'Silent disco in the LocHal',
    'Three channels on the headphones: pop, techno and a low-volume chill channel. Turn it down whenever you like. Headphones are cleaned between every guest.',
    'nightlife', pg_temp.pt(51.5609, 5.0797), 'LocHal, Stadszaal',
    timestamp '2026-11-07 21:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-08 00:30' at time zone 'Europe/Amsterdam',
    150, 6, 'LocHal',
    'https://commons.wikimedia.org/wiki/Special:FilePath/LocHal%2020190606%20-%2001.jpg?width=900',
    array['wheelchair', 'step_free', 'quiet', 'hearing_loop'], false, null, false, 'SILENT07'
  ),
  (
    'Sint-Maarten lantern walk for grown-ups',
    'On Sint-Maarten, children walk with lanterns and sing at doors. This is the grown-up version: a short lantern walk through the Spoorpark, with soup at the end. Lanterns to borrow.',
    'social', pg_temp.pt(51.5652, 5.0742), 'Spoorpark pavilion',
    timestamp '2026-11-11 19:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-11 20:30' at time zone 'Europe/Amsterdam',
    40, 0, 'Spoorpark vrijwilligers',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Walk%20in%20the%20park%20(50663291701).jpg?width=900',
    array['wheelchair', 'step_free', 'well_lit', 'pet_friendly'], false, null, false, 'MAARTE11'
  ),
  (
    'Artist talk: painting at night',
    'Three street artists talk about working after dark: light, safety, permits, and the neighbours who bring coffee. Thirty minutes each, then questions.',
    'art_talk', pg_temp.pt(51.5590, 5.0895), 'Veemarkt Studios, Veemarktstraat 62',
    timestamp '2026-11-13 20:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-13 22:00' at time zone 'Europe/Amsterdam',
    60, 0, 'Inclusivity Department',
    'https://commons.wikimedia.org/wiki/Special:FilePath/LocHal%2020190606%20-%2011.jpg?width=900',
    array['wheelchair', 'step_free', 'hearing_loop'], false, null, false, 'PAINTN13'
  ),
  (
    'Zine afternoon: the city at night',
    'Make a page for a shared zine about Tilburg after dark: a drawing, a poem, a map of your way home. Everyone gets a printed copy at the end.',
    'workshop', pg_temp.pt(51.5609, 5.0797), 'LocHal, Kennismakerij',
    timestamp '2026-11-15 14:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-15 16:30' at time zone 'Europe/Amsterdam',
    20, 3, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Zine%20Making%203.jpg?width=900',
    array['wheelchair', 'quiet', 'step_free'], false, null, false, 'ZINEAF15'
  ),
  (
    'Board game night: co-op games only',
    'Everyone wins or everyone loses together. Good for a first visit, because nobody has to beat anybody. Hosts explain every game.',
    'social', pg_temp.pt(51.5688, 5.0731), 'Café de Werkplaats, Wagnerplein 12',
    timestamp '2026-11-18 19:30' at time zone 'Europe/Amsterdam', timestamp '2026-11-18 22:30' at time zone 'Europe/Amsterdam',
    null, 0, 'Café de Werkplaats',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Family%20Board%20Game%20Night-U.S.%20Army%20Garrison%20Humphreys%2C%20South%20Korea%20-%2018%20September%202014%20(15098350338).jpg?width=900',
    array['wheelchair', 'step_free', 'quiet', 'pet_friendly'], false, null, false, 'COOPGA18'
  ),
  (
    'Hall of Fame night: hip-hop and skate',
    'DJs, a cypher for anyone who wants the mic, and the skate bowl open until midnight. Helmets to borrow. Getting home: night bus times are on a board at the door, a staffed taxi point runs until closing, and there is a lift-share board for people going the same way. The awareness team wears purple and you can find them all night.',
    'nightlife', pg_temp.pt(51.5710, 5.0680), 'Hall of Fame, Quirijnstokstraat',
    timestamp '2026-11-21 21:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-22 01:00' at time zone 'Europe/Amsterdam',
    300, 7, 'Hall of Fame collective',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Riverside%20Skatepark%20Micro%20Mini%20Ramp%2020180505.jpg?width=900',
    array['parking', 'well_lit'], false, null, false, 'HALLFA21'
  ),
  (
    'Night walk: which streets feel safe, and why',
    'On the international day against violence towards women, we walk a safe route together and note what helps: light, people, open doors. Your notes go to the municipality.',
    'social', pg_temp.pt(51.5606, 5.0836), 'Tilburg Centraal, south exit',
    timestamp '2026-11-25 19:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-25 21:00' at time zone 'Europe/Amsterdam',
    40, 0, 'Inclusivity Department',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Pedestrian%20crossing%20at%20night%2C%20Redland%20-%20geograph.org.uk%20-%206034970.jpg?width=900',
    array['wheelchair', 'step_free', 'well_lit', 'service_animal'], false, null, false, 'ORANGE25'
  ),
  (
    'Craft market: made in Tilburg',
    'Twenty makers sell prints, ceramics, zines and knitwear. Every stall shows its prices, and there is a table where you can swap instead of buy.',
    'social', pg_temp.pt(51.5590, 5.0895), 'Veemarktkwartier, courtyard studio',
    timestamp '2026-11-28 14:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-28 18:00' at time zone 'Europe/Amsterdam',
    null, 0, 'Veemarkt Studios',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Textielmuseum%20Tilburg%20editathon%202.jpg?width=900',
    array['wheelchair', 'step_free', 'pet_friendly'], false, null, false, 'CRAFTM28'
  ),
  (
    'Write a Sinterklaas poem',
    'In the Netherlands, a Sinterklaas present comes with a funny rhyming poem. Learn how to write one, in Dutch or English. Good for anyone celebrating for the first time.',
    'workshop', pg_temp.pt(51.5609, 5.0797), 'LocHal, Kennismakerij',
    timestamp '2026-11-29 15:00' at time zone 'Europe/Amsterdam', timestamp '2026-11-29 17:00' at time zone 'Europe/Amsterdam',
    25, 0, 'LocHal',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Booksa%20-%20Workshop%20of%20creative%20writing%20of%20short%20stories%2055%2B.jpg?width=900',
    array['wheelchair', 'quiet', 'step_free', 'hearing_loop'], false, null, false, 'GEDICH29'
  ),
  (
    'Build a Sinterklaas surprise',
    'A "surprise" is a present hidden inside something homemade: a giant shoe, a cardboard bike, a tiny Tilburg. Bring cardboard; we bring glue, paint and ideas.',
    'workshop', pg_temp.pt(51.5688, 5.0731), 'Café de Werkplaats, Wagnerplein 12',
    timestamp '2026-12-02 19:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-02 21:30' at time zone 'Europe/Amsterdam',
    20, 2, 'Café de Werkplaats',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Taller%20de%20serigraf%C3%ADa%20-%20La%20Ermita%201.jpg?width=900',
    array['wheelchair', 'step_free'], false, null, false, 'SURPRI02'
  ),
  (
    'Pakjesavond for people far from home',
    'Sinterklaas evening for international students and anyone without family nearby. Dinner, a small present game with a five-euro limit, and pepernoten. Pay what you can.',
    'social', pg_temp.pt(51.5648, 5.0776), 'Buurthuis De Symfonie, Eilenbergstraat 250',
    timestamp '2026-12-05 18:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-05 21:00' at time zone 'Europe/Amsterdam',
    50, 0, 'Buurthuis De Symfonie',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Heartsite%20Community%20Meal.png?width=900',
    array['wheelchair', 'step_free', 'hearing_loop', 'service_animal', 'quiet'], false, null, false, 'PAKJES05'
  ),
  (
    'Open mic: winter songs',
    'Bring a winter song, in any language and any style. There is a guitar and a keyboard on stage. First-timers are welcome, and the room is kind.',
    'art_talk', pg_temp.pt(51.5590, 5.0895), 'Veemarkt Studios, Veemarktstraat 62',
    timestamp '2026-12-09 19:30' at time zone 'Europe/Amsterdam', timestamp '2026-12-09 21:30' at time zone 'Europe/Amsterdam',
    60, 0, 'Veemarkt Studios',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Open%20Mic%20Night%20(62617955).jpeg?width=900',
    array['wheelchair', 'step_free', 'hearing_loop'], false, null, false, 'WINTER09'
  ),
  (
    'Winter market in the Spoorpark',
    'Stalls with warm food, mulled wine and alcohol-free punch, under the lights around the pavilion. The paths are lit and flat. Free to walk around.',
    'social', pg_temp.pt(51.5652, 5.0742), 'Spoorpark pavilion',
    timestamp '2026-12-11 17:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-11 22:00' at time zone 'Europe/Amsterdam',
    null, 0, 'Spoorpark vrijwilligers',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Walk%20in%20the%20park%20(50663291701).jpg?width=900',
    array['wheelchair', 'step_free', 'well_lit', 'pet_friendly'], false, null, false, 'MARKET11'
  ),
  (
    'Club night: Winter Warm-up',
    'Disco, funk and Dutch classics until two. Coats go in a free cloakroom, and there is a quiet corner with seats. Getting home: night bus times are on a board at the door, a staffed taxi point runs until closing, and there is a lift-share board for people going the same way. The awareness team wears purple and you can find them all night.',
    'nightlife', pg_temp.pt(51.5590, 5.0895), 'Veemarktkwartier, courtyard studio',
    timestamp '2026-12-12 22:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-13 02:00' at time zone 'Europe/Amsterdam',
    250, 8, 'Veemarkt Studios',
    'https://commons.wikimedia.org/wiki/Special:FilePath/De%20Havenmeester%20Tilburg.jpg?width=900',
    array['wheelchair', 'well_lit', 'gender_neutral_toilets'], false, null, false, 'WARMUP12'
  ),
  (
    'Make a winter wreath',
    'Make a wreath from branches cut in the park during autumn pruning. Everything is provided, and you take the wreath home.',
    'workshop', pg_temp.pt(51.5648, 5.0776), 'Buurthuis De Symfonie, Eilenbergstraat 250',
    timestamp '2026-12-16 19:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-16 21:00' at time zone 'Europe/Amsterdam',
    20, 4, 'Buurthuis De Symfonie',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Drieburcht%2C%20renovatie%20Wagnerplein%20Tilburg%201.jpg?width=900',
    array['wheelchair', 'step_free', 'quiet'], false, null, false, 'WREATH16'
  ),
  (
    'Christmas lights walk to the Heuvel',
    'A short evening walk past the Christmas lights in the centre, ending at the market stalls on the Heuvel. We go together and leave together.',
    'social', pg_temp.pt(51.5588, 5.0902), 'Heuvel, by the statue',
    timestamp '2026-12-18 18:30' at time zone 'Europe/Amsterdam', timestamp '2026-12-18 20:30' at time zone 'Europe/Amsterdam',
    40, 0, 'Nadia el Amrani',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Heuvel%20(Tilburg)%20029copy1.jpg?width=900',
    array['wheelchair', 'step_free', 'well_lit', 'service_animal'], false, null, false, 'LIGHTW18'
  ),
  (
    'Queer winter social',
    'Chairs, warm drinks and a playlist kept low enough to talk. Bring a friend or come alone; a host welcomes everyone at the door.',
    'social', pg_temp.pt(51.5590, 5.0895), 'Veemarktkwartier, courtyard studio',
    timestamp '2026-12-19 20:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-19 23:00' at time zone 'Europe/Amsterdam',
    45, 0, 'Inclusivity Department',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Heuvel%20(Tilburg)%20032copy3.jpg?width=900',
    array['wheelchair', 'quiet', 'step_free', 'gender_neutral_toilets', 'service_animal'], false, null, false, 'QUEERW19'
  ),
  (
    'Study café: exam week',
    'Free coffee and tea for everyone revising, and a silent room. Plugs at every table.',
    'social', pg_temp.pt(51.5609, 5.0797), 'LocHal, Kennismakerij',
    timestamp '2026-12-22 14:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-22 17:00' at time zone 'Europe/Amsterdam',
    null, 0, 'LocHal',
    'https://commons.wikimedia.org/wiki/Special:FilePath/LocHal%2020190606%20-%2012.jpg?width=900',
    array['wheelchair', 'quiet', 'step_free', 'hearing_loop'], false, null, false, 'EXAMCA22'
  ),
  (
    'Christmas Eve dinner: nobody eats alone',
    'A long table, a warm meal and good company for anyone on their own this Christmas. Vegetarian and halal options. Pay what you can, or nothing.',
    'social', pg_temp.pt(51.5648, 5.0776), 'Buurthuis De Symfonie, Eilenbergstraat 250',
    timestamp '2026-12-24 17:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-24 21:00' at time zone 'Europe/Amsterdam',
    60, 0, 'Buurthuis De Symfonie',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Heartsite%20Community%20Meal.png?width=900',
    array['wheelchair', 'step_free', 'hearing_loop', 'service_animal', 'quiet'], false, null, false, 'XMASEV24'
  ),
  (
    'Second Christmas Day slow walk',
    'Walk off the Christmas food in the Wilhelminapark. A slow loop of about an hour, then hot chocolate at the bandstand.',
    'social', pg_temp.pt(51.5643, 5.0790), 'Wilhelminapark, by the bandstand',
    timestamp '2026-12-26 15:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-26 16:30' at time zone 'Europe/Amsterdam',
    null, 0, 'Spoorpark vrijwilligers',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Vijver%20Wilhelminapark%20(Tilburg).jpg?width=900',
    array['wheelchair', 'step_free', 'pet_friendly', 'quiet'], false, null, false, 'KERST226'
  ),
  (
    'Online: your year of safe routes',
    'An online hour to look back on 2026: which routes you walked, what felt better, and what should change next year. You need a laptop or a phone.',
    'workshop', null, null,
    timestamp '2026-12-29 19:00' at time zone 'Europe/Amsterdam', timestamp '2026-12-29 20:00' at time zone 'Europe/Amsterdam',
    40, 0, 'Inclusivity Department',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Spoorpark%20(Tilburg)%20006.jpg?width=900',
    array['hearing_loop', 'quiet'], true, 'https://meet.example.org/night-shield-year-review', false, 'REVIEW29'
  ),
  (
    'New Year''s Eve safe night at the Piushaven',
    'Count down by the water with music, free water and a heated tent to warm up. Watch the fireworks from the quay, away from the crowds. Extra night buses run after midnight, a staffed taxi point is open until 01:30, and the awareness team is there all night.',
    'nightlife', pg_temp.pt(51.5503, 5.0978), 'Piushaven 1',
    timestamp '2026-12-31 21:00' at time zone 'Europe/Amsterdam', timestamp '2027-01-01 01:30' at time zone 'Europe/Amsterdam',
    300, 0, 'Inclusivity Department',
    'https://commons.wikimedia.org/wiki/Special:FilePath/De%20Havenmeester%20Tilburg.jpg?width=900',
    array['wheelchair', 'well_lit', 'step_free'], false, null, false, 'NYESAF31'
  )
on conflict do nothing;
-- ---- generated: season events (end) ----

-- ---------------------------------------------------------------------------
-- Night Caches
--
-- `answers` lives only here and in public.caches — it is projected away by
-- caches_public, so the browser never receives it.
-- ---------------------------------------------------------------------------

insert into public.caches
  (title, hint, story, location, area, difficulty, points, image_url,
   accessibility, night_only, question, answers)
values
  (
    'The Last Rail',
    'Outside the LocHal, look down instead of up. One strip of the old depot never got lifted, and the paving was laid around it.',
    'Everything here was rails until 2009 — this was the workshop where the national fleet came to be repaired, and 1,200 people worked in the halls you are standing between. When the Spoorzone was rebuilt the planners kept exactly one rail in place, flush with the pavement, as a full-size footnote. Stand on it and you are standing where a locomotive stood.',
    pg_temp.pt(51.5607, 5.0799), 'Spoorzone', 'easy', 15,
    'https://commons.wikimedia.org/wiki/Special:FilePath/Spoorzone%20tilburg%20AVS%209329.jpg?width=900',
    array['wheelchair', 'step_free', 'well_lit'], false,
    'What is set into the pavement outside the LocHal — a rail, a millstone, or a mosaic?',
    array['rail', 'a rail', 'railway', 'track', 'rails']
  ),
  (
    'The Man With The Jug',
    'Near the Heuvel, someone is permanently relieving himself into a pot. Nobody in Tilburg finds this odd. Look for the bronze.',
    'The Kruikenzeiker is Tilburg''s own self-portrait. Wool needs ammonia to fix dye, so nineteenth-century mills paid households for their urine, collected in stone jugs. An entire city''s nickname comes from that arrangement, and at carnival Tilburg renames itself Kruikenstad without a hint of embarrassment. The statue is what a city looks like when it decides its least glamorous history is the part worth casting in bronze.',
    pg_temp.pt(51.5588, 5.0902), 'Heuvel', 'easy', 15,
    'https://commons.wikimedia.org/wiki/Special:FilePath/Heuvel%20(Tilburg)%20P1050530.JPG?width=900',
    array['wheelchair', 'step_free', 'well_lit'], false,
    'What is the man in the statue holding?',
    array['a jug', 'jug', 'kruik', 'een kruik', 'pot', 'a pot']
  ),
  (
    'The Drowned Stream',
    'In the Leijpark, find the low stone kerb that runs through the grass and stops for no reason. It is not decorative.',
    'The Leij is still there — it is simply underneath you, culverted in the 1950s when a stream through a park read as untidy rather than valuable. The kerb traces the old bank. The Quiet Grove installation nearby plays recordings made before the water went under, which is the closest anyone can now get to hearing this park as it was.',
    pg_temp.pt(51.5465, 5.0933), 'Leijpark', 'medium', 25,
    'https://commons.wikimedia.org/wiki/Special:FilePath/Leijpark%202%2C%20Tilburg.jpg?width=900',
    array['wheelchair', 'quiet', 'pet_friendly'], false,
    'What runs underneath the Leijpark — a stream, a railway tunnel, or a bunker?',
    array['a stream', 'stream', 'the leij', 'leij', 'river', 'a river']
  ),
  (
    'Sixty Windows',
    'Off the Willem II-straat there is an archway most people read as private. It is not. Go through it and count the faces on the wall.',
    'The Dwaalgebied is named for wandering, and this courtyard is the reward for actually doing it. The mural was photographed street by street: every face was taken on the road it now looks out over, so the people on this wall can stand in front of their own portrait. Sixty neighbours agreed. Two more are painted from memory.',
    pg_temp.pt(51.5582, 5.0873), 'Dwaalgebied', 'medium', 25,
    'https://commons.wikimedia.org/wiki/Special:FilePath/2109%20Tilburg%20-%20Centrum%20242-%20Jan%20Geerling.jpg?width=900',
    array['wheelchair', 'step_free'], false,
    'Roughly how many residents are painted on the courtyard mural?',
    array['60', 'sixty', '60 people', 'sixty people']
  ),
  (
    'The Water Tower Bolt',
    'Spoorpark, at the foot of the tower. One of the base bolts is brass and the rest are steel. Somebody replaced it on purpose.',
    'The tower fed steam locomotives until diesel made it useless, and it stood empty for forty years while the city argued about demolishing it. It survived because residents put up their own money — Spoorpark was crowdfunded by the people who live around it, which is not how parks usually happen. The brass bolt was set by the volunteers who finished the base. It is the only signature they left.',
    pg_temp.pt(51.5654, 5.0744), 'Spoorpark', 'hard', 40,
    'https://commons.wikimedia.org/wiki/Special:FilePath/Tilburg%20watertoren.jpg?width=900',
    array['wheelchair', 'step_free', 'pet_friendly'], false,
    'What metal is the odd bolt at the base of the water tower?',
    array['brass', 'brons', 'messing']
  ),
  (
    'Ring Number Four',
    'Walk the Piushaven quay counting mooring rings from the kiosk. The fourth one is worn smooth on one side only.',
    'A century of rope pulling in the same direction did that. This was a working harbour — peat in, textiles out — until the trade left and the water sat unused for decades. It came back as somewhere to live and sit rather than somewhere to unload, and the rings were kept. After dark the Harbour Signals buoys pick up on movement along this stretch, so walking the quay lights it as you go.',
    pg_temp.pt(51.5499, 5.0989), 'Piushaven', 'medium', 25,
    'https://commons.wikimedia.org/wiki/Special:FilePath/Piushaven%20Tilburg%20Welkom%20(01).jpg?width=900',
    array['wheelchair', 'well_lit'], true,
    'What was historically shipped out of the Piushaven — textiles, coal, or fish?',
    array['textiles', 'textile', 'wool', 'cloth', 'textiel']
  ),
  (
    'The Corner That Waited',
    'Wagnerplein, Tilburg-Noord. On the café side, one shopfront has its original 1960s tiling behind the newer sign. You can see it from the pavement.',
    'Tilburg-Noord was built fast in the sixties for mill workers and, later, for the people the mills recruited from Morocco and Turkey. The square was designed as its centre and then more or less written off for thirty years. Café de Werkplaats on this corner is volunteer-run, coffee is a euro, and nobody is asked how long they intend to stay — which is the whole point of a third space and the reason this corner is on the map.',
    pg_temp.pt(51.5686, 5.0734), 'Tilburg-Noord', 'easy', 15,
    'https://commons.wikimedia.org/wiki/Special:FilePath/Drieburcht%2C%20renovatie%20Wagnerplein%20Tilburg%202.jpg?width=900',
    array['wheelchair', 'step_free', 'pet_friendly'], false,
    'How much does a coffee cost at Café de Werkplaats?',
    array['1', '€1', '1 euro', 'one euro', 'a euro', '1eur']
  ),
  (
    'Find Yourself Overhead',
    'Tilburg Centraal, on the bicycle ramp. There is exactly one spot where the mirrored panels above put your own reflection directly over your head. It is closer to the railing than you think.',
    'The canopy is a listed piece of 1960s concrete engineering that the mirrored panels were designed not to touch — every fixing is clamped, nothing is drilled. The artist wanted the platform lights doubled at night, and the reflection of anyone standing underneath thrown back at them. It works properly after dark, and barely at all at noon.',
    pg_temp.pt(51.5608, 5.0838), 'Tilburg Centraal', 'hard', 40,
    'https://commons.wikimedia.org/wiki/Special:FilePath/Tilburg%20Centraal%20Station%20Mosaicpaneel%203.jpg?width=900',
    array['wheelchair', 'step_free', 'well_lit', 'hearing_loop'], true,
    'How are the mirrored panels attached to the listed station canopy?',
    array['clamped', 'clamps', 'they are clamped', 'clamped on', 'not drilled']
  )
on conflict (title) do nothing;

-- ---------------------------------------------------------------------------
-- Grow — artistic courses priced in points
--
-- cash_cost_euros is the real open-market price. It is shown in the app next to
-- the points price so the exchange is legible: the Inclusivity Department buys
-- these places, residents earn them by taking part.
-- ---------------------------------------------------------------------------

insert into public.courses
  (title, provider, description, certificate, format, discipline, level, points_cost,
   cash_cost_euros, sessions, hours_total, starts_on, location, address, image_url,
   accessibility, capacity, materials_included)
values
  (
    'Screenprinting: from sketch to edition', 'Veemarkt Studios',
    'Four evenings from a drawing to a numbered run of fifteen prints. You learn stencils, registration and how to rescue a screen you have ruined, which you will. Everything you print is yours.',
    'Studio certificate — screenprinting, level 1', 'certificate', 'Printmaking', 'beginner',
    200, 180, 4, 12,
    ((current_date + 14) + time '19:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5590, 5.0895), 'Veemarktstraat 44',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Taller%20de%20serigraf%C3%ADa%20-%20La%20Ermita%202.jpg?width=900',
    array['wheelchair', 'step_free'], 12, true
  ),
  (
    'Analogue darkroom, start to finish', 'Fontys Academy for Creative Industries',
    'Load a film in a changing bag, develop it, and print it by hand. Six sessions in a real darkroom with a tutor who will not let you skip the boring parts, because the boring parts are the craft.',
    'Fontys short-course statement of participation', 'certificate', 'Photography', 'beginner',
    260, 295, 6, 18,
    ((current_date + 21) + time '18:30') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5606, 5.0836), 'Fontys, Spoorzone',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Photographic%20darkroom%2C%20probably%20Geoff%20Charles''s%20darkroom%2C%20Bangor%20(1532108).jpg?width=900',
    array['wheelchair', 'step_free', 'quiet'], 10, true
  ),
  (
    'Sound design for film and games', 'Fontys × 013',
    'Eight weeks building a sound library from the city itself and cutting it to picture. Ends with your work played through the 013 main room rig, which is not a thing you get to do twice.',
    'Micro-credential — 3 ECTS, Fontys', 'certificate', 'Sound', 'some_experience',
    400, 450, 8, 32,
    ((current_date + 28) + time '19:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5573, 5.0842), '013 Poppodium, Veemarktstraat 44',
    'https://commons.wikimedia.org/wiki/Special:FilePath/NBU%20Sound%20design%20studio%20Radio%20and%20TV%20Center%20par%20Kossyo%20Hadzhigenchev-2021-b.jpg?width=900',
    array['wheelchair', 'step_free', 'hearing_loop'], 14, false
  ),
  (
    'Dyeing with what grows here', 'TextielLab',
    'Three afternoons making colour out of onion skin, madder, oak gall and woad — the same chemistry that built this city, minus the part with the jugs. Bring a white cotton thing you are prepared to lose.',
    null, 'class', 'Textiles', 'any',
    120, 95, 3, 9,
    ((current_date + 10) + time '14:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5686, 5.0762), 'TextielLab, Goirkestraat 96',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Dyeing%20experiments%20with%20madder.jpg?width=900',
    array['wheelchair', 'step_free', 'service_animal'], 16, true
  ),
  (
    'Painting at wall scale', 'Hall of Fame collective',
    'Five sessions on the legal wall learning what changes when a drawing becomes four metres tall — grids, perspective from below, and working fast before the light goes. You finish with a panel of your own.',
    'Collective letter of completion', 'class', 'Mural & street art', 'some_experience',
    180, 160, 5, 20,
    ((current_date + 18) + time '13:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5710, 5.0680), 'Hall of Fame, Quirijnstokstraat',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Pop%20Artist%20Lobo%20in%20mural%20painting%20for%20Mercado%20Libre.jpg?width=900',
    array['parking'], 10, true
  ),
  (
    'Zines and very small publishing', 'LocHal Kennismakerij',
    'Two sessions: make one, then work out how to get forty copies into the hands of people who are not your friends. Covers layout, risograph basics, distribution and pricing at zero.',
    null, 'class', 'Publishing', 'any',
    60, 45, 2, 6,
    ((current_date + 9) + time '19:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5609, 5.0797), 'LocHal, Kennismakerij',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Risographe%20.jpg?width=900',
    array['wheelchair', 'quiet', 'step_free', 'hearing_loop'], 20, true
  ),
  (
    'Hand-built ceramics', 'Veemarkt Studios',
    'Six weeks of pinch, coil and slab, glazing in week five and firing in week six. No wheel, which is the honest way to start. Expect to break at least one thing you liked.',
    'Studio certificate — ceramics, level 1', 'certificate', 'Ceramics', 'beginner',
    240, 225, 6, 18,
    ((current_date + 24) + time '19:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5590, 5.0895), 'Veemarktstraat 44',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Talavera%20at%20Tlaquepaque%20-%20TaTa.jpg?width=900',
    array['wheelchair', 'step_free'], 12, true
  ),
  (
    'Documenting the street you live on', 'Fontys Academy for Creative Industries',
    'Eight weeks photographing one street — yours — with weekly crits. Ends in a group show at the LocHal. The tutors are blunt and the work gets much better for it.',
    'Micro-credential — 3 ECTS, Fontys', 'certificate', 'Photography', 'some_experience',
    380, 450, 8, 28,
    ((current_date + 30) + time '18:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5606, 5.0836), 'Fontys, Spoorzone',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Street%20lamp%20in%20Sebnitz-%20Image%20impression%20of%20a%20street%20photographer%20-%20Image%20001.jpg?width=900',
    array['wheelchair', 'step_free', 'hearing_loop'], 12, false
  ),
  (
    'Stage lighting: the first desk', '013 Poppodium',
    'Four evenings on a real desk in a real room. Rigging, focusing, colour, and running a set for a live band on the last night. Counts towards a crew placement if you want one.',
    'Venue crew certificate — lighting, entry level', 'certificate', 'Technical theatre', 'beginner',
    220, 240, 4, 16,
    ((current_date + 16) + time '19:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5573, 5.0842), '013 Poppodium',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Programming%20light%20board.jpg?width=900',
    array['wheelchair', 'step_free', 'hearing_loop'], 8, true
  ),
  (
    'Writing in a language that is not your first', 'LocHal × Buurthuis De Symfonie',
    'Six weeks for people writing in Dutch or English as a second, third or fourth language. Nobody corrects your grammar unless you ask. The accent is the point, not the problem.',
    'Statement of participation', 'class', 'Writing', 'any',
    80, 120, 6, 12,
    ((current_date + 12) + time '19:00') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5609, 5.0797), 'LocHal, reading room',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Chimamanda%20creative%20writing%20workshop.JPG?width=900',
    array['wheelchair', 'quiet', 'step_free', 'hearing_loop', 'service_animal'], 15, true
  ),
  (
    'Masterclass: Sanne de Wit on painting big in public', 'Inclusivity Department',
    'One evening with the artist behind The Loom Wall on getting permission, getting paid, and getting a wall in the first place. Small group, questions encouraged, no portfolio required.',
    null, 'masterclass', 'Mural & street art', 'any',
    40, 35, 1, 3,
    ((current_date + 8) + time '19:30') at time zone 'Europe/Amsterdam',
    pg_temp.pt(51.5609, 5.0797), 'LocHal, Stadszaal',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Artist%20painting%20the%20mural%20of%20Paulo%20de%20Carvalho%2C%20Roma%20Avenue%2C%20Lisbon%2C%20Portugal%20julesvernex2.jpg?width=900',
    array['wheelchair', 'quiet', 'step_free', 'hearing_loop'], 30, true
  )
on conflict (title, starts_on) do nothing;

-- ---------------------------------------------------------------------------
-- Safety reports
--
-- Enough per location to clear the three-report threshold the UI enforces,
-- with night-time reports skewed lower where that reflects the place.
-- ---------------------------------------------------------------------------

-- Idempotent by construction: only inserted when this location has none yet,
-- since `on conflict` has nothing to key on for generated rows.
insert into public.feedback
  (location_id, kind, time_of_day, safety_perception, is_anonymous, created_at)
select
  target.id,
  'safety',
  case when g.n % 3 = 0 then 'night' else 'afternoon' end::time_of_day,
  case
    when g.n % 3 = 0 then greatest(1, target.night_score)
    else target.day_score
  end,
  true,
  now() - (g.n || ' days')::interval
from (
  select i.id,
         case i.title
           when 'Hall of Fame — open wall' then 3
           when 'Everyone Is From Somewhere' then 4
           else 5
         end as day_score,
         case i.title
           when 'Hall of Fame — open wall' then 2
           when 'Everyone Is From Somewhere' then 3
           when 'Quiet Grove' then 3
           else 4
         end as night_score
  from public.installations i
  union all
  select t.id, 5, 4 from public.third_spaces t
  union all
  select r.id,
         case r.type when 'exploration' then 4 else 5 end,
         case r.type when 'exploration' then 3 else 5 end
  from public.routes r
) as target
cross join generate_series(1, 6) as g(n)
where not exists (
  select 1 from public.feedback f where f.location_id = target.id
);
