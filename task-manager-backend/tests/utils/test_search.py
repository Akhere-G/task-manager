import pytest

from app.utils.task_utils import MAX_SEARCH_TERMS, parse_search


@pytest.mark.parametrize(
    "text, expected",
    [
        ("quarterly budget", ("fulltext", "quarterly:* & budget:*")),
        ("go gym", ("like", "go gym")),
        ("  plan   (holiday) ", ("fulltext", "plan:* & holiday:*")),
    ],
)
def test_search_text_picks_full_text_or_like_matching(
    text: str, expected: tuple[str, str]
) -> None:
    assert parse_search(text) == expected


def test_blank_or_symbol_only_input_is_no_search() -> None:
    assert parse_search(None) is None
    assert parse_search("   ") is None
    assert parse_search("+-*()") is None


def test_only_the_first_terms_are_used() -> None:
    words = " ".join(f"word{n}" for n in range(MAX_SEARCH_TERMS + 3))

    mode, value = parse_search(words)

    assert mode == "fulltext"
    assert value.split(" & ") == [f"word{n}:*" for n in range(MAX_SEARCH_TERMS)]
