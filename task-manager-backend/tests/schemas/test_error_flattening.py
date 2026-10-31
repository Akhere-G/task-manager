from app.errors import flatten_validation_errors


def test_each_field_keeps_its_first_message() -> None:
    messages = {"title": ["Title is required.", "Too short."], "_schema": ["Bad."]}

    assert flatten_validation_errors(messages) == {
        "title": "Title is required.",
        "general": "Bad.",
    }


def test_bulk_errors_are_listed_per_item_with_gaps_kept() -> None:
    messages = {2: {"title": ["Title is required."]}}

    assert flatten_validation_errors(messages) == [
        {},
        {},
        {"title": "Title is required."},
    ]


def test_a_bare_list_is_a_general_error() -> None:
    assert flatten_validation_errors(["Invalid input type."]) == {
        "general": "Invalid input type."
    }
