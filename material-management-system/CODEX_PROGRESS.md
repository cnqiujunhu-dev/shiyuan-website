# Codex Progress

## Context

- Workspace: `E:\PRO\shiyuan_website\V0`
- Active project: `material-management-system`
- Working branch: `codex/transaction-fields`
- Goal: validate core business logic first, repair data and contract inconsistencies, then continue with optimization work on a stable baseline.

## Working Rules

- Treat `master` as the previous baseline from Claude.
- Keep repairs isolated on `codex/transaction-fields` until core flows are verified.
- Prefer fixing data consistency and API contract issues before UI polishing or structural refactors.
- Update this document as logic audit and fixes progress.

## Audit Scope

Core flows currently in scope:

1. Authentication and account recovery
2. User summary and activity timeline
3. Shop purchase and sponsor flows
4. Asset ownership, transfer, sponsor registration
5. Buyback application and admin approval
6. Admin item, transaction, VIP, and transfer management
7. Import flows and their consistency with transaction and ownership data

## Current Status

### Verified / Checked

- Local repo is connected to GitHub repo `cnqiujunhu-dev/shiyuan-website`
- Current work is isolated on branch `codex/transaction-fields`
- `frontend-vue` build passes
- `admin-vue` build passes
- Syntax check passes for the edited backend controllers
- Database-backed core verification passes through `backend/scripts/verify-core-flows.js`
  - Uses an isolated temporary MongoDB replica set so transaction/session code is exercised
  - Covers transfer, buyback submission/approval, VIP import, yearly counter reset, annual spend reset, and manual VIP downgrade rules

### Repaired

1. User activity timeline parameter mismatch
   - Frontend activity page now sends `from` / `to`
   - Backend activity endpoint accepts both old and new date parameter names
   - Backend returns both `transactions` and `activities` for compatibility

2. Admin transaction list filter mismatch
   - Backend now supports filtering by `user` keyword from the admin UI
   - Backend now supports `date_from` / `date_to` filtering

3. Transaction import price mismatch
   - Admin transaction import now uses input `price` when provided
   - Invalid numeric price input is rejected instead of silently falling back

4. Authorization import transaction history gap
   - `importAuthorizations()` now also creates `Transaction` records
   - Imported authorization data now has a transaction trail consistent with ownership data

5. Transfer ownership chain completeness
   - Transfer flow now creates `transfer_out` and `transfer_in` ownership records
   - Original self ownership is preserved in inactive state for rollback recovery
   - Transfer chain now supports buyback lookup and admin rollback lookup

6. Buyback approval safety
   - Approval now executes buyback first and only marks the application approved after success
   - Missing transfer chain now fails the approval instead of silently producing a fake approved state
   - Completed buyback closes the original `transfer_out` chain so it cannot be submitted again

7. Transfer admin list contract
   - Admin transfer list now supports `start_date` / `end_date` / `user` filtering
   - Backend transfer list now returns the shaped fields expected by the admin page

8. Summary contract normalization
   - User summary store now accepts both old and new response shapes
   - Aliases are normalized so existing pages can read `points_total` or `total_points`, `transfer_remaining` or `transfer_quota_remaining`, and related fields consistently

9. VIP import and management contract
   - VIP import now accepts the admin page payload shape `{ vips: [...] }`
   - VIP import now writes platform, platform ID, annual spend, and returns a stable `success / failed / errors` response shape
   - VIP customer list now supports keyword search from the admin UI
   - VIP customer edit now persists `points_total`, `transfer_remaining`, `buyback_remaining`, and related counters instead of silently ignoring them
   - VIP level list / create / update now map correctly between backend fields (`threshold`, `perks.*`) and admin page fields (`points_threshold`, `repurchase_per_year`, `free_grab_per_year`, `vip_priority`)

10. Account and summary chain alignment
   - Auth endpoints now consistently return validator errors as `400` instead of falling through to server errors on invalid payloads
   - Login response now includes annual spend and remaining annual quotas used by user pages
   - Summary endpoint now exposes `skip_queue_remaining`
   - Shop, Help, and VIP pages now prefer real-time summary data instead of stale login-only fields

11. User and item admin contract fixes
   - User list/detail responses now include a stable `id` alias so the admin edit flow no longer depends on missing fields
   - Item create/update/import now support `priority_only` and `queue_enabled`
   - Admin item form now exposes VIP priority purchase and queue-limit controls
   - User VIP benefits page now reads live VIP tier configuration from the backend instead of a hardcoded local table

12. Related guard fixes
   - Sponsor registration now blocks assigning a pending sponsor record to a user who already owns the item
   - User application history now correctly supports filtering by application type

13. Database-backed verification fixes
   - Added `npm run verify:core` for repeatable core-flow verification
   - Fixed duplicate buyback submission detection when `payload.ownership_id` is stored as an ObjectId inside a Mixed payload
   - Annual spend reset now only clears `annual_spend`; VIP downgrade remains a manual admin action after review
   - Admin annual reset confirmation text now matches the manual downgrade workflow

14. Cross-view feedback contract fixes
   - Admin and user API clients now throw on non-2xx responses instead of returning error JSON as if the action succeeded
   - Frontend login, registration, password reset, buyback, transfer, sponsor, email verification, and purchase flows now surface backend error messages when available
   - Admin item import and status toggles now surface backend error messages when available
   - Checked admin item/user/transaction/transfer/application list filters against backend query parameters; no remaining mismatch found in this pass

15. Registration flow optimization
   - Registration is now email-first: `POST /api/auth/register/send-code` sends a registration verification code, and `POST /api/auth/register` creates the user only after the code is validated
   - Pending registration codes are stored separately from `User` records with hashed codes, expiry, retry count, resend cooldown, and TTL cleanup
   - New registrations create users with `email_verified_at` already set and return the normal login payload, so the frontend can enter the app immediately
   - Registration page now requires email, password confirmation, 6-digit code entry, resend countdown, and early username/email conflict checks
   - Fixed password reset payload naming from `newPassword` to backend-supported `new_password`
   - `npm run verify:core` now includes verified-email registration coverage

## Open Findings

### High Priority

- None currently after core database verification.

### Under Review

1. Remaining UI consistency audit
   - Toast signatures are now functionally safe, but admin pages still use a mix of direct `(type, title, message)` calls and local `(message, type)` wrappers
   - Optional cleanup: extract a small admin toast helper/composable if this branch will continue UI polish

2. Commit organization
   - Decide whether to keep this as one repair batch on `codex/transaction-fields` or split logical batches before committing

## Verification Log

- `npm run verify:core` in `backend`
- `node -c backend/controllers/meController.js`
- `node -c backend/controllers/admin/transactionController.js`
- `node -c backend/controllers/assetController.js`
- `node -c backend/controllers/applicationController.js`
- `node -c backend/controllers/admin/applicationController.js`
- `node -c backend/controllers/admin/transferController.js`
- `node -c backend/controllers/admin/vipController.js`
- `node -c backend/controllers/authController.js`
- `node -c backend/controllers/admin/userController.js`
- `node -c backend/controllers/admin/itemController.js`
- `node -c backend/controllers/shopController.js`
- `node -c backend/routes/shop.js`
- `node -c backend/scripts/verify-core-flows.js`
- `npm run build` in `frontend-vue`
- `npm run build` in `admin-vue`

## Next Actions

1. Continue the remaining cross-view audit for non-core pages and feedback components
2. Decide whether to keep documenting fixes on `codex/transaction-fields` only or start splitting logical batches for commit history
3. Record each repair and verification step here
