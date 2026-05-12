# Noterira

React + Chakra UI comic-style note-taking app with PDF reading, Supabase persistence, and Gemini summaries.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Update `.env` with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`
- `VITE_GEMINI_MODEL`

The current `.env` includes the provided Gemini key and the provided Supabase URL. The Supabase anon key from the prompt was truncated, so replace it with the complete anon key from Supabase project settings.

## Supabase

1. Run `supabase/schema.sql` in the Supabase SQL editor. It creates the auth profile tables, note ownership columns, RLS policies, storage buckets, and storage policies.
2. In Supabase Auth settings, keep email confirmation enabled if you want the registration flow to require email verification.
3. To create an admin, create the account manually in Supabase Auth, copy that auth user UUID, then run:

```sql
insert into public.admin_profiles (id, name)
values ('AUTH_USER_UUID_HERE', 'Admin')
on conflict (id) do update set name = 'Admin';
```

Normal registration only creates `user` accounts.

## Features

- Comic-inspired Chakra UI layout with sidebar, topbar, editor, PDF reader, and summary panel.
- Supabase Auth sign-in/register flow with email verification support.
- User and admin roles with profile pages and an admin user-management dashboard.
- Rich text editing with bold, italics, underline, strike, headings, font size, text color, highlighting, and image insertion.
- Image paste/upload to Supabase storage.
- PDF upload to Supabase storage, attached to the selected note through `pdfs.note_id`, plus scrollable zoomable PDF viewing with selectable text.
- Gemini summarization for notes or selected PDF text, saved with `summaries.note_id`.
- Debounced note saving to Supabase with local fallback when environment variables or tables are missing.
