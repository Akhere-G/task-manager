from datetime import datetime

import pytest

from app.utils.task_utils import parse_search, update_date


def test_blank_search_means_no_filter():
    assert parse_search("   ") is None
    assert parse_search("()+-*") is None


def test_long_words_use_a_prefix_fulltext_search_that_requires_every_word():
    assert parse_search("quarterly budg") == ("fulltext", "+quarterly* +budg*")


def test_short_words_fall_back_to_like():
    mode, value = parse_search("go gym")
    assert mode == "like" and value == "go gym"


def test_search_input_is_capped():
    mode, value = parse_search("x" * 500)
    assert len(value.strip("+*")) == 100


@pytest.mark.parametrize(
    "repeat_by, expected",
    [
        ("daily", datetime(2026, 3, 2)),
        ("weekly", datetime(2026, 3, 8)),
        ("monthly", datetime(2026, 4, 1)),
        ("yearly", datetime(2027, 3, 1)),
    ],
)
def test_update_date_moves_to_the_next_occurrence(repeat_by, expected):
    assert update_date(datetime(2026, 3, 1), repeat_by) == expected


def test_monthly_repeat_clamps_to_the_end_of_a_short_month():
    assert update_date(datetime(2026, 1, 31), "monthly") == datetime(2026, 2, 28)
