# M11: Deployment hardening

> **Severity:** Medium · **Category:** Reliability / security · **Effort:** Small to Medium · **Status:** Specified, not implemented
> **Finding status:** Confirmed artefacts; impact depends on how images are built and deployed (unknown to the audit).
> **Depends on:** [H3](h3-hardcoded-db-default.md) (required env), [H4](h4-redis-rate-limiting.md) (Redis service), [M3](m3-engine-options.md) (connection arithmetic), [M12](m12-tests-and-ci.md).

## 1. Context and evidence

Root `Dockerfile` (the supported build, serves SPA + API):
- `:42-43` start script runs `python init_db.py` then `gunicorn --bind 0.0.0.0:8080 "app.main:create_app()"` with **defaults**: 1 sync worker, 30 s timeout. A slow AI call blocks every other request.
- Script written with `echo '...\n'`; no `set -e`. `init_db.py` swallows step failures (`run_step` prints and continues), so the app starts on a half-migrated schema.
- Runs as root; `npm install` instead of `npm ci`.
- The repo root has **no `.dockerignore`** and is the build context, so `task-manager-backend/.dockerignore` does not apply. A local `docker build` copies `venv/` (≈224 MB), `app/node_modules` (≈27 MB), `__pycache__` and `task-manager-backend/.env` into the image.

Other artefacts:
- `task-manager-backend/Dockerfile:32-34`: runs `python app/init_db.py` (the file is `init_db.py`) and `app.main:app` (no module-level `app`), so it cannot start.
- `docker-compose.yml`: builds `./backend` and `./frontend` (they are `task-manager-backend`/`task-manager-frontend`), maps `5173:80` while nginx listens on 8080, uses different build-arg names, and hardcodes a root DB password.

## 2. Goals and non-goals

**Goals**
- A container that cannot start broken, serves concurrent requests, runs unprivileged and contains no secrets.
- A working local stack for contributors.

**Non-goals**
- Moving off Cloud Run; Terraform/IaC; multi-stage caching optimisations.

## 3. Design

### 3.1 Root `Dockerfile`
- Pin base tags (`node:20-alpine` → pinned minor, `python:3.11-slim` → pinned minor).
- `npm ci` in the frontend stage.
- Create a non-root user (`adduser --system app`), `chown` `/app`, `USER app`.
- Replace the echo-generated script with a committed `docker/start.sh`:
  ```sh
  #!/bin/sh
  set -e
  python init_db.py
  exec gunicorn --bind "0.0.0.0:${PORT:-8080}" \
       --workers "${WEB_CONCURRENCY:-2}" --threads "${GUNICORN_THREADS:-4}" \
       --timeout "${GUNICORN_TIMEOUT:-60}" --access-logfile - --error-logfile - \
       "app.main:create_app()"
  ```
- Connection arithmetic (see [M3](m3-engine-options.md)): `WEB_CONCURRENCY × (pool_size + max_overflow)` must stay below the DB connection limit; document in README.

### 3.2 `init_db.py` strictness
- Classify steps: **critical** (tables, columns, indexes, backfills) vs **optional** (completion trigger, which needs the TRIGGER privilege).
- Critical failure: log and `sys.exit(1)`. Optional failure: log WARNING and continue.
- Print a one-line summary at the end.

### 3.3 `.dockerignore` (new, at the repo root)
`.git`, `.github`, `.env*`, `**/venv`, `**/.venv`, `**/node_modules`, `**/__pycache__`, `**/*.pyc`, `**/dist`, `**/dev-dist`, `docs`, `**/tests`, `*.md` except what the image needs (none). Keep `ca.pem`.

### 3.4 Remove or fix the rest
- Delete `task-manager-backend/Dockerfile` and `task-manager-backend/.dockerignore` (superseded by the root build).
- Rewrite `docker-compose.yml` for local development: services `db` (mysql:8, credentials from `.env`, no hardcoded password, healthcheck), `redis` (redis:7, healthcheck), `app` (build `.`, `env_file: .env`, `depends_on` healthy, port 8080).
- Frontend `Dockerfile`/`nginx.conf`: keep only if the SPA is deployed separately (Vercel config also exists). Default: keep, use `npm ci`, and add gzip + security headers from [L7](l7-seo-caching-headers.md). State the decision in the README.
- README: "Build and run" section explaining the root Dockerfile is the supported build.

## 4. Data and migration

None, but deploy ordering matters for specs that add columns ([M6](m6-token-hardening.md), [M8](m8-reminder-job.md)): `init_db.py` runs before the new code serves traffic.

## 5. Security and failure behaviour

- No `.env` or `venv` in image layers (verify with `docker history` / `docker run --entrypoint sh … ls -a /app`).
- Non-root user cannot write to code directories.
- A failed critical migration stops the revision from becoming ready (Cloud Run keeps the previous revision serving).

## 6. Test plan

- CI step (optional): `docker build .` then `docker run --rm image sh -c 'test ! -e /app/.env && test ! -d /app/venv'`.
- `init_db.py` exit codes: simulated failing critical step exits 1; failing trigger step exits 0.
- Compose smoke test: `docker compose up`, `curl localhost:8080/health`.

## 7. Verification

`docker build`, inspect image size drop and contents, run as non-root (`docker run … id -u` ≠ 0), load-test two concurrent slow requests to see both served (workers/threads).

## 8. Dependencies

- [H3](h3-hardcoded-db-default.md), [H4](h4-redis-rate-limiting.md), [M3](m3-engine-options.md), [M12](m12-tests-and-ci.md), [L7](l7-seo-caching-headers.md).

## 9. Open questions and user-only actions

- **You:** how are production images built (Cloud Build trigger from GitHub, `gcloud run deploy --source`, local `docker build`)? That determines how serious the `.env`-in-image risk is today.
- **You:** set Cloud Run CPU/memory and `WEB_CONCURRENCY` consistently.
- Keep or drop the frontend-only image?
