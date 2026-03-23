# OrgFlow

Organise your team, tasks and events in one place. OrgFlow helps organisations coordinate volunteers, tasks and shifts in a single workspace.

## Product description

OrgFlow is a multi-tenant SaaS platform for organisations such as:

- Schools and educational groups
- Sports clubs and associations
- Volunteer and non-profit groups
- Event crews and production teams
- NGOs

### Features

- **Task management** – Kanban boards, token-based confirmation links, proof uploads
- **Shift planning** – Planning, claiming, and fair distribution of slots
- **Teams & members** – Committees, invites, roles
- **Resources** – Material procurement tied to events
- **Treasury** – Balance tracking, Excel import, audit-oriented updates
- **Engagement score** – Points for tasks, shifts and resources (configurable)

## Architecture overview

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS
- **Language**: TypeScript (strict mode)

### Multi-tenant structure

Every entity belongs to an organisation (`organization_id`). Core concepts include:

- `organizations` – id, name, slug, settings, plans
- `profiles` (members)
- `committees` (teams)
- `tasks`, `shifts`, `shift_assignments`
- `treasury_updates`, engagement-related tables

### Roles (high level)

- **Owner** – Full organisation control
- **Admin** – Manage teams, tasks, shifts, members
- **Lead** – Elevated management within the org
- **Member** – Participate in tasks and shifts
- **Viewer** – Read-oriented access where enabled

Exact role names and capabilities depend on your deployment and migrations.

## Environment variables

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional
NEXT_PUBLIC_ROOT_HOST=your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
TREASURY_EXCEL_CELL=
N8N_WEBHOOK_URL_SEND_MAGIC_LINK=
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel, redirects, and production checks.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production checklist

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for environment variables, Supabase migrations, and smoke tests.

### QA & review docs

- Admin vs member flows: [docs/QA_ADMIN_MEMBER_SEPARATION.md](docs/QA_ADMIN_MEMBER_SEPARATION.md)
- Release / regression gate: [docs/QA_RELEASE_REGRESSION_GATE.md](docs/QA_RELEASE_REGRESSION_GATE.md)
- Product notes & backlog: [docs/PRODUCT_REVIEW_AND_TODOS.md](docs/PRODUCT_REVIEW_AND_TODOS.md)

Do not commit real credentials; use `.env.local` and/or a gitignored `docs/credentials-*.local.md` pattern.

## Build

```bash
npm run build
npm start
```

## Database migrations

To apply migrations to your Supabase project:

1. **Login** (one-time): `supabase login`
2. **Link project**: `npm run db:link` (enter DB password when prompted)
3. **Push migrations**: `npm run db:push`

Or use the Supabase Dashboard: Project Settings → SQL Editor, then run each migration file in order.

## Deployment

1. Set environment variables on your host (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
2. Run migrations against the production Supabase project
3. Deploy the Next.js app

## Project structure

```
app/
  [org]/           # Organisation-scoped routes
  admin/           # Admin pages (tasks, shifts, treasury, materials)
  api/             # API routes
  auth/            # Auth callbacks
  create-organisation/
  super-admin/     # Super admin panel
components/
lib/               # Utilities, Supabase clients
supabase/
  migrations/      # SQL migrations
```

## License

Proprietary.
