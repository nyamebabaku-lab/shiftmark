# ShiftMark

Team shift attendance with automatic GPS clock-in.

- **Worker app** (`ShiftMark.apk`, or the website on iPhone): clocks you in when you reach the office during your shift window and out when you leave; manual button as backup; calendar, hours, overtime, estimated pay, monthly PDF. Works offline — clock-ins are saved on the phone and synced later.
- **Admin app** (`ShiftMark-Admin.apk`, or the website): who's in now, approve workers, rates, fix missed clock-ins, leave/sick days, monthly team reports + PDF, office location on a map, rotation and rules.

Rotation: 8-day cycle — 2 mornings (06–14), 2 afternoons (14–22), 2 nights (22–06, counted on the day they start), 2 off. Fri 20 Nov 2026 = Morning 1 (adjustable in Settings).

## Links
- Live: https://nyamebabaku-lab.github.io/shiftmark/
- Demo (sample data): https://nyamebabaku-lab.github.io/shiftmark/demo/
- Android: https://github.com/nyamebabaku-lab/shiftmark/releases/latest

## Dev
```
npm install
npm run dev        # live (needs .env.local with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
npm run dev:demo   # demo data, no server
npm test           # rotation / attendance / geofence tests
```
Database: `supabase/migrations/0001_shiftmark.sql` (schema `shiftmark`). Android: `VITE_ROLE=worker OUT_DIR=build/worker npx vite build && APP=worker npx cap sync android` (same for `admin`).
