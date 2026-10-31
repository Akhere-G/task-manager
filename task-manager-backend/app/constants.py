CATEGORIES = (
    "work",
    "home",
    "chores",
    "life-admin",
    "health",
    "self-care",
    "social",
    "hobbies",
    "learning",
    "finance",
    "general",
)

REPEAT_FREQUENCIES = ("daily", "weekly", "monthly", "yearly")
REPEAT_INTERVAL_LIMITS = {"daily": 365, "weekly": 52, "monthly": 24, "yearly": 10}

MAX_PAGE_SIZE = 200
MAX_TASKS_PER_REQUEST = 2000
MAX_PROJECTION_DAYS = 400

MAX_PARSE_TEXT_LENGTH = 500
MAX_DECOMPOSE_TITLE_LENGTH = 255
MAX_DECOMPOSE_DESCRIPTION_LENGTH = 2000
