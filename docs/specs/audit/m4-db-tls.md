# M4: TLS for the database connection

> **Severity:** Medium · **Category:** Security · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Configuration gap confirmed; actual exposure **Potential** (depends on whether the provider forces TLS at its proxy).
> **Depends on:** [M3](m3-engine-options.md) (shared `connect_args`), [H3](h3-hardcoded-db-default.md) (config).

## 1. Context and evidence

- `DB_HOST` in `task-manager-backend/.env` is non-local (checked by shape only; value not recorded here).
- `app/main.py:38`, `app/database.py:34` and `init_db.py:36-42` pass no `ssl` / `ssl_ca` options. PyMySQL does not use TLS unless asked.
- `init_db.py:43` computes `ca_path = os.path.join(os.getcwd(), "ca.pem")` and never uses it. `task-manager-backend/Dockerfile` and the root image copy `ca.pem`, so the intent was clearly to use it.

**Impact:** credentials, task data and password hashes may travel in clear text to the database host.

## 2. Goals and non-goals

**Goals**
- App, standalone scripts and `init_db.py` connect with TLS and certificate verification when a CA is configured.
- Staged rollout that cannot cause an outage from a wrong CA.

**Non-goals**
- Client certificates / mutual TLS.
- Rotating the CA file.

## 3. Design

- Env `DB_SSL_CA` (path). If unset, behaviour is unchanged (no TLS) and the app logs a WARNING at startup (`"DB TLS is not configured"`). If set and the file is missing, fail fast (H3 style).
- Default path helper `resolve_ca_path()` resolves relative to the project root using `__file__`, never `os.getcwd()`.
- In `database.build_connect_args()` (from M3): `if ca: args["ssl"] = {"ca": ca}`.
- `init_db.py`: `pymysql.connect(..., ssl={"ca": ca})`; remove the unused `ca_path` variable and the dead `CREATE DATABASE`/`USE` statements (the connection already targets the database; see [L5](l5-maintainability.md)).
- `scripts/check_db_tls.py` (new, read-only): connects with the app settings and prints the result of `SHOW STATUS LIKE 'Ssl_cipher'` (non-empty means encrypted).
- `.env.example`: document `DB_SSL_CA`.

### Rollout
1. Deploy code with `DB_SSL_CA` **unset** (no behaviour change).
2. **Pre-implementation / pre-enable check:** confirm with the provider that `ca.pem` is the CA for the server certificate and that the host name matches the certificate.
3. Run `scripts/check_db_tls.py` from a staging revision with `DB_SSL_CA` set.
4. Enable in production, using traffic splitting or a revision that can be rolled back instantly.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- Verification stays on; do not set `check_hostname=False` unless the provider's certificate genuinely lacks the host name, and document that if so.
- A wrong CA makes connections fail loudly at startup rather than silently downgrading.

## 6. Test plan

- Unit: `build_connect_args()` includes `ssl` when `DB_SSL_CA` is set and omits it otherwise; missing file raises.
- CI uses a plain MySQL container, so TLS is covered by the manual script, not CI.

## 7. Verification

`python scripts/check_db_tls.py` prints a non-empty cipher; a deliberately wrong CA makes the app fail to start in staging.

## 8. Dependencies

- [M3](m3-engine-options.md), [H3](h3-hardcoded-db-default.md), [M11](m11-deployment-hardening.md) (image keeps `ca.pem`).

## 9. Open questions and user-only actions

- **You:** confirm the CA with your DB provider before step 4.
