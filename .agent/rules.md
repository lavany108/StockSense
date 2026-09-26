# Always read docs/PROJECT_SPEC.md before any change. Use TypeScript-friendly clean patterns, Zod validation on EVERY route, conventional commits (feat:/fix:), and never hardcode secrets — use .env.

## Core Directives
1. **Specification Adherence**: Always read and verify against `docs/PROJECT_SPEC.md` before making any schema, API, or architectural changes.
2. **Single Source of Truth**: The `stock_moves` ledger table is the single source of truth for all inventory movements. Never mutate stock levels directly without inserting a corresponding `stock_moves` record.
3. **Strict Validation**: Enforce Zod validation on every API endpoint route (body, query, params) on the server, and matching types on the client.
4. **Clean TypeScript**: Write type-safe, explicit, clean TypeScript across both `client` and `server`.
5. **Git Hygiene**: Use conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
6. **Zero Secrets in Code**: Never commit secrets, passwords, or sensitive keys. Always use `.env` and provide template entries in `.env.example`.
