# Instructions for AI coding agents

You are helping a hackathon team build **Lease Loop**. The challenge is in `CHALLENGE.md`; the engineering rules in `RULES.md` are judged and must be followed. The short version:

- **No AI inside the product.** Never add an AI, ML or LLM SDK, model or API call to the app. All product logic is rules, data and algorithms. `npm run check:no-ai` enforces this.
- **Business logic goes in `src/domain/`** as pure functions: no I/O, no database, no `fetch`, no `Date.now()` / `new Date()` / `Math.random()`. Pass dates (ISO `YYYY-MM-DD`) and data in as arguments. Every function gets Vitest tests next to it, including edge cases.
- **Money is integer euro cents.** Never use floating-point euros for amounts. Round once, deliberately, and document the rule.
- **API routes** use `ok()` / `fail()` / `handleRoute()` from `src/server/api-response.ts`. Never return raw error messages or stack traces.
- **Every data change** goes through `withAudit()` in `src/server/audit.ts`. Use the `tx` it gives you for every write in that change.
- **Database changes:** edit `prisma/schema.prisma`, then run `npm run db:migrate`. Never hand-write migration SQL.
- **UI strings** go in `src/i18n/messages/{en,fi,sv,et}.json`, with the same keys in all four.
- **Files stay under 600 lines.** Split by responsibility.
- Before saying a change is done, run `npm run check:all`; it's what CI runs.
- Read `data/DATA.md` before using the data pack. Schemas for every data file are in `src/data/schemas.ts`.

## Git commit writer and delivery

For completed implementation tasks, unless the user says otherwise:

1. Inspect the worktree and preserve unrelated changes. Create a descriptively
   named feature branch before committing; never commit directly to `main`.
2. Run the required checks and stage only the intended changes. Write an accurate
   conventional commit message, `type(scope): subject`, with a short body when
   needed to explain why. Include the required co-author trailer when applicable.
3. Push the branch to a user-designated repository, then create a pull request
   using the repository template when available. Report its link for the user to
   review; never merge it.
4. If the destination, permissions, checks, or hooks block delivery, report the
   blocker and stop. Never bypass hooks with `--no-verify` or push to an
   unconfirmed upstream repository.

## Clean code

- Prefer the simplest design that fully solves the requirement; avoid unrelated changes and premature abstractions.
- Use clear, intention-revealing names and small functions with one responsibility.
- Reuse existing helpers and patterns; avoid duplicated logic and dead code.
- Handle errors explicitly. Do not hide failures behind broad catches, silent defaults, or success-shaped fallbacks.
- Add comments only when they clarify why non-obvious code exists; keep the code itself readable.
- Test behavior and edge cases, not implementation details.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
