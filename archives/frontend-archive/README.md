## Naming conventions (recommended)

Use consistent file and folder naming to make the frontend codebase predictable and easy to navigate. Recommended conventions:

- **Components:** PascalCase, `.tsx` extension. One component per file. Example: `src/components/StudentCard.tsx`.
- **Pages / Views:** PascalCase, placed under `src/pages/` or `src/views`. Example: `src/pages/PaymentsPage.tsx`.
- **Hooks:** `use` prefix + camelCase, `.ts` or `.tsx` (if returning JSX). Example: `src/hooks/usePayments.ts`.
- **Services / API clients:** camelCase or kebab-case filenames, default export for the client. Example: `src/services/paymentService.ts` or `src/services/payment-service.ts`.
- **Utilities / helpers:** camelCase, grouped in `src/utils/`. Example: `src/utils/formatDate.ts`.
- **Types:** keep TypeScript type declarations in `src/types/` and name files after the domain model. Prefer `payment-record.types.ts` or `paymentRecord.types.ts`. Example: `src/types/payment-record.types.ts`.
- **Styles:** colocate component styles (e.g., `StudentCard.module.css` or `StudentCard.module.scss`) or use a global `src/styles/` for shared tokens.
- **Assets:** store under `src/assets/` and use kebab-case for filenames, e.g. `src/assets/logo.svg`.
- **Tests:** use the same filename as the subject plus `.test.ts` / `.test.tsx`. Example: `StudentCard.test.tsx`.

Consistency tip: prefer one style (kebab-case vs camelCase) for filenames across the project and document it here so contributors follow the same pattern.
