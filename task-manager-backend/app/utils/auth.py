from flask_jwt_extended import get_jwt_identity


def authenticated_user_id() -> int:
    return int(get_jwt_identity())
