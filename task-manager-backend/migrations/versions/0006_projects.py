"""Add user projects and turn every category a user has used into one.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

DEFAULT_COLOUR = "#64748b"
CATEGORY_COLOURS = {
    "work": "#6366f1",
    "home": "#8b5cf6",
    "chores": "#94a3b8",
    "life-admin": "#0ea5e9",
    "health": "#10b981",
    "self-care": "#ec4899",
    "social": "#f59e0b",
    "hobbies": "#f43f5e",
    "learning": "#3b82f6",
    "finance": "#059669",
    "general": DEFAULT_COLOUR,
}


def _project_name(category: str) -> str:
    return category.replace("-", " ").capitalize()


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "colour", sa.String(7), server_default=DEFAULT_COLOUR, nullable=False
        ),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.UniqueConstraint("user_id", "parent_id", "name", name="uq_projects_name"),
    )
    op.add_column("tasks", sa.Column("project_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_project_id",
        "tasks",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("idx_tasks_user_project", "tasks", ["user_id", "project_id"])
    _create_projects_from_categories()


def _create_projects_from_categories() -> None:
    connection = op.get_bind()
    used = connection.execute(
        sa.text(
            "SELECT DISTINCT user_id, LOWER(TRIM(category)) FROM tasks "
            "WHERE category IS NOT NULL AND TRIM(category) <> '' "
            "ORDER BY user_id, 2"
        )
    ).all()
    positions: dict[int, int] = {}
    for user_id, category in used:
        position = positions.get(user_id, 0)
        positions[user_id] = position + 1
        result = connection.execute(
            sa.text(
                "INSERT INTO projects (user_id, name, colour, position) "
                "VALUES (:user_id, :name, :colour, :position)"
            ),
            {
                "user_id": user_id,
                "name": _project_name(category),
                "colour": CATEGORY_COLOURS.get(category, DEFAULT_COLOUR),
                "position": position,
            },
        )
        connection.execute(
            sa.text(
                "UPDATE tasks SET project_id = :project_id "
                "WHERE user_id = :user_id AND LOWER(TRIM(category)) = :category"
            ),
            {
                "project_id": result.lastrowid,
                "user_id": user_id,
                "category": category,
            },
        )


def downgrade() -> None:
    op.drop_index("idx_tasks_user_project", table_name="tasks")
    op.drop_constraint("fk_tasks_project_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "project_id")
    op.drop_table("projects")
