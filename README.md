# Majestic Bookings

A high-end apartment booking app starter for Vercel + Supabase.

## Features

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase-ready auth integration points (email/password and magic link UI)
- Shared reservation visibility for authenticated users
- Ownership model for edit/cancel actions (users manage their own reservations)
- Role model: user, admin, superadmin
- Admin moderation rules: admins can approve/decline user reservations but cannot moderate other admins
- Superadmin account management area for create/delete users, plus admin signup URL generation in Settings
- Date conflict detection utility for overlapping bookings
- Notification preference center (email, SMS, WhatsApp)
- Yearly stats page with charted total visit days per user
- Supabase SQL migration with RLS policies
- Mock data fallback when env variables are missing

## Quick start

1. Install dependencies (uses temporary Node 20 runtime):

   npx -p node@20 -p npm@10 npm install

2. Create local env file:

   cp .env.example .env.local

3. Run development server:

   npx -p node@20 -p npm@10 npm run dev

## Supabase setup

1. Create a Supabase project.
2. Copy keys into .env.local:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
3. Run SQL in supabase/migrations/0001_init.sql.
4. Run SQL in supabase/migrations/0002_rbac_admin.sql.

### Configure initial superadmin

After running migrations, execute SQL in Supabase SQL editor:

insert into role_grants (email, role) values
   ('saulack@gmail.com', 'superadmin')
on conflict (email) do update set role = excluded.role;

When this user signs up with matching email, the account receives superadmin automatically.

### Admin signup URL flow

- Superadmin opens Settings > Notification Preferences and uses Generate Admin Invite.
- URL format: /signup?invite_token=...
- Invite token is validated at profile creation; matching email becomes admin.

## Vercel deployment

1. Push project to GitHub.
2. Import project in Vercel.
3. Set env vars from .env.example in Vercel project settings.
4. Deploy.

## Notification providers

Implement real sends in lib/notifications.ts:

- Email: SendGrid or Resend
- SMS: Twilio SMS
- WhatsApp: Meta WhatsApp Cloud API or Twilio WhatsApp

You can postpone notification setup. The app works on free Supabase without these provider keys.

## Notes

- Current UI uses mock data for immediate local use.
- API endpoints for admin management are in app/api/admin/*.
- Supabase Auth already enforces one account per email, and profiles(email) has a unique index.
