"""Add project columns for the kanban board and tasks.column_id.

Revision ID: 0012
Revises: 0011
"""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

DEFAULT_COLUMNS = (
    ("To Do", "pending", "#64748b", "uncomplete"),
    ("In Progress", "in_progress", "#3b82f6", "uncomplete"),
    ("Done", "done", "#10b981", "complete"),
)
ON_DROP_VALUES = ("nothing", "complete", "uncomplete", "delete")


def upgrade() -> None:
    op.create_table(
        "project_columns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("colour", sa.String(7), server_default="#64748b", nullable=False),
        sa.Column(
            "on_drop",
            sa.Enum(*ON_DROP_VALUES, name="on_drop"),
            server_default="nothing",
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.UniqueConstraint("project_id", "name", name="uq_project_columns_name"),
    )
    op.add_column("tasks", sa.Column("column_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_column_id",
        "tasks",
        "project_columns",
        ["column_id"],
        ["id"],
        ondelete="SET NULL",
    )
    _seed_default_columns()


def _seed_default_columns() -> None:
    connection = op.get_bind()
    project_ids = connection.execute(sa.text("SELECT id FROM projects")).scalars().all()
    for project_id in project_ids:
        column_ids = []
        for position, (name, status, colour, on_drop) in enumerate(DEFAULT_COLUMNS):
            result = connection.execute(
                sa.text(
                    "INSERT INTO project_columns "
                    "(project_id, name, status, colour, on_drop, position) "
                    "VALUES (:project_id, :name, :status, :colour, :on_drop, :position)"
                ),
                {
                    "project_id": project_id,
                    "name": name,
                    "status": status,
                    "colour": colour,
                    "on_drop": on_drop,
                    "position": position,
                },
            )
            column_ids.append(result.lastrowid)
        _assign_tasks(connection, project_id, column_ids[0], column_ids[-1])


def _assign_tasks(
    connection: sa.Connection, project_id: int, first_id: int, last_id: int
) -> None:
    connection.execute(
        sa.text(
            "UPDATE tasks SET column_id = IF(is_completed, :last_id, :first_id) "
            "WHERE project_id = :project_id"
        ),
        {"project_id": project_id, "first_id": first_id, "last_id": last_id},
    )


def downgrade() -> None:
    op.drop_constraint("fk_tasks_column_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "column_id")
    op.drop_table("project_columns")
