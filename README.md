# TuitionIQ

TuitionIQ is a full-stack application to manage students and their tuition billing records.

Tech stack

- Backend: ASP.NET Core (targeting .NET 10), Entity Framework Core, SQLite (for development)
- Frontend: React + TypeScript + Vite

Quick start

Prerequisites:

- .NET 10 SDK
- Node.js (16+ recommended)

Backend

1. Change into the backend folder and restore packages:

```powershell
cd backend
dotnet restore
```

2. Apply database migrations (creates `tuition.db` by default):

```powershell
dotnet ef database update --project TuitionIQ.csproj
```

3. Run the backend:

```powershell
dotnet run --project TuitionIQ.csproj
```

Frontend

1. Change into the frontend folder and install dependencies:

```bash
cd frontend
npm install
```

2. Run the frontend dev server:

```bash
npm run dev
```

Copyright: personal project
