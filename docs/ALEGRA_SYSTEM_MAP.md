# System Map (Alegra Integration)

## Core Components
- **Invoice Service**: POS sales are created in `app/api/pos/sale/route.ts`. Standard invoices are managed in `app/api/invoices/route.ts`.
- **Numeration**: Managed via `prefix` and `consecutive` in the `Invoice` model. Resolution numbers can be stored in `resolutionNumber`.
- **Multi-tenancy**: Source is `session.user.id/tenantId`. Datastores are isolated via `getPrismaForRequest`.
- **Access Control**: RBAC using `lib/permissions.ts`.
- **Job Engine**: `lib/jobs/queue.ts` provides a serverless-friendly queue (Upstash QStash) with an in-memory fallback for local development.

## Data Flow
1. Invoice Created (POS/Web).
2. User triggers "Send to Alegra" or automatic trigger (future).
3. Job `ei_send_to_alegra` is enqueued.
4. `AlegraClient` maps internal `Invoice` -> Alegra `Invoice` and sends via REST.
5. Responses and status updates are logged in `ElectronicInvoiceTransmission`.
