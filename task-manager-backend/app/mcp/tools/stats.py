from collections.abc import Callable
from typing import Any

from marshmallow import fields, validate

from app.mcp.registry import Tool
from app.mcp.schemas import EmptySchema
from app.models import TokenScope
from app.schemas.base import CamelSchema
from app.services.stats_service import (
    TREND_DAYS,
    Stats,
    StatsContext,
    backlog_health,
    deadline_proximity,
    distribution_trend,
    estimation_accuracy,
    hourly_productivity,
    overdue_distribution,
    productivity_trend,
    project_volume,
    time_spent,
    turnaround_time,
    week_overview,
)
from app.utils.formatters import format_json_response

DEFAULT_PRODUCTIVITY_DAYS = 30
COUNTING_RULE = "Subtasks and trashed tasks are not counted. Days are UTC."


class ProductivityQuerySchema(CamelSchema):
    days = fields.Integer(
        load_default=DEFAULT_PRODUCTIVITY_DAYS,
        strict=True,
        validate=validate.Range(min=1, max=TREND_DAYS),
    )


def _productivity(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    trend = productivity_trend(StatsContext(user_id), data["days"])
    return {"productivity": format_json_response(trend)}


def _backlog_health(ctx: StatsContext) -> Stats:
    return backlog_health(project_volume(ctx))


def _stat_tool(
    name: str,
    title: str,
    description: str,
    key: str,
    compute: Callable[[StatsContext], Stats],
) -> Tool:
    def run(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        return {key: format_json_response(compute(StatsContext(user_id)))}

    return Tool(
        name=name,
        title=title,
        description=f"{description} {COUNTING_RULE}",
        input=EmptySchema,
        scope=TokenScope.READ,
        run=run,
    )


STATS_TOOLS = (
    Tool(
        name="get_productivity_trend",
        title="Get the daily productivity trend",
        description=(
            "Tasks completed and minutes of work (timeSpent) for each of the last "
            f"`days` days, oldest first. Default {DEFAULT_PRODUCTIVITY_DAYS}, at "
            f"most {TREND_DAYS}. {COUNTING_RULE}"
        ),
        input=ProductivityQuerySchema,
        scope=TokenScope.READ,
        run=_productivity,
    ),
    _stat_tool(
        "get_time_spent",
        "Get time spent per project",
        "Minutes of work (the scheduled length of completed tasks) per top-level "
        "project, all time, largest first.",
        "timeSpent",
        time_spent,
    ),
    _stat_tool(
        "get_hourly_productivity",
        "Get productivity by hour of day",
        "How many tasks were completed in each hour of the day (0 to 23), all "
        "time. Shows when the user gets things done.",
        "hourlyProductivity",
        hourly_productivity,
    ),
    _stat_tool(
        "get_turnaround_time",
        "Get task turnaround time",
        "How many completed tasks took 0, 1, 2 ... days from creation to "
        "completion (daysTaken, count), up to 50 days.",
        "turnaround",
        turnaround_time,
    ),
    _stat_tool(
        "get_estimation_accuracy",
        "Get estimation accuracy",
        "Tasks with a due date completed in the last 30 days, oldest first. "
        "varianceMinutes is how long before the due date the task was finished "
        "(negative when late). estimatedAt and completedAt are Unix seconds.",
        "estimationAccuracy",
        estimation_accuracy,
    ),
    _stat_tool(
        "get_distribution_trend",
        "Get the weekly completion distribution",
        "Tasks completed per day over the last 7 days, split by top-level "
        "project (the eight busiest, the rest as Other).",
        "distributionTrend",
        distribution_trend,
    ),
    _stat_tool(
        "get_project_volume",
        "Get task volume per project",
        "Completed, overdue, pending and total task counts per top-level "
        "project. Pending includes repeating tasks due in the next 30 days.",
        "projectVolume",
        project_volume,
    ),
    _stat_tool(
        "get_backlog_health",
        "Get backlog health",
        "Overall counts of completed, overdue and pending tasks across all projects.",
        "backlogHealth",
        _backlog_health,
    ),
    _stat_tool(
        "get_overdue_distribution",
        "Get how overdue tasks are",
        "Open overdue tasks grouped by how late they are: under 3 days, 1 week, "
        "1 month, 3 months, over 3 months. Empty groups are left out.",
        "overdueDistribution",
        overdue_distribution,
    ),
    _stat_tool(
        "get_deadline_proximity",
        "Get deadline proximity per project",
        "Per top-level project, the average number of days until the due date of "
        "its open tasks, including repeating tasks due in the next 30 days "
        "(score; negative means overdue on average). Furthest deadlines first.",
        "deadlineProximity",
        deadline_proximity,
    ),
    _stat_tool(
        "get_week_overview",
        "Get the week ahead",
        "Open tasks due in the next 7 days, per day: count and total scheduled "
        "time (totalMinutes, totalHours). Includes repeating tasks. Days "
        "without tasks are left out.",
        "weekOverview",
        week_overview,
    ),
)
