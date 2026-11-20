from sqlalchemy import ColumnElement, func, literal_column


def search_document(
    title: ColumnElement[str], description: ColumnElement[str]
) -> ColumnElement[str]:
    return func.to_tsvector(
        literal_column("'simple'"),
        func.coalesce(title, "") + " " + func.coalesce(description, ""),
    )
