# Showcase lifecycle model

This local demo uses synthetic identities and is not an authenticated or legally
binding leasing service. The customer profile selector only chooses which
synthetic data-pack identity is used by a journey.

## Record ownership and history

- `Asset` is the durable item identity. It has one current operational status,
  condition, usage reading, previous-life count, and optional current net
  second-life price. It is never replaced when the item is leased again.
- `DemoQuote` belongs to an asset and stores a synthetic customer ID, quote
  date, term, down payment, locked net price, and price-list version.
- `DemoLease` snapshots the signed quote terms and links to the asset and quote.
  Its synthetic customer ID remains the data-pack ID; there is no customer table
  or real personal data. Each lease owns its generated `DemoInvoice` rows and
  optional receipt, return request, and early-exit outcome.
- `DemoReturnInspection` belongs to an asset and can optionally link to the
  lease that returned it. The optional link supports the challenge's seeded
  historical items without inventing database lease/customer history for them.
- `DemoRefurbishment` is unique per inspection and snapshots completion date,
  work steps, cost, resulting condition/usage, re-lease price/rent, term, and
  matched waiting-list ID. An unmatched item has a null waiting-list ID and
  `unassigned` match status; a matched offer can be accepted into a normal
  quote, lease, and invoice schedule.
- `DemoEarlyExit` is unique per lease and records the date, remaining-rent
  present value, estimated market value, and settlement. Buyout is stored on
  the lease separately because it is an end-of-term outcome.
- `AuditLog` records each persisted mutation in the same transaction via
  `withAudit()`.

All generated IDs and relationships are SQLite/Prisma managed. Foreign keys
protect quote, lease, invoice, receipt, inspection, refurbishment and outcome
ownership. The quote price and invoice rows are historical snapshots: later
catalogue prices, VAT changes, or refurbishment decisions cannot rewrite them.

The challenge data pack supplies waiting-list need descriptions, but not
customer profiles or contact information. A matched synthetic requester can
accept a demo offer and generate quote/lease/invoice records; the acceptance
summary is shown in the admin workflow. A dedicated synthetic wait-list
customer profile and account view would be a separate showcase feature. Do not
infer or invent contact details from the descriptions.

## Status and transition rules

The showcased item path is `available → reserved → leased → returned →
available → reserved`. Signing reserves an item; return request leaves it
unavailable until inspection and refurbishment finish; a buyout marks it `sold`;
early exit returns it to the inspection queue. Failed eligibility or cancelled
security steps do not create a lease. Inspection cannot reduce recorded usage,
and refurbishment is allowed once per inspection. Wait-list acceptance requires
a matched, still-valid offer and an available item. These are demo workflows,
not server authorization controls.

## Date, money, retention, and reset rules

Business rules receive ISO dates as inputs. Net prices, rents, VAT, costs, and
settlements are integer euro cents. The invoice planner rounds monthly net once
per invoice and then rounds VAT using the invoice issue-date rate. Early exit
discounts future net invoices with the coefficient-table annual rate and
monthly compounding, rounding each present-value cash flow to cents; it subtracts
the current condition/use-adjusted market value and floors settlement at zero.
No VAT is charged on unissued invoices. This is an explicit fair-demo policy,
not an official financial formula.

Database history is retained locally between demo runs. `npm run db:setup` is
safe for applying migrations and seeding missing assets; `npm run db:reset`
destructively resets the local demo database. Do not put real customer data in
the database. A public deployment would require real authentication,
authorization, privacy/retention policy, and security review first.

`npm run test:e2e` creates `playwright.db` from the already-migrated `dev.db`,
clears all application rows in that copy, seeds the synthetic assets, and starts
an isolated Next server on port 3120 with a separate build directory. It does
not alter `dev.db`.
