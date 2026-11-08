# Second Life showcase roadmap

## Goal

Turn the Lease Loop hackathon app into a polished, convincing demo of a circular
leasing service. Keep the challenge's end-to-end lease lifecycle, explainable
pricing, audit trail, and second-life story at the center. This is a showcase,
not a production financial service.

Run this version locally. The profile selector is not authentication; do not
deploy it publicly as an authenticated or secure service.

Use synthetic data only. Do not collect real identity documents, credentials,
payment details, or other sensitive customer data. Label simulated features
clearly and never imply that the demo performs real identity verification or
creates a legally binding signature.

## Current starting point

- The home page now introduces Second Life, links to the catalogue, and shows
  indicative 12-month prices for selected items.
- The catalogue is at `/[locale]/catalogue`.
- The shared app shell provides a simulated date and customer/admin profile
  selector. The choices are kept in the URL so demo scenarios can be replayed.
- Catalogue cards for available items open a quote. A customer can optionally
  lock it, complete applicable synthetic questions, review the signing-date
  price, and simulate signing. The lease and invoice schedule are saved in
  the local database and shown under **My lease**.
- Move the simulated date to the lease end date or later to request a return.
  The request remains pending; the item is not available for re-lease.
- Customer and admin navigation is present. The customer can create a demo quote,
  complete an application, simulate an identity check and signing, view invoices,
  confirm an asset's received condition and usage, and request a return.
- The admin view shows current leases by customer, return requests awaiting
  inspection, invoice breakdowns, audit events, and item passports. Admins can
  inspect returned items, calculate refurbishment and matching decisions, and
  make available an unassigned item when wait-list deadlines have passed. A
  matched waiting-list offer can be accepted as a simulated lease.
- Customers can preview and confirm a fair early exit or separately choose the
  end-of-term buyout. Items then follow the inspection workflow.
- `/[locale]/scenarios` provides direct entry points for all ten challenge cards.
- Identity checks, signing, and invoices are simulations; no real authentication,
  legal signature, or payment flow is implemented.
- Business rules belong in `src/domain/` as pure functions with nearby tests;
  money is integer euro cents; data changes use `withAudit()`.

After pulling these changes, run `npm run db:setup` to apply the new local
database migration before starting the app. A new customer journey can be
started from an available catalogue item; saved leases remain in that database.

## Recommended implementation order

### 1. Stabilize the demo shell

- Check the homepage, catalogue, category links, date selector, customer selector,
  admin selector, and language switcher at desktop and mobile widths.
- Make invalid or unsupported demo dates visible rather than silently presenting
  them as valid.
- Keep the selected date and profile when moving between pages.
- Label the profile selector as a demo control. It is not authentication or
  authorization.

**Done when:** a presenter can switch profiles and dates, browse the catalogue,
and reliably return to the same scenario using its URL.

### 2. Build one complete customer lease journey

Implement a single happy path before building all the account pages:

1. Select a synthetic customer and an available item.
2. Choose a lease term and down payment and see a clear price breakdown.
3. Complete the applicable synthetic application questions.
4. Show an explainable decision: approved, declined, or manual review.
5. Review the proposed contract and confirm the demo signing flow.
6. Show a lease summary and its invoice schedule.
7. At or after lease end, let the customer request a return. Keep the request
   pending until the later admin inspection and refurbishment decision.

Use the challenge scenarios as acceptance tests, particularly the happy path,
price lock, tax change, and calendar traps. Lock the agreed net price in the
contract snapshot. Calculate VAT using the simulated invoice date. Keep the
rounding rule explicit and test that invoice totals reconcile.

**Done when:** one synthetic customer can complete the journey end to end, and
the important calculated values can be explained from the UI.

#### Agreed demo rules

- Customers may optionally lock a quote through the fifth Monday–Friday day
  after the quote date, inclusive. There is no public-holiday calendar in the
  demo. Unlocked or expired quotes use the signing-date price; the customer
  must confirm a changed price.
- The lease runs from its start date up to, but not including, its end date.
  Add the lease term in months and clamp the day to the last day of the
  resulting month when needed.
- Issue the first invoice on the signing/start date and later invoices on the
  first of each month. The due date is the next 15th strictly after issue.
- Prorate the first and last calendar months by covered days divided by days
  in that month. Round the net amount once per invoice, then calculate and
  round VAT using the invoice issue date. Both use nearest cent, with half
  cents rounded up.
- The displayed down payment is net. The illustrative total combines that net
  down payment with invoices including VAT; tax on the down payment is not
  modeled. Optional buyout is displayed separately.
- Let customers request returns at or after the lease end date. Do not mark an
  item inspected, refurbished, or available for re-lease at this point.

### 2a. Design the Prisma data model for the full lifecycle — implemented

The current SQLite schema already stores assets, demo quotes, leases, invoices,
return requests, and audit events. Customers still come from the synthetic data
pack; their IDs in quotes and leases are not database relations. Treat this as
the starting point, not the finished data model.

Before building the admin and next-life flows:

- Map the relationships and lifecycle of customers, assets, quotes, leases,
  invoices, returns, inspections, refurbishment decisions, and subsequent
  leases. Decide which records need their own identity and history.
- Define ownership, required fields, unique constraints, indexes, and allowed
  state transitions. Preserve signed price and invoice snapshots so later price
  changes cannot rewrite history.
- Decide whether and how to persist synthetic customers and connect them to
  leases. Keep this separate from real authentication and personal data.
- Plan how a return request becomes an inspection and, if needed, a
  refurbishment before the asset is available for another lease. Keep each
  change and its audit event in one transaction.
- Document date, money, retention, and deletion rules; use synthetic data only.
  Review database access and authorization again before any public deployment.
- Update `prisma/schema.prisma`, generate migrations with `npm run db:migrate`,
  and test relationships, constraints, state transitions, and migration from
  existing demo records. Do not hand-write migration SQL.

The implemented model and lifecycle decisions are documented in
[`docs/SHOWCASE-LIFECYCLE.md`](docs/SHOWCASE-LIFECYCLE.md). Synthetic customers
remain data-pack IDs rather than database/authentication records. Migrations add
early-exit, inspection, and refurbishment snapshots while preserving existing
quote/lease/invoice history.

**Done when:** the model supports a customer lease through return, admin
inspection, and a subsequent lease; lifecycle decisions and migration behavior
are documented and covered by service tests.

### 3. Add a visible, honest security moment — implemented

At the points where identity confirmation or signing would matter, show a
focused dialog explaining the simulated step. The demo can offer fictional
success, failure, and cancel outcomes, followed by a clear confirmation that
the check or signature was simulated.

- Never request a real password, one-time code, identity document, or payment
  information.
- Do not describe a simulated check as verified identity or a simulated click as
  a legally binding signature.
- Record demo actions in the audit history with an explicit demo actor and
  action label.
- Test successful, failed, and cancelled flows, including that cancelling does
  not sign or change the contract.

**Done when:** a presenter can show the purpose of verification, a confirmation
step, and an audit event without the UI overstating what actually happened.

### 4. Add admin visibility from the same records — implemented

Once lease and invoice records exist, build admin views for:

- Current leases, grouped by synthetic customer.
- Invoice history, with status and a clear breakdown of net amount, VAT, and
  total.
- Returned items and their refurbishment / next-life status.
- An item history or passport that connects successive leases.

Use the same records and calculations as the customer view rather than
hard-coded dashboard figures. Keep the admin profile switch explicitly
simulated. If real privileged data or actions are ever introduced, a client-side
profile selector is not a security boundary: authorization must be enforced on
the server.

**Done when:** the admin view can explain a lease and its invoice history from
the same data the customer sees, and a returned item can be followed into its
next life.

### 5. Finish with second-life storytelling and demo polish — implemented

- Implement the chosen challenge problems deeply rather than presenting many
  shallow, non-functional controls.
- Show why an item is refurbished, why a waiting-list customer is selected, and
  how the next-life price is calculated.
- Explain tie-breaking, condition/deadline exclusions, rent, refurbishment
  steps/cost, and wear-adjusted CO₂. A matched offer can continue through
  simulated acceptance, signing, and invoice generation.
- Consider the asset passport and circular impact as a memorable demo moment.
- Replay each challenge card from the scenario gallery and verify its user
  journey with browser-level Playwright tests under `e2e/`.
- Add clear empty, loading, error, and unavailable states.
- Check keyboard access, focus visibility, responsive layouts, and all four
  supported languages.

The scenario gallery links directly to each scenario's relevant customer or
admin screen. The Playwright suite exercises all ten cards, including lease
creation, price lock, VAT and calendar invoices, decline and review outcomes,
early exit, wait-list matching, third-life leasing, and the passport. It also
checks mobile width, keyboard entry, all four locales, and invalid dates. Run it
with `npm run test:e2e`; it uses a separate copied test database.

The wait-list data pack includes need and eligibility details but no customer
profiles or contact information. A matched offer can be accepted as a
simulated lease and generate invoices, but a dedicated account/profile for
wait-list customers such as `wait-02` would require adding synthetic profile
records first. This is an optional follow-up, not required to demonstrate the
current challenge card.

**Done when:** the main demo can be presented smoothly, has no dead-end controls
masquerading as finished features, and its key decisions are explainable. The
ten challenge cards have browser-level coverage. `npm run check:all` passes all
checks except its default Turbopack build in restricted environments where the
CSS worker cannot bind a local socket; `PLAYWRIGHT=1 npm run build -- --webpack`
completes the production build successfully.

## Engineering checkpoints for every phase

- Keep business calculations in pure, deterministic functions under
  `src/domain/`; pass dates and values in as arguments.
- Store and calculate money in integer euro cents. Round once and document the
  rule.
- Validate API inputs and return the shared response envelope. Never expose raw
  errors or stack traces to the browser.
- Wrap every persisted change and its audit event in the same `withAudit()`
  transaction.
- Use the Zod data schemas and synthetic data pack; do not hard-code scenario
  answers as substitutes for general rules.
- Add tests for normal cases, boundaries, and failure paths next to domain
  functions.
- Keep UI strings in all four files under `src/i18n/messages/`.
- Run `npm run check:all` before considering a phase complete.

## Suggested demo narrative

1. Start on Second Life's homepage and explain the product's circular loop.
2. Choose a date and synthetic customer to show that a scenario is replayable.
3. Browse a product and explain the 12-month price and its assumptions.
4. Complete the lease journey and show the simulated verification/signing
   moment.
5. Switch to the admin demo and inspect the same lease and invoice history.
6. Finish with a returned asset's next life, passport, or circular impact.
7. Be explicit that identity checks, signatures, and payments are simulated.
