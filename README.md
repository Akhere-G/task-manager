# TaskFlow

A task manager with calendar, board and repeating tasks, AI suggestions you can accept or ignore, and an assistant interface that lets tools like Claude manage your tasks with scoped, revocable access.

**[Live site](https://taskflow-752853711822.europe-west2.run.app/addtask)** · **[Try the demo](https://taskflow-752853711822.europe-west2.run.app/demo)** (no sign-up needed) · [CI workflow](.github/workflows/ci.yml)

![The TaskFlow task list, grouped into overdue, today and upcoming](task-manager-frontend/public/screenshots/taskflow-list.png)

<table>
  <tr>
    <td><img src="task-manager-frontend/public/screenshots/taskflow-board.png" alt="Kanban board with To Do, In Progress and Done columns"><br><sub>Kanban board</sub></td>
    <td><img src="task-manager-frontend/public/screenshots/taskflow-matrix.png" alt="Eisenhower matrix view"><br><sub>Eisenhower matrix</sub></td>
  </tr>
  <tr>
    <td><img src="task-manager-frontend/public/screenshots/taskflow-week.png" alt="Week calendar view on a busy week"><br><sub>Calendar: week</sub></td>
    <td><img src="task-manager-frontend/public/screenshots/taskflow-day.png" alt="Day calendar view on a busy day"><br><sub>Calendar: day</sub></td>
  </tr>
  <tr>
    <td><img src="task-manager-frontend/public/screenshots/taskflow-brief.png" alt="AI daily brief"><br><sub>AI daily brief</sub></td>
    <td><img src="task-manager-frontend/public/screenshots/taskflow-add-task.png" alt="Add task form with schedule, reminders and repeat options"><br><sub>Add task</sub></td>
  </tr>
  <tr>
    <td><img src="task-manager-frontend/public/screenshots/taskflow-stats-1.png" alt="Statistics: completion rate, activity heatmap, productivity and deadlines charts"><br><sub>Statistics: overview</sub></td>
    <td><img src="task-manager-frontend/public/screenshots/taskflow-stats-2.png" alt="Statistics: project breakdown, weekly flow, turnaround and estimation accuracy"><br><sub>Statistics: trends</sub></td>
  </tr>
</table>

Screenshots are from the demo account's sample data.

## What it does

* **Calendar, list and Eisenhower matrix views:** drag a task onto a new day to reschedule it, or onto a quadrant to change its priority.
* **Kanban board:** each project has columns, and each column can complete, reopen or trash a card dropped into it.
* **Repeating tasks:** daily, weekly, monthly or yearly repeats, with chosen days, that show on the calendar ahead of time.
* **Reminders:** several push reminders per task.
* **AI that suggests, never decides:** priority suggestions, task breakdown and quick-add all wait for you to accept them.
* **Stats:** progress over time, backlog health, upcoming deadlines and where your time goes.
* **Connect Claude:** an MCP server exposes 36 tools to AI assistants (see [Connect Claude](#connect-claude-mcp)).

<details>
<summary>Full feature list</summary>

* **Smart Views:** Inbox, Today, Upcoming, Overdue, This week and This month sit in a sidebar (a closable panel on mobile), each with a live count. Switch any view between a list, a calendar and an Eisenhower matrix (priorities 1 to 4 as four quadrants; drag a task to another quadrant to change its priority); everything, including search and sort, lives in the URL so views can be bookmarked.
* **Kanban Board:** Pick a project and switch to Board to see its tasks as cards in columns. Every project starts with To Do, In Progress and Done; add, rename, recolour, reorder or delete your own. Each column decides what dropping a card does: do nothing, mark it complete, mark it incomplete, or move it to the trash. Tasks without a column sit in an Unassigned column, and each column shows a count chip.
* **Projects & Labels:** Organise tasks into nested projects and tag them with labels. Pick a project, or "All", from the sidebar to filter the list.
* **Inbox:** Capture a title-only task in one line, with no date or project, and triage it later.
* **Priorities:** Mark tasks P1 to P4, then filter or sort by priority.
* **Subtasks:** Break a task into a checklist with its own completion. The parent shows progress and completing it completes the open subtasks.
* **Drag to Reorder:** Sort by "Manual" and drag cards into the order you want, with mouse, touch or keyboard. The order is saved.
* **Seamless Habits:** Set tasks to repeat daily, weekly, monthly or yearly, with every-N intervals and chosen days. The system projects 'ghost tasks' into your future calendar so you can plan for upcoming commitments.
* **Snooze:** Move a task to tomorrow, the weekend, next week or a date, keeping its time of day. Repeating tasks can skip to their next occurrence.
* **Reminders:** Add several reminders per task: 30 minutes or 1 hour before, at the start of the day, or at a set time. Push notifications are sent by the reminder runner (see below).
* **Trash:** Deleted tasks are kept for 30 days and can be restored.
* **Priority Suggestions (AI):** From the matrix, ask the AI to review your open tasks and propose priority changes with a short reason each. Select the ones you want and accept them together, or dismiss the rest.
* **Your Daily Brief (AI Coach):** Start your day with an AI coach that reviews pending and overdue tasks to suggest the best plan of action for a productive morning.
* **Break It Down (AI Subtasks):** The built-in AI splits a large task into a clear checklist of smaller steps, saved as real subtasks.
* **Quick-Add Tools:** Add tasks instantly by typing naturally with our AI assistant, or upload a CSV file to import many at once. Download a simple or advanced CSV template with examples of dated, dateless and repeating tasks. The time zone is taken from your browser, and you can export your tasks as CSV from Settings.
* **Pomodoro Timer:** Boost focus using timed work intervals. When a session finishes you can mark the task complete straight away.
* **Performance Summary:** Monitor progress with a year-long activity map, tracking your overall 'Backlog Health' and daily productivity metrics.
* **Planning & Deadlines:** Visualise the week ahead to review upcoming deadlines. Dedicated charts highlight how close your due dates are and flag overdue items.
* **Workload Insights:** See where your time goes with breakdowns of time spent per project over a rolling seven-day window.

</details>

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI["React + TypeScript<br/>TanStack Query"]
  end
  subgraph Backend["Flask API (Cloud Run)"]
    R["Routes"] --> SV["Services"] --> M["SQLAlchemy models"]
    MCP["POST /mcp<br/>36 tools"] --> SV
  end
  UI -- "REST + cookie JWT" --> R
  M --> PG[("PostgreSQL")]
  SV --> RD[("Redis<br/>rate limits")]
  SV --> AI["Gemini / Groq"]
  CRON["Reminder job<br/>(external scheduler)"] --> PG
  CRON --> PUSH["Web push"]
  CLAUDE["Claude / MCP clients"] -- "Bearer token" --> MCP
```

* **Frontend:** React and TypeScript with Tailwind CSS. TanStack Query handles fetching and caching. Moving tasks and cards update the screen instantly, and other changes refetch. Axios refreshes the sign-in token in the background, and concurrent requests share one refresh. Recharts draws the statistics.
* **Backend:** Flask with the application factory pattern. About 59 routes call services, which call models. SQLAlchemy 2.0 and Alembic manage 13 tables on PostgreSQL. Marshmallow validates requests.
* **Auth:** JWT in HTTP-only cookies with rotating refresh tokens that are stored hashed.
* **AI:** Gemini with Groq as a fallback, behind timeouts and a daily per-user quota.
* **Delivery:** Docker Compose locally, GitHub Actions, and Google Cloud Run in production.

## Key decisions

| Decision | Why | Cost | Code |
| :--- | :--- | :--- | :--- |
| Repeating tasks are calculated, not stored | One master record, so the database stays small and a schedule change is one edit. Future occurrences are projected when the calendar needs them. | Calendar logic is harder than generating rows in advance. | [`recurrence.py`](task-manager-backend/app/utils/recurrence.py), [`task_listing.py`](task-manager-backend/app/services/task_listing.py) |
| Order stored as integers with gaps of 1,024 | A drag updates one row instead of renumbering the list. | When two neighbours run out of room the list is renumbered once, under a lock. | [`order_service.py`](task-manager-backend/app/services/order_service.py), [`ordering.py`](task-manager-backend/app/utils/ordering.py) |
| The board reuses the list's rules | A card dropped in Done is completed by the same code as ticking it off, so there is no second path to keep in step. | The board can only do what the task services allow. | [`board_service.py`](task-manager-backend/app/services/board_service.py) |
| Each reminder stores its own fire time | The background job only asks which reminders are due. | The time is recalculated whenever a task's date changes, reminders over an hour late are dropped, and the job needs an external scheduler. | [`run_reminders.py`](task-manager-backend/app/run_reminders.py) |
| MCP server for AI assistants | Assistants can use the same actions as the app instead of the app copying features into a chat window. | A second public surface: tokens are scoped read or write, stored hashed, rate limited to 120 requests a minute per token, and covered by cross-user isolation tests. | [`protocol.py`](task-manager-backend/app/mcp/protocol.py), [`registry.py`](task-manager-backend/app/mcp/registry.py) |
| Rotating refresh tokens with a grace window | A burst of requests with an expired login would otherwise each rotate the token and sign the user out. The frontend shares one in-flight refresh and the server accepts the old token for 10 seconds. | Slightly more complex token handling on both sides. | [`auth_service.py`](task-manager-backend/app/services/auth_service.py), [`api.ts`](task-manager-frontend/src/services/api.ts) |

## Testing and quality

* **Backend:** about 545 pytest tests across 71 files, run against PostgreSQL 18. Five files use property-based testing with Hypothesis, including [`test_recurrence_properties.py`](task-manager-backend/tests/utils/test_recurrence_properties.py) for the recurrence rules.
* **Frontend:** about 366 Vitest tests and 21 Playwright browser tests that run against a real backend.
* **CI:** [GitHub Actions](.github/workflows/ci.yml) runs three jobs. Frontend: lint, type check, Vitest and build. Backend: pytest against PostgreSQL. End to end: Playwright against a real backend.
* **Migrations:** 14 Alembic migrations with round-trip tests.
* **Isolation:** tests check that one user cannot read another's data through the API or the MCP server.
* **Rate limits:** about 15 route limits on Redis plus a daily AI quota per user, and security headers including a report-only content security policy.

```bash
cd task-manager-backend && python -m pytest
cd task-manager-frontend && npm test && npm run test:e2e
```

## Known limitations

* Cross-site request protection relies on SameSite cookies rather than CSRF tokens.
* The Pomodoro timer keeps its state in the browser only and does not record focus time.
* Reminders need an external scheduler such as cron or Cloud Scheduler.
* Only moves, reorders and board actions update the screen optimistically. Other changes refetch.

## Details

### Reminder runner

Reminders are sent by `python -m app.run_reminders` (run from `task-manager-backend/`). It is not started by the web app, so schedule it (cron, Cloud Scheduler or similar) at least every 5 minutes; reminders more than an hour overdue are dropped.

### AI features and data

The Daily Brief, AI quick-add, task breakdown and priority suggestions send task titles, descriptions and project names to the configured AI providers (Google Gemini, with Groq as a fallback). Nothing is sent unless you use those features.

### Connect Claude (MCP)

The backend serves an [MCP](https://modelcontextprotocol.io) endpoint at `/mcp` so Claude Code and Claude Desktop can read and manage your tasks, subtasks, projects, labels and kanban columns, and read your productivity stats.

1. In **Settings → Connect Claude**, create a token. Choose *Read only* if Claude should only look, or *Read and write*. The token is shown once; only a hash is stored.
2. Run the command shown with the new token, for example:

   ```bash
   claude mcp add --transport http taskflow https://<your-host>/mcp --header "Authorization: Bearer <token>"
   ```

3. Ask Claude to list, create, update or delete tasks, projects, labels and columns, or how your backlog is looking.

To use it from Claude on the web, the site must be reachable from the public internet over HTTPS on port 443, because Claude connects from Anthropic's servers, not from your browser (so `localhost` cannot work). In Claude, open Customize → Connectors → Add → Add custom connector, enter `https://<your-host>/mcp`, choose "No sign in" and add the request header `Authorization` with the value `Bearer <token>` (the new-token notice shows all three). Create the token on the same site you connect to; tokens are per deployment. Request headers may not be offered on every Claude plan.

* Tools (36):
  * Tasks: `list_tasks`, `get_task`, `create_task`, `update_task` (also completes and edits subtasks), `delete_task`, `restore_task`, `list_trash`.
  * Subtasks: `add_subtasks`, `replace_subtasks`, `reorder_subtasks`.
  * Projects and labels: `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project`, `list_labels`, `create_label`, `update_label`, `delete_label`.
  * Kanban columns: `list_columns`, `create_column`, `update_column`, `reorder_columns`, `delete_column`, `move_task_to_column`.
  * Stats (read only): `get_productivity_trend`, `get_time_spent`, `get_hourly_productivity`, `get_turnaround_time`, `get_estimation_accuracy`, `get_distribution_trend`, `get_project_volume`, `get_backlog_health`, `get_overdue_distribution`, `get_deadline_proximity`, `get_week_overview`.
* Deleting a task moves it to the trash, so `restore_task` can bring it back for 30 days; a subtask is deleted permanently. Deleting a project, label or column and replacing subtasks are permanent, and the tools are marked destructive so Claude asks first. Deleting a column keeps its tasks and moves them to the column you choose, or to Unassigned.
* Tokens act as their owner, are rate limited per token (120 requests a minute) and can be revoked any time from Settings. The shared demo account cannot create them.
* The endpoint is a stateless JSON-over-HTTP subset of MCP's Streamable HTTP transport (protocol versions 2025-06-18 and 2025-03-26): one `POST /mcp`, no sessions and no server-sent events, so it runs on the existing gunicorn setup. It does not support OAuth, so it works with clients that can send a bearer header (Claude Code, and claude.ai custom connectors with a request header), not with connectors that require an OAuth sign-in.

### Product Analytics (PostHog)

The frontend sends custom product-usage events to PostHog. Before analytics-cookie consent, and after consent is declined or withdrawn, it uses PostHog's cookieless mode without storing a browser identifier. After consent, PostHog uses its normal cookie and local-storage persistence. Autocapture and session replay remain disabled.

* Set `VITE_POSTHOG_PROJECT_TOKEN` (the public project key, never a private key) and optionally `VITE_POSTHOG_HOST` (defaults to the US cloud; use `https://eu.i.posthog.com` for an EU project). These are build-time variables; the Dockerfiles take them as `_VITE_POSTHOG_PROJECT_TOKEN` and `_VITE_POSTHOG_HOST` build args.
* Signed-in users are identified by user id only. The shared demo account is never identified, and its events carry `is_demo: true`.
* Task titles, descriptions, search text, emails and names are never sent.
* Cookie preferences are stored in the browser under `taskflow_cookie_preferences`. Users can change them from Settings or the footer's Cookie settings link.

---

## Running with Docker

The root `Dockerfile` is the supported build: it builds the frontend and serves it from the Flask app on port 8080. On start it runs the database migrations (`migrate.py`, Alembic) and stops if a required step fails, then starts gunicorn (`WEB_CONCURRENCY`, `GUNICORN_THREADS` and `GUNICORN_TIMEOUT` tune it; `WEB_CONCURRENCY x 15` should stay below the database connection limit).

For local development `docker compose up --build` starts PostgreSQL, Redis and the app on http://localhost:8080 with development-only defaults; export `GEMINI_API_KEY`, `GROQ_API_KEY`, `MAIL_SEND_API_KEY` and `MAIL_SEND_EMAIL` first if you want AI and email features. Compose reads a `.env` file in the repository root if one exists, so keep it to `KEY=value` lines.


### PostgreSQL / Neon

Set `DATABASE_URL` to the connection URL from the Neon dashboard, including its
`sslmode` and `channel_binding` parameters. The app uses Psycopg 3; the standard
`postgresql://` URL works without editing the scheme. Separate `DB_HOST`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` and `DB_SSL_CA` variables are no longer
used. Install backend dependencies with `pip install -r requirements.txt`.

Run `python migrate.py` from `task-manager-backend/` to create the schema in a new
PostgreSQL database. These migrations create the PostgreSQL schema; they do not
copy existing MySQL data. Transfer existing data separately before switching the
production connection URL.

Backend tests use a local `task_manager_test` database. Override its connection
with `TEST_DATABASE_URL` (default
`postgresql://postgres:postgres@127.0.0.1:5432/task_manager_test`). The role must be
able to create databases. End-to-end tests use `E2E_DATABASE_URL` with the same
local defaults and database name `task_manager_e2e`. Docker Compose exposes
PostgreSQL on port 5433 for running these tests from the host.
