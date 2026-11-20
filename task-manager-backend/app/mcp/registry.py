from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from typing import Any

from marshmallow import Schema

from app.mcp.schemas import input_json_schema
from app.models import TokenScope

ToolRunner = Callable[[int, Any], dict[str, Any]]


@dataclass(slots=True, frozen=True)
class Principal:
    user_id: int
    scope: TokenScope


@dataclass(slots=True, frozen=True)
class Tool:
    name: str
    title: str
    description: str
    input: type[Schema]
    scope: TokenScope
    run: ToolRunner
    takes_id: bool = False
    destructive: bool = False
    idempotent: bool = False

    def definition(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "inputSchema": input_json_schema(self.input, self.takes_id),
            "annotations": {
                "readOnlyHint": self.scope is TokenScope.READ,
                "destructiveHint": self.destructive,
                "idempotentHint": self.idempotent,
            },
        }


class ToolRegistry:
    def __init__(self, tools: Iterable[Tool]) -> None:
        self._tools: dict[str, Tool] = {}
        for tool in tools:
            if tool.name in self._tools:
                raise ValueError(f"Duplicate tool name: {tool.name}")
            self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def __iter__(self) -> Iterator[Tool]:
        return iter(self._tools.values())
