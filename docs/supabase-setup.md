# Supabase setup (Milestone 6)

One-time setup. ~5 minutes. Do these in the Supabase dashboard.

## 1. Create the project
- Go to https://supabase.com → **New project**. Any name/region.
- Wait for it to finish provisioning.

## 2. Run the schema
- Left sidebar → **SQL Editor** → **New query**.
- Paste the contents of [`supabase/schema.sql`](../supabase/schema.sql) and **Run**.
- This creates the tables, security rules, realtime, and the `maps` storage bucket.

## 3. Turn on anonymous sign-ins
- Left sidebar → **Authentication** → **Sign In / Providers** (or **Settings**).
- Find **Anonymous sign-ins** and **enable** it. Save.
- (This is how players and GMs get a session with no login.)

## 4. Get the keys
- Left sidebar → **Project Settings** → **API** (or **Data API**).
- Copy **Project URL** and the **anon public** key.

## 5. Put them in the app
- In the project root, copy `.env.example` to `.env.local`.
- Fill in:
  ```
  VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-public-key
  ```
- Restart the dev server.

When that's done, tell me — I'll wire the app to it and we'll test cross-device.
