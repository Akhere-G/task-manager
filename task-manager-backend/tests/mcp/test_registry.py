import pytest

from app.models import TokenScope
from tests.mcp.helpers import REGISTRY, call_tool

DESTRUCTIVE = {"delete_project", "delete_label", "delete_column", "replace_subtasks"}


def test_every_tool_is_described_consistently() -> None:
    names = [tool.name for tool in REGISTRY]
    assert len(names) == len(set(names))

    for tool in REGISTRY:
        definition = tool.definition()
        hints = definition["annotations"]
        assert definition["inputSchema"]["type"] == "object", tool.name
        assert hints["readOnlyHint"] is (tool.scope is TokenScope.READ), tool.name
        assert hints["destructiveHint"] is (tool.name in DESTRUCTIVE), tool.name


@pytest.mark.integration
def test_a_read_token_is_refused_by_every_write_tool(user_id: int) -> None:
    for tool in REGISTRY:
        _, payload = call_tool(REGISTRY, user_id, tool.name, {}, TokenScope.READ)
        refused = "read-only" in str(payload)
        assert refused is (tool.scope is TokenScope.WRITE), tool.name
