# LevelUp

LevelUp is a responsive productivity and self-improvement app starter built with Next.js, TypeScript, Recharts, and Supabase.

## Included in this starter

- Responsive dashboard with task checklist, habits, goal cards, activity chart, and theme switcher.
- Interactive goals, tasks, habit checklist, and focus timer.
- Goals page with search and progress logging.
- Habits page for adding, completing, and removing habits.
- Plan page with editable task completion.
- Focus timer with 25-, 50-, and 60-minute options.
- Calendar, weekly review, analytics, settings, and JSON export starter screens.
- Supabase client scaffold and SQL schema with per-user Row Level Security policies.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The dashboard can be explored without Supabase credentials; the starter currently saves its interactive demo state to this browser's local storage.

## Configure Supabase

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `supabase/schema.sql`.
3. Copy the project URL and publishable key (or legacy anon key) into `.env.local`.
4. Restart the dev server.

Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The service-role key is intentionally not needed by this client starter. Never expose a service-role key in client-side code.

## Current integration status

The dashboard reads and writes user-owned goals, tasks, habits, habit check-ins, weekly reviews, and profile display names through Supabase. The weekly planner can create goal-linked task suggestions for goals without an unfinished task in the next seven days. Row Level Security policies scope table access to the signed-in user.

Set the public Supabase URL and anon key, run `supabase/schema.sql`, and configure email confirmation as desired in the Supabase dashboard. The plan generator is rule-based; focus sessions, reminders, and account deletion are not yet persisted or implemented. Configure production email delivery and review the database policies before inviting public users.

## Remaining implementation milestones

1. Persist focus sessions and calculate habit streaks using each user's timezone and schedule.
2. Add optional server-side AI planning, while keeping the current rule-based planner usable.
3. Add reminders, account deletion, and automated tests for auth, RLS isolation, and CRUD flows.


## Authentication and cloud-data integration scaffold

This source bundle also includes:
- `/login` email/password sign-in and account creation.
- Email verification callback at `/auth/callback`.
- Password reset request and update pages.
- Middleware session checks for protected routes once Supabase env variables are set.
- Server/browser Supabase clients and typed database helper functions for goals, tasks, habits, and habit logs.
- The SQL migration under `supabase/schema.sql`, including Row Level Security.

### Required Supabase dashboard configuration

In Supabase Authentication settings:
1. Enable email/password authentication.
2. Set the Site URL to your local app URL while testing (for example `http://localhost:3000`).
3. Add `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/update-password` to allowed redirect URLs.
4. Configure a production SMTP provider before inviting public users; the built-in mailer has low rate limits.
5. Run `supabase/schema.sql` in the SQL Editor.

### Integration status

The dashboard is connected to Supabase for goals, tasks, habits, habit check-ins, weekly reviews, and profile names. The schema includes per-user Row Level Security. The middleware is at `src/middleware.ts` for this starter; on Next.js versions that require the root-level `middleware.ts`, move it to the project root. Add automated coverage for email verification, password recovery, session expiry, RLS isolation, and CRUD flows before production use.
