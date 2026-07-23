# SSO and production domain

## Production domain

The GCP deployment defaults to `packplay.pro`. Caddy obtains and renews the TLS
certificate automatically, and the API uses the same canonical HTTPS origin for
CORS, verification links, password-reset links, invitations, and Google SSO
callbacks.

Create `A` and `AAAA` records for `packplay.pro` that target the production
instance. If an sslip.io preview hostname is still published, retain it as a
second Caddy site and issue a permanent redirect to
`https://packplay.pro{uri}`. The exact preview hostname is deployment-specific
and is intentionally not embedded in the repository.

## Google sign-in

Create a Google OAuth web client and register this production redirect URI:

```text
https://packplay.pro/api/auth/sso/google/callback
```

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a random
`SSO_STATE_ENCRYPTION_KEY` of at least 16 characters in the deployment secret
store. Do not commit these values.

The backend uses Authorization Code flow with PKCE, a ten-minute one-time state,
nonce verification, and local RS256 signature validation against Google's JWKS.
It never automatically merges accounts that share an email. A user must sign in
with an existing method and explicitly link Google. The last available sign-in
method cannot be removed.

The API exposes:

| Method   | Route                             | Authentication     |
| -------- | --------------------------------- | ------------------ |
| `POST`   | `/api/auth/sso/google/start`      | Public             |
| `GET`    | `/api/auth/sso/google/callback`   | One-time SSO state |
| `POST`   | `/api/auth/sso/google/link/start` | JWT                |
| `GET`    | `/api/auth/sso/methods`           | JWT                |
| `DELETE` | `/api/auth/sso/GOOGLE`            | JWT                |

Google's current server-side OpenID Connect guidance requires validating the
signature, issuer, audience, and expiry. PackPlay additionally validates the
request nonce and verified-email claim.
