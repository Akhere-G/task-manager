from app.mcp.tools.labels import LABEL_TOOLS
from app.mcp.tools.projects import PROJECT_TOOLS
from app.mcp.tools.tasks import TASK_TOOLS

TOOLS = (*TASK_TOOLS, *PROJECT_TOOLS, *LABEL_TOOLS)
