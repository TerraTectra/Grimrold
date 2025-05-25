"""Deployment configuration settings."""
from pathlib import Path
from typing import Dict, Any

# Base directories
BASE_DIR = Path(__file__).parent.parent
DEPLOY_DIR = BASE_DIR / "deployed_projects"
LOG_DIR = BASE_DIR / "deploy_logs"

# Deployment settings
DEPLOY_SETTINGS = {
    "local": {
        "type": "local",
        "deploy_dir": str(DEPLOY_DIR),
        "python_path": "python",
        "host": "localhost",
        "port": 8000,
        "log_file": str(LOG_DIR / "deploy.log"),
    },
    # Add other deployment targets (e.g., remote servers) here
}

# Notification settings
NOTIFICATION_SETTINGS = {
    "enabled": True,
    "email": {
        "enabled": False,
        "smtp_server": "smtp.example.com",
        "smtp_port": 587,
        "username": "user@example.com",
        "password": "your_password",
        "from_email": "deploy@example.com",
        "to_emails": ["admin@example.com"],
    },
    "slack": {
        "enabled": False,
        "webhook_url": "https://hooks.slack.com/services/...",
        "channel": "#deployments",
    },
    "telegram": {
        "enabled": True,
        "bot_token": "your_telegram_bot_token",
        "chat_id": "your_chat_id",
    },
}

# Application settings
APP_SETTINGS = {
    "calculator": {
        "name": "Calculator App",
        "entry_point": "simple_calculator.py",
        "requirements": ["fastapi", "uvicorn"],
        "port": 8000,
    },
    # Add other applications here
}

def get_settings() -> Dict[str, Any]:
    """Return the current deployment settings."""
    return {
        "deploy": DEPLOY_SETTINGS["local"],
        "notifications": NOTIFICATION_SETTINGS,
        "apps": APP_SETTINGS,
    }
