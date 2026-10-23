import logging
import os
from datetime import datetime, time, timedelta, timezone
from functools import wraps

import redis
from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from app import config
from app.services.auth_service import is_demo_user

logger = logging.getLogger(__name__)

_memory_counts = {}
_redis_client = None


class QuotaUnavailable(Exception):
    pass


def reset_memory_counts():
    _memory_counts.clear()


def _redis():
    global _redis_client
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(
            url, socket_connect_timeout=2, socket_timeout=2
        )
    return _redis_client


def _end_of_day(now):
    tomorrow = (now + timedelta(days=1)).date()
    return datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)


def count_ai_call(user_id, now=None):
    now = now or datetime.now(timezone.utc)
    key = f"ai:{user_id}:{now.date().isoformat()}"
    client = _redis()

    if client is None:
        _memory_counts[key] = _memory_counts.get(key, 0) + 1
        return _memory_counts[key]

    try:
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expireat(key, int(_end_of_day(now).timestamp()))
        return int(pipe.execute()[0])
    except redis.RedisError as exc:
        logger.error("AI quota store unavailable: %s", type(exc).__name__)
        raise QuotaUnavailable from exc


def ai_quota(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        limit = (
            config.AI_DAILY_LIMIT_DEMO
            if is_demo_user(user_id)
            else config.AI_DAILY_LIMIT
        )
        try:
            used = count_ai_call(user_id)
        except QuotaUnavailable:
            return jsonify({"error": "AI features are temporarily unavailable."}), 503

        if used > limit:
            return (
                jsonify({"error": "Daily AI limit reached. Try again tomorrow."}),
                429,
            )
        return view(*args, **kwargs)

    return wrapper
