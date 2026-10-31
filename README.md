# TaskFlow Engine

A high-performance task engine designed to turn raw productivity data into actionable insights. Visualise your workflow, track your progress, manage your energy, and master your time.

**🔗 [Live Deployment](https://taskflow-752853711822.europe-west2.run.app/addtask)** · **🎯 [Try the demo](https://taskflow-752853711822.europe-west2.run.app/demo)** (no sign-up needed)

---

## Core Features

* **Flexible Views:** Switch between a clean list and a full calendar. Use smart filters and sorting to see exactly what needs your attention right now.
* **Seamless Habits:** Set tasks to repeat daily, weekly, or monthly. The system projects 'ghost tasks' into your future calendar so you can plan for upcoming commitments.
* **Your Daily Brief (AI Coach):** Start your day with an AI coach that reviews pending and overdue tasks to suggest the best plan of action for a productive morning.
* **Break It Down (AI Subtasks):** Avoid being overwhelmed by large projects. The built-in AI splits single large tasks into a clear, manageable checklist of smaller steps.
* **Quick-Add Tools:** Add tasks instantly by typing naturally with our AI assistant, or upload a CSV file to migrate an entire project's worth of tasks in one go.
* **Pomodoro Timer:** Boost focus using timed work intervals. When a session finishes you can mark the task complete straight away.
* **Performance Summary:** Monitor progress with a year-long activity map, tracking your overall 'Backlog Health' and daily productivity metrics.
* **Planning & Deadlines:** Visualise the week ahead to review upcoming deadlines. Dedicated charts highlight how close your due dates are and flag overdue items.
* **Workload Insights:** Understand exactly where your time goes with detailed breakdowns of time spent on different categories (e.g., work, health, or hobbies) over a rolling seven-day window.

---

## Technical Architecture

The platform is engineered on a modern full-stack architecture designed for high performance, type safety, and snappy interface responses.

### Backend Layer

The backend handles the core computational heavy lifting, database state management, and AI-driven background logic.

* **Language:** Python
* **Framework:** Flask (Application Factory Pattern)
* **ORM:** SQLAlchemy 2.0 (Modern explicit execution models)
* **Authentication:** JWT (Secure HTTP-only cookie-based rotation sessions)

### Frontend Layer

The user interface operates as a highly responsive, single-page application (SPA) focused on asynchronous data processing.

* **Core Framework:** React with TypeScript (Type-safe component design)
* **Styling:** Tailwind CSS (Utility-first responsive layout design)
* **Network Client:** Axios (Configured for credentials-backed API routing)
* **State Management:** TanStack Query (Server-state caching and seamless optimistic updates)
* **Data Visualisation:** Recharts (Dynamic rendering of workload insights and performance history)

### AI features and data

The Daily Brief, AI quick-add and task breakdown send task titles, descriptions and categories to the configured AI providers (Google Gemini, with Groq as a fallback). Nothing is sent unless you use those features.

### Product Analytics (PostHog)

The frontend can send anonymous usage events to PostHog. It is off unless configured, and it is cookieless (no cookies or localStorage, no autocapture, no session replay).

* Set `VITE_POSTHOG_PROJECT_TOKEN` (the public project key, never a private key) and optionally `VITE_POSTHOG_HOST` (defaults to the US cloud; use `https://eu.i.posthog.com` for an EU project). These are build-time variables; the Dockerfiles take them as `_VITE_POSTHOG_PROJECT_TOKEN` and `_VITE_POSTHOG_HOST` build args.
* Signed-in users are identified by user id only. The shared demo account is never identified, and its events carry `is_demo: true`.
* Task titles, descriptions, search text, emails and names are never sent.

---

## Technology Matrix

| Component | Technology | Primary Purpose |
| :--- | :--- | :--- |
| **Backend** | Python / Flask | RESTful API service orchestration |
| **Database ORM** | SQLAlchemy 2.0 | High-performance relational state mapping |
| **UI Layer** | React / TypeScript | Type-safe declarative interface building |
| **Styles** | Tailwind CSS | Consistent, hardware-accelerated design tokens |
| **Data Fetching** | Axios / TanStack Query | Asynchronous API communication and caching |
| **Analytics** | Recharts | Interactive charting and productivity telemetry |

---

## Running with Docker

The root `Dockerfile` is the supported build: it builds the frontend and serves it from the Flask app on port 8080. On start it runs the database migrations (`migrate.py`, Alembic) and stops if a required step fails, then starts gunicorn (`WEB_CONCURRENCY`, `GUNICORN_THREADS` and `GUNICORN_TIMEOUT` tune it; `WEB_CONCURRENCY x 15` should stay below the database connection limit).

For local development `docker compose up --build` starts MySQL, Redis and the app on http://localhost:8080 with development-only defaults; export `GEMINI_API_KEY`, `GROQ_API_KEY`, `MAIL_SEND_API_KEY` and `MAIL_SEND_EMAIL` first if you want AI and email features. Compose reads a `.env` file in the repository root if one exists, so keep it to `KEY=value` lines.

