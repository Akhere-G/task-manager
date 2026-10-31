from marshmallow import EXCLUDE, Schema, fields
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from app.utils.formatters import to_camel_case


class CamelSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    def on_bind_field(self, field_name: str, field_obj: fields.Field) -> None:
        field_obj.data_key = to_camel_case(field_obj.data_key or field_name)


class CamelAutoSchema(SQLAlchemyAutoSchema, CamelSchema):
    class Meta(CamelSchema.Meta):
        pass
