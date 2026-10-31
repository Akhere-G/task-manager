@AGENTS.md

The backend coding rules, conventions and vocabulary live in `AGENTS.md` (imported
above) so every coding agent reads the same source. Update that file, not this one.

Before finishing a change, run `venv/bin/ruff check` and `venv/bin/ruff format --check`
on the files you touched, and `venv/bin/pytest` when a MySQL server is available.
