from hypothesis import given
from hypothesis import strategies as st

from app.constants import SORT_ORDER_GAP
from app.utils.ordering import position_between, spread

positions = st.integers(min_value=-(10**12), max_value=10**12)


@given(above=positions, gap=st.integers(min_value=2, max_value=10**6))
def test_a_position_between_two_neighbours_sits_strictly_between(
    above: int, gap: int
) -> None:
    below = above + gap

    assert above < position_between(above, below) < below  # type: ignore[operator]


def test_neighbours_with_no_room_need_a_renumber() -> None:
    assert position_between(5, 6) is None
    assert position_between(5, 5) is None


def test_the_top_and_the_bottom_are_open_ended() -> None:
    assert position_between(None, 100) == 100 - SORT_ORDER_GAP
    assert position_between(100, None) == 100 + SORT_ORDER_GAP


def test_spread_keeps_the_order_with_room_between() -> None:
    result = spread(3)

    assert result == sorted(result)
    assert result[1] - result[0] == SORT_ORDER_GAP
