# Secret Management

## Scope

PhanBonShop treats database passwords, JWT signing secrets, internal-service credentials, SMTP credentials, object-storage credentials, payment signing credentials, and TLS private keys as secrets. Provider identifiers such as a MoMo partner code may be operationally sensitive but are not signing secrets; they are still exposed only where a client actually needs them.

## Local development

- Copy `.env.example` to an untracked `.env` and use development-only values.
- Generate self-signed TLS files with `scripts/generate-self-signed-ssl.sh` or `scripts/generate-self-signed-ssl.ps1`.
- Generated `docker/nginx/certs/*.pem` and `*.key` files are ignored and must never be staged.
- Tests generate tokens and credentials at runtime; fixtures must not contain reusable credentials.

## Staging and production

- Store secrets in the deployment platform's secret manager or protected host environment, never in Git or a container image.
- Start the production compose stack with `TLS_CERTS_DIR` pointing to an external, read-only certificate directory containing `fullchain.pem` and `privkey.pem`.
- Keep payment signing secrets server-side. Public settings endpoints may return provider availability/environment only.
- Use distinct credentials for local, staging, and production environments.

## Rotation

1. Create a replacement secret in the owning system.
2. Deploy consumers with the replacement, using an overlap window only where the protocol supports it.
3. Revoke the previous value.
4. Verify authentication, payment callbacks, service-to-service calls, and audit logs.
5. Record the rotation time and affected systems without recording the secret value.

## Emergency rotation

Treat a secret committed to Git, printed in public logs, or exposed to an unauthorized party as compromised. Removing it from HEAD does not unexpose it. Immediately revoke/rotate it, audit its use, invalidate derived sessions or certificates, and only then clean repository history through a separately reviewed incident procedure.

## Certificate handling

- Certbot owns production material under its host-managed directory (normally `/etc/letsencrypt/live/<domain>`).
- Nginx receives that directory through a read-only bind mount.
- Local self-signed certificates are disposable and regenerated at runtime.
- Never copy a production private key into the repository working tree.

## Payment credentials

- `MOMO_SECRET_KEY` is a signing secret and must never leave the order service.
- `MOMO_ACCESS_KEY` and `MOMO_PARTNER_CODE` are provider identifiers used in signed requests; expose neither unless a documented client contract requires it.
- Rotate payment credentials through the provider console, deploy the new values through the secret manager, and validate create/query/IPN signatures before revoking the old credentials.

## CI enforcement

GitHub Actions runs Gitleaks against full history available to the checkout. A finding blocks the pipeline. False positives must be handled with a narrowly scoped, reviewed allowlist containing no secret values.
