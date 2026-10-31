from app.utils.task_utils import MAX_SEARCH_TERMS, parse_search


def test_long_terms_use_full_text_prefix_matching() -> None:
    assert parse_search("quarterly budget") == ("fulltext", "+quarterly* +budget*")


def test_any_short_term_falls_back_to_like() -> None:
    assert parse_search("go gym") == ("like", "go gym")


def test_whitespace_is_collapsed_and_symbols_are_not_terms() -> None:
    assert parse_search("  plan   (holiday) ") == ("fulltext", "+plan* +holiday*")


def test_blank_or_symbol_only_input_is_no_search() -> None:
    assert parse_search(None) is None
    assert parse_search("   ") is None
    assert parse_search("+-*()") is None


def test_only_the_first_terms_are_used() -> None:
    words = " ".join(f"word{n}" for n in range(MAX_SEARCH_TERMS + 3))

    mode, value = parse_search(words)

    assert mode == "fulltext"
    assert value.split() == [f"+word{n}*" for n in range(MAX_SEARCH_TERMS)]
