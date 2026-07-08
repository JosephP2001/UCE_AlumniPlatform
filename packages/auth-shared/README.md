# @uce-platform/auth-shared

Shared JWT authentication library for the UCE Alumni & Employment Platform monorepo.

Extracted to eliminate duplicated auth middleware across services — before this
package existed, `admin-service`, `analytics-service`, and `audit-service` each
had byte-for-byte identical copies of `requireAdmin`, and other services
(`jobs-service`, `profile-service`, `messaging-service`) had similar but
subtly divergent implementations (different field names, inconsistent secret
fallback behavior).

---

## What it exports

```typescript
import {
  requireAuth,      // verifies Bearer token, attaches req.user, no role check
  requireAdmin,      // requireAuth + enforces role === 'admin'
  signAccessToken,    // signs a short-lived JWT (default 15m)
  signRefreshToken,   // signs a long-lived JWT (default 7d)
  JwtUser,            // shared payload interface
  AuthRequest,        // Express Request extended with `user?: JwtUser`
} from '@uce-platform/auth-shared';
```

### `JwtUser` — the single source of truth for the token payload

```typescript
interface JwtUser {
  id: number;
  username: string;
  name?: string;
  avatar?: string;
  provider?: string;
  role?: string;
}
```

This matches exactly what `auth-service` issues after GitHub OAuth login. Any
service consuming this package should read `req.user.id`, never `userId` —
enforcing this at the type level is the whole point of centralizing it here.

---

## Usage in a service

**`package.json`:**
```json
"dependencies": {
  "@uce-platform/auth-shared": "*"
}
```

**In routes:**
```typescript
import { requireAdmin, AuthRequest } from '@uce-platform/auth-shared';

router.get('/users', requireAdmin, (req: AuthRequest, res) => {
  const currentUserId = req.user!.id;
  // ...
});
```

**In `auth-service` (signing, not just verifying):**
```typescript
import { signAccessToken, signRefreshToken } from '@uce-platform/auth-shared';

const accessToken = signAccessToken(payload);
const refreshToken = signRefreshToken({ id: githubUser.id, role });
```

---

## Environment

Requires `JWT_SECRET` to be set in the consuming service's environment.
Both `requireAuth`/`requireAdmin` and the signing functions throw
(`fail-closed`) if `JWT_SECRET` is missing — there is intentionally **no**
fallback secret. A prior bug in `messaging-service` used
`process.env.JWT_SECRET || 'default_secret'`, which would have silently
accepted forged tokens if the env var was ever missing.

---

## Build

```bash
npx nx build auth-shared
```

Nx automatically builds this package first when building any service that
depends on it, thanks to `targetDefaults.build.dependsOn: ["^build"]` in the
root `nx.json`. So `npx nx build admin-service` handles the ordering for you
— this also applies transparently inside each service's Docker multi-stage
build (`npm run build --workspace=packages/auth-shared` runs before the
service's own build step).

---

## Migration status

| Service | Status |
|---|---|
| `admin-service` | ✅ migrated — middleware swap complete |
| `analytics-service` | ✅ migrated — middleware swap complete |
| `audit-service` | ✅ migrated — middleware swap complete |
| `profile-service` | ⬜ pending |
| `jobs-service` | ⬜ pending |
| `messaging-service` | ⬜ pending (bug-fixed separately in `fix/messaging-userid-mismatch`, not yet migrated to this package) |
| `auth-service` | ⬜ pending (signing functions only) |
