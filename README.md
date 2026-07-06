# TuitionIQ

## Goal

TuitionIQ helps private tutors and small tuition centres run the administrative side of their teaching. The primary goal is to give a tutor a single place to manage their students and stay on top of payments — replacing the scattered notebooks, spreadsheets, and chat messages that student rosters and fee tracking usually live in.

For a tutor, that means being able to:

- Keep an organized roster of students in one or more organizations (workspaces).
- Set each student's fees and the periods they apply to (e.g. monthly tuition).
- See at a glance who has paid, who is due, and who is overdue.
- Record and reverse payments, with a full audit trail of every change.

The result is less time spent chasing and reconciling payments, and a clear, reliable record of who owes what.

## Overview

TuitionIQ is a monorepo for a teacher-focused tuition management platform built with Expo (web + mobile) and an ASP.NET Core API.

It is designed around a strict backend-owned data model:

- Frontend uses Supabase only for authentication/session operations.
- All business data reads and writes go through the C# API.
- PostgreSQL (Supabase) enforces tenant isolation and row-level security.

Current implementation status:

- Implemented end-to-end: password-based authentication (login, signup, reset-password, post-login OTP verification), authentication session bootstrapping, user profile completion, organization creation/update, organization membership retrieval.
- Domain + schema already include student/fee/payment entities, with migrations and RLS foundations in place.

## Features

- Email + password login/signup with Supabase Auth.
- Post-login OTP verification flow that marks `public.users.email_verified` through `PATCH /api/users/email-verification`.
- Session-aware app shell with automatic route guarding and token refresh handling.
- JWT-authenticated API requests via Axios interceptor.
- User profile retrieval and update (`/api/users/me`, `/api/users/profile`).
- Organization onboarding flow (create org, auto-owner membership, select workspace).
- Organization management endpoints (get by id, update, list memberships).
- Multi-tenant PostgreSQL schema with soft deletes, audit logs, and RLS policies.
- Clean Architecture backend with MediatR + FluentValidation pipelines.

## Tech Stack

- Frontend:
  - Expo SDK 54 (React Native + Expo Router)
  - React 19 + TypeScript
  - Zustand (global state)
  - TanStack Query (server state)
  - Axios (API client + auth interceptor)
  - Supabase JS client (auth/session only)
- Backend:
  - ASP.NET Core Web API (targeting .NET 10)
  - Entity Framework Core + Npgsql
  - MediatR
  - FluentValidation
  - JWT Bearer auth (Supabase OIDC/JWKS validation via `Supabase:ProjectRef`)
- Database:
  - PostgreSQL (Supabase)
  - EF Core migrations
  - Row Level Security (RLS)
  - Trigger-based sync/helpers (updated_at, auth user bootstrap, fee rollups)

## Project Structure

```text
.
├── backend/
│   ├── TuitionIQ.slnx
│   ├── src/
│   │   ├── TuitionIQ.Api/               # Controllers, middleware, JWT config, startup
│   │   ├── TuitionIQ.Application/       # Commands/queries, DTOs, interfaces, validation
│   │   ├── TuitionIQ.Domain/            # Entities and domain enums
│   │   └── TuitionIQ.Infrastructure/    # EF Core context/configurations/migrations
│   └── tests/                           # Unit/Integration/Architecture test projects
├── frontend/
│   ├── app/                             # Expo Router routes
│   │   ├── (auth)/                      # login/signup/forgot-password/reset-password
│   │   ├── (verify)/                    # post-login OTP verification gate
│   │   └── (app)/                       # protected routes (home/dashboard, organizations, billing, settings, (teacher))
│   └── src/
│       ├── lib/                         # supabase client, axios api client, query client
│       ├── features/                    # auth, users, organizations, students, billing
│       ├── store/                       # Zustand stores (auth, org, ui)
│       ├── shared/                      # cross-cutting helpers (formatCurrency, etc.)
│       └── types/                       # hand-maintained @tuitioniq/types declarations
├── docs/                                # Source-of-truth architecture docs
└── archives/                            # Legacy/prototype code kept for reference
```

## Installation

### Prerequisites

- Node.js 20+
- npm 10+
- .NET SDK 10
- PostgreSQL database (or Supabase Postgres)

### 1) Install dependencies

There is no root `package.json`; the frontend and backend are installed and run separately.

Install frontend dependencies:

```bash
cd frontend && npm install && cd ..
```

Restore backend dependencies:

```bash
dotnet restore backend/TuitionIQ.slnx
```

### 2) Configure environment

Create frontend env file:

```bash
cp frontend/.env.example frontend/.env
```

Set values in `frontend/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
```

Set backend configuration (environment variables or user-secrets):

```bash
ConnectionStrings__DefaultConnection=Host=<host>;Port=5432;Database=<db>;Username=<user>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true
Supabase__ProjectRef=<your-project-ref>
Supabase__ServiceRoleKey=<your-service-role-key>
App__AllowedOrigins__0=http://localhost:8081
```

### 3) Apply database migrations

Requires the EF Core CLI (`dotnet tool install --global dotnet-ef`). Run against the Api startup project:

```bash
dotnet ef database update \
  --project backend/src/TuitionIQ.Infrastructure \
  --startup-project backend/src/TuitionIQ.Api
```

## Usage

### Run backend API

The API binds to `http://0.0.0.0:5000` (configured in `appsettings.json`):

```bash
dotnet run --project backend/src/TuitionIQ.Api/TuitionIQ.Api.csproj
```

> **macOS note:** port 5000 is used by AirPlay Receiver by default. If startup fails to bind, disable it in System Settings → General → AirDrop & Handoff → turn off "AirPlay Receiver" (or pass a different port with `--urls`).

### Run frontend

```bash
cd frontend
npm run web
```

Other Expo targets:

```bash
npm run start
npm run android
npm run ios
```

### Login flow (current)

1. User signs in with email + password.
2. App checks verification state and routes unverified users to OTP verification.
3. User submits OTP code sent by email.
4. App calls `PATCH /api/users/email-verification` to mark verification.
5. Frontend loads `/home` and API calls include `Authorization: Bearer <access_token>` automatically.

## Configuration

### Frontend

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key (auth client).
- `EXPO_PUBLIC_API_BASE_URL`: Base URL for ASP.NET API.

Platform URL guidance:

- Web / iOS simulator: `http://localhost:5000`
- Android emulator: `http://10.0.2.2:5000`
- Physical device: `http://<your-lan-ip>:5000`

### Backend

- `ConnectionStrings__DefaultConnection`: Postgres connection string.
- `Supabase__ProjectRef`: Supabase project ref used to resolve the Supabase issuer / OIDC metadata for JWT validation.
- `Supabase__ServiceRoleKey`: Supabase service-role key (backend-only; never expose to the frontend).
- `App__AllowedOrigins__*`: Allowed origins for mutating requests.

JWT validation note:

- The API validates Supabase access tokens using the project's OIDC metadata/JWKS published by Supabase.
- Do not configure `Supabase__JwtSecret`; shared-secret JWT validation is no longer used by the backend.
  Security reminder:

- Do not expose backend secrets to frontend env files.
- Frontend `EXPO_PUBLIC_*` values are public-by-design.

## API / Core Functionality

### Implemented API endpoints

- `GET /api/users/me`: Get current user profile.
- `PATCH /api/users/profile`: Update first name, last name, phone.
- `PATCH /api/users/email-verification`: Mark current user as email verified (idempotent).
- `POST /api/organizations`: Create organization and owner membership.
- `GET /api/organizations/{id}`: Get organization if caller is a member.
- `PATCH /api/organizations/{id}`: Update organization (owner/admin).
- `GET /api/organizations/memberships`: List caller memberships.

### Core runtime flow

- Supabase session is bootstrapped in app root layout.
- Axios request interceptor injects Supabase access token into API calls.
- API validates JWT (`issuer`, `audience`, `signature`, `lifetime`).
- Middleware verifies active + email-verified user before controller execution.
- Controllers stay thin and dispatch MediatR commands/queries.
- Application handlers write audit logs for significant changes.

## Scripts

There is no root `package.json`. Run the backend and frontend separately in two terminals (backend with `dotnet run`, frontend with `npm run web`).

### Frontend (`frontend/package.json`)

- `npm run start`: Expo dev server.
- `npm run web`: Expo web target.
- `npm run android`: Expo Android target.
- `npm run ios`: Expo iOS target.
- `npm run lint`: Expo ESLint.

### Backend

- `dotnet run --project backend/src/TuitionIQ.Api/TuitionIQ.Api.csproj`
- `dotnet build backend/TuitionIQ.slnx`
- `dotnet test backend/TuitionIQ.slnx`

## Testing

Backend test projects exist in:

- `backend/tests/TuitionIQ.UnitTests`
- `backend/tests/TuitionIQ.IntegrationTests`
- `backend/tests/TuitionIQ.ArchitectureTests`

Run all backend tests:

```bash
dotnet test backend/TuitionIQ.slnx
```

Current status: unit and integration tests are in place and passing, including email verification middleware and verification command coverage.

Frontend quality checks:

```bash
cd frontend
npm run lint
```

## Roadmap / Future Improvements

- Add full Students and Billing API surface (fees, periods, payments) to match domain schema.
- Expand frontend screens for student and payment lifecycle management.
- Expand comprehensive unit/integration/architecture test coverage.
- Generate and publish shared API types from OpenAPI instead of local declaration stubs.

## License

No license file is currently included in this repository.

Until a license is added, treat this codebase as proprietary/all-rights-reserved by default.
