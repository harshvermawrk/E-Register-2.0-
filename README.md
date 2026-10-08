# E-Register Dashboard

E-Register is a digital member and yearly-record management application. It is intended to make member information, year-wise entries, collections, and expenses easier to maintain than paper registers.

The project contains a React + TypeScript frontend and an Electron desktop shell. It can run in local sample mode without a cloud account, or connect to a free Supabase test project for admin sign-in and shared cloud data.

## Technology

- React 19 and TypeScript
- Vite 8 for frontend development and builds
- Electron for the Windows desktop application
- Electron Builder with NSIS for the Windows installer
- npm (`package-lock.json`) for dependency installation

## Features

- Dashboard with shortcuts to application sections
- Member list and member profile management
- Year Wise List for browsing and adding year-based member entries
- Expenses & Collection page with yearly summaries, period filtering, search, and expense editing
- Responsive React interface shared between the desktop app and web development preview

## Requirements

- Windows for Windows installer generation and installation testing
- Node.js 22 or newer and npm

## Development

Install dependencies:

```sh
npm install
```

Run the app in a desktop window:

```sh
npm run dev
```

This builds the Electron main and preload scripts, starts Vite at `http://127.0.0.1:5173`, waits for the server, and opens Electron. Developer tools are enabled only in development. Running the command a second time focuses the existing application instance.

To run only the web frontend in a browser, use:

```sh
npm run web
```

Vite uses port `8443` by default for this command; the Electron development script explicitly uses port `5173`.

## Production build

Build the frontend and Electron scripts:

```sh
npm run build
```

The Vite frontend is written to `dist/`, and the bundled Electron main/preload scripts are written to `dist-electron/`. In production, Electron loads the frontend from the packaged local files; it does not depend on Vite, npm, a browser, or a running development server.

## Windows packaging and installation

Generate the Windows NSIS installer:

```sh
npm run package
```

The installer is written to:

```text
release/E-Register-Dashboard-Setup-1.0.0.exe
```

Double-click the installer and follow its prompts. The installer provides a Desktop shortcut option, adds an E-Register Dashboard shortcut to the Start Menu, and offers to launch the application after installation. The installed app is launched from its shortcut like a normal Windows application.

The configured Windows product name is **E-Register Dashboard**, with version **1.0.0**. Update `version` in `package.json` when preparing a new release.

## Application icon

The Windows icon files are:

- `assets/icons/icon.ico` — used by Electron Builder for the Windows application and installer
- `assets/icons/icon.png` — PNG artwork/source

The current icon is a generic document placeholder. Replace `assets/icons/icon.ico` with the approved square Windows icon before publishing; include a 256 × 256 image for best Windows display quality.

## Free backend test setup

The test backend uses Supabase Auth and a managed PostgreSQL database. Supabase stores register records in the cloud region selected when the test project is created. The app uses the public project URL and anon key; PostgreSQL row-level security and an admin allowlist restrict data access. Never put a Supabase service-role key in this frontend.

### Create the test project

1. Create a free Supabase project and select the region you want for test data.
2. Open **SQL Editor** in that project and run [`supabase/schema.sql`](supabase/schema.sql).
3. In **Authentication > Users**, create the one admin test account. Turn off public sign-ups in the project’s Auth settings.
4. Add that account to the allowlist from SQL Editor, replacing the sample email with its exact sign-in email:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'admin@example.com'
   on conflict (user_id) do nothing;
   ```

5. Copy `.env.example` to `.env.local` and fill in the project URL and public anon/publishable key from **Project Settings > API**. `.env.local` is ignored by Git.
6. Start the web app with `npm run web`, then sign in with the approved admin account.

When the new test database is completely empty, the app seeds it with the project’s fictional sample members, payments, and expenses. Existing data is never overwritten by this sample seed. The header labels this as a cloud test workspace. Keep real member and financial data out of this free test project.

Supabase Free currently includes 500 MB of database storage, but pauses projects after a week of inactivity and does not include automatic database backups. Use it for development and sample data; decide on a paid, backed-up production setup before relying on it for live records. Check [current Supabase plan details](https://supabase.com/pricing) before making that later decision.

### Local sample mode

When Supabase environment values are not configured, the app continues to use the existing fictional sample data and browser local storage. This mode is for previewing the interface on the current browser/device; it does not synchronize records between devices.

## Architecture

```text
Browser or Electron desktop shell
  ↓
React + TypeScript frontend (src/)
  ├── Local sample mode: browser local storage
  └── Cloud test mode: Supabase Auth + PostgreSQL with admin-only RLS
```

Electron uses context isolation, disables Node.js integration in the renderer, and exposes only a small app-version API from its preload script. Application navigation uses hash-based routes in Electron so it works with packaged local files; browser preview uses the existing browser router. Supabase access and row mapping live in `src/services/`.

The test backend is an externally hosted Supabase project configured using the steps above. The project URL and anon/publishable key are public frontend configuration; the database service-role key and admin password must never be added to a `VITE_` variable because Vite embeds those values in the frontend.

The existing `server/` folder is an earlier Cloud Run/Cloud SQL draft. It is not used by this free Supabase test setup; do not run it for this configuration.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Run Vite and the Electron development window |
| `npm run web` | Run only the web frontend |
| `npm run typecheck` | Type-check the frontend and Electron code |
| `npm run build` | Build the production frontend and Electron scripts |
| `npm run package` | Build the Windows NSIS installer in `release/` |

## Project status

The desktop packaging workflow is configured for Windows. Supabase cloud sync is ready when a test project is configured. Public web hosting, production backups, and production deployment decisions are still future work.

## Developer

Harsh Verma

B.Tech CSE Student, SVVV, Indore
