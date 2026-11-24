"""Manual order: integer positions with gaps, so a move rewrites a single row."""

from collections.abc import Iterable

from app.constants import SORT_ORDER_GAP


def position_between(above: int | None, below: int | None) -> int | None:
    """A position between two neighbours, or None when no whole number fits.

    `above` is the neighbour the task goes after, `below` the one it goes before.
    A missing neighbour means the top or the bottom of the list.
    """
    if above is None and below is None:
        return 0
    if above is None:
        return below - SORT_ORDER_GAP  # type: ignore
    if below is None:
        return above + SORT_ORDER_GAP
    middle = (above + below) // 2
    return middle if above < middle < below else None


def spread(count: int) -> list[int]:
    """Evenly spaced positions for `count` tasks, in list order."""
    return [(index + 1) * SORT_ORDER_GAP for index in range(count)]


def follow_order(wanted: Iterable[int], current: list[int]) -> list[int]:
    known = set(current)
    listed = [item for item in dict.fromkeys(wanted) if item in known]
    listed_set = set(listed)
    return listed + [item for item in current if item not in listed_set]
