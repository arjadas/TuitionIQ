# Resetting Entity Framework Core Migrations and Creating a New Migration

This guide explains how to **remove existing Entity Framework Core migrations** and create a fresh new migration for your project.

---

## Prerequisites

- .NET SDK installed
- `dotnet-ef` tool installed globally (`dotnet tool install --global dotnet-ef`)
- Your project builds successfully

---

## Step-by-step Instructions

### 1. Stop the application

Make sure your application or development server is not running.

### 2. Delete the `Migrations` folder

Manually delete the entire `Migrations` folder from your project directory.

### 3. (Optional) Delete the existing database

To start with a clean database, delete the database using your preferred method:

- **SQL Server:** Use SQL Server Management Studio or run a `DROP DATABASE` command
- **SQLite:** Delete the `.db` file in your project directory
- **PostgreSQL/MySQL:** Use your database client or CLI to drop the database

### 4. Clean and build your project

```bash
dotnet clean
dotnet build
```

Ensure there are no build errors before continuing.

### 5. Create a new migration

Run the following command in your project root directory:

```bash
dotnet ef migrations add InitialCreate
```

This will create a new `Migrations` folder with the migration files reflecting your current database model.

### 6. Update the database

Apply the migration to your database:

```bash
dotnet ef database update
```

#### Notes

If you have multiple projects (e.g., separate API and data projects), specify the project and startup project explicitly:

```bash
dotnet ef migrations add InitialCreate --project YourDataProject --startup-project YourApiProject
dotnet ef database update --project YourDataProject --startup-project YourApiProject
```
