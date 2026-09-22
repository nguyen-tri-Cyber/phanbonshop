# ADR-001: Use Google Identity Services for verified Gmail accounts

## Status

Accepted

## Date

2026-09-22

## Context

Public email/password registration allows disposable or mistyped accounts. The first identity-hardening step must verify a real Gmail account while preserving the current application JWT and refresh-token architecture.

## Decision

Use Google Identity Services to obtain an ID token in the browser and verify it in auth-service with Google's official Node.js library. Accept only tokens for the configured Web Client ID with a verified `@gmail.com` address. Store Google `sub` in an `ExternalIdentity` record with a database unique constraint and issue the application's existing JWT session only after verification.

An existing user with the exact verified Gmail address is linked instead of duplicated. Tokens from Google are never persisted. Non-Gmail Google accounts are not automatically linked in this phase.

## Alternatives Considered

### Email OTP through Gmail SMTP

- Pro: works with any email client.
- Con: disposable addresses remain possible and SMTP delivery does not prove a Google identity.
- Rejected for the first phase because the stated priority is real Gmail identity.

### Store Google access and refresh tokens

- Pro: allows calling Google APIs later.
- Con: unnecessary privilege and secret-storage risk for authentication-only scope.
- Rejected because this application only needs identity.

### Use email as the provider identifier

- Pro: simpler schema.
- Con: email can change and is not Google's stable account identifier.
- Rejected in favor of Google `sub`.

## Consequences

- Deployment requires a Google Web OAuth Client ID and matching authorized JavaScript origins.
- Google-only users have no local password until a separate password-setting flow is added.
- Phone/SMS identity remains a later independent capability.
