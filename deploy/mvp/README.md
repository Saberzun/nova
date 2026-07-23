# Product and Entitlement MVP deployment

This directory contains the isolated development deployment used for the
product and entitlement MVP. It does not reuse the production application,
PostgreSQL database, Redis database, or persistent volumes.

## VPS layout

- Source: `/opt/codebase/new-api-mvp`
- Compose project: `/opt/new-api-mvp`
- Compose file: `/opt/new-api-mvp/compose.yaml`
- Secrets: `/opt/new-api-mvp/.env` (not committed)
- Public URL: `https://dev.itokenify.com`
- External reverse-proxy network: `web-proxy`

The Compose project creates these containers:

- `new-api-mvp`
- `new-api-mvp-postgres`
- `new-api-mvp-redis`

It also creates independent `postgres_data` and `redis_data` volumes under the
`new-api-mvp` Compose project.

## Required environment variables

Create `/opt/new-api-mvp/.env` with independently generated values:

```dotenv
POSTGRES_PASSWORD=replace-with-a-random-value
REDIS_PASSWORD=replace-with-a-random-value
SESSION_SECRET=replace-with-a-random-value
CRYPTO_SECRET=replace-with-a-random-value
```

Do not copy production credentials into this file.

## Deploy

```bash
cd /opt/new-api-mvp
docker compose build app
docker compose up -d
docker compose ps
```

The checked-in Caddyfile is a reference for the shared Caddy deployment. The
production site continues to proxy to `new-api:3000`; only the development
site proxies to `new-api-mvp:3000`.

Before public HTTPS validation, DNS must contain:

```text
A  dev.itokenify.com  45.77.34.129
```

After DNS is authoritative, Caddy obtains the certificate automatically. Check
the deployment with:

```bash
curl -fsS https://dev.itokenify.com/api/status
```

## Seeded acceptance configuration

The current development database uses these example policies:

| Group | Funding source | Ratio |
|---|---|---:|
| `gpt-mix-sub` | `subscription` | 1.3 |
| `gpt-pro-sub` | `subscription` | 1.0 |
| `gpt-pro-paygo` | `stored_value` | 0.3 |

`GPT_PRO_MIX_SUB` allows both subscription groups to share one entitlement
balance. `GPT_PRO_PAYGO` allows only the stored-value group. The development
catalog contains multiple SKUs per entitlement type so that SKU pricing and
grant rules remain separate from the reusable access policy.
