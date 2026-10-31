from typing import Any

import pytest
from marshmallow import Schema, ValidationError

from app.errors import flatten_validation_errors


def load_errors(schema: Schema, body: Any) -> Any:
    with pytest.raises(ValidationError) as caught:
        schema.load(body)
    return flatten_validation_errors(caught.value.messages)
