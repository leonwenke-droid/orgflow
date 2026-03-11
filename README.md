# OrgFlow

Organise your team, tasks and events in one place. OrgFlow helps organisations coordinate volunteers, tasks and shifts effortlessly.

## Product description

OrgFlow is a multi-tenant SaaS platform for organisations such as:

- Schools
- Sports clubs
- Volunteer groups
- Event crews
- NGOs
- Student organisations

### Features

- **Task management** – Kanban boards, token-based confirmation links, proof uploads
- **Shift planning** – Auto-assignment, fair distribution, setup/teardown slots
- **Teams & members** – Organise committees, invite members, assign roles
- **Resources** – Track material procurement, events and contributions
- **Treasury** – Balance tracking, Excel import, audit trail
- **Engagement score** – Fair distribution, points for tasks, shifts and resources

## Architecture overview

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS
- **Language**: TypeScript (strict mode)

### Multi-tenant structure

Every entity belongs to an organisation (`organization_id`). Core tables:

- `organizations` – id, name, slug, subdomain, plan, is_active
- `profiles` (members)
- `committees` (teams)
- `tasks`
- `shifts`
- `shift_assignments`
- `treasury_updates`
- `engagement_events`

### Roles

- **Owner** – Full organisation control
- **Admin** – Manage teams, tasks, shifts, members
- **TeamLead** – Manage tasks inside team
- **Member** – View tasks and shifts
- **Viewer** – Read only

## Environment variables

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional
NEXT_PUBLIC_ROOT_HOST=orgflow.app
NEXT_PUBLIC_APP_URL=https://orgflow.app
TREASURY_EXCEL_CELL=M9
N8N_WEBHOOK_URL_SEND_MAGIC_LINK=https://...
```

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

1. Set environment variables in your hosting provider (Vercel, etc.)
2. Run migrations (see above)
3. Deploy the Next.js app

### Vercel

Connect the repository and add the environment variables. The build will run automatically.

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
