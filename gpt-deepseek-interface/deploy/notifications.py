"""Notification manager for deployment status updates."""
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
from typing import Optional, Dict, Any
import logging

from .config import get_settings

class NotificationError(Exception):
    """Custom exception for notification errors."""
    pass

class NotificationManager:
    """Manages sending notifications for deployment events."""
    
    def __init__(self):
        """Initialize the notification manager with settings."""
        self.settings = get_settings()["notifications"]
        self.logger = logging.getLogger("notifications")
    
    def send_notification(self, message: str, level: str = "info") -> bool:
        """Send a notification through all enabled channels.
        
        Args:
            message: The message to send
            level: The severity level (info, success, warning, error)
            
        Returns:
            bool: True if all notifications were sent successfully
        """
        if not self.settings["enabled"]:
            return False
        
        success = True
        
        # Send email notification if enabled
        if self.settings["email"]["enabled"]:
            try:
                self._send_email(
                    subject=f"Deployment {level.upper()}: {message[:50]}...",
                    message=message,
                    level=level
                )
            except Exception as e:
                self.logger.error(f"Failed to send email notification: {str(e)}")
                success = False
        
        # Send Slack notification if enabled
        if self.settings["slack"]["enabled"]:
            try:
                self._send_slack_notification(message, level)
            except Exception as e:
                self.logger.error(f"Failed to send Slack notification: {str(e)}")
                success = False
        
        # Send Telegram notification if enabled
        if self.settings["telegram"]["enabled"]:
            try:
                self._send_telegram_notification(message, level)
            except Exception as e:
                self.logger.error(f"Failed to send Telegram notification: {str(e)}")
                success = False
        
        return success
    
    def _send_email(self, subject: str, message: str, level: str) -> None:
        """Send an email notification.
        
        Args:
            subject: Email subject
            message: Email body
            level: Notification level
        """
        email_settings = self.settings["email"]
        
        msg = MIMEMultipart()
        msg['From'] = email_settings["from_email"]
        msg['To'] = ", ".join(email_settings["to_emails"])
        msg['Subject'] = subject
        
        # Add message body
        msg.attach(MIMEText(message, 'plain'))
        
        # Connect to SMTP server and send email
        with smtplib.SMTP(
            email_settings["smtp_server"], 
            email_settings["smtp_port"]
        ) as server:
            server.starttls()
            server.login(
                email_settings["username"], 
                email_settings["password"]
            )
            server.send_message(msg)
    
    def _send_slack_notification(self, message: str, level: str) -> None:
        """Send a Slack notification.
        
        Args:
            message: The message to send
            level: Notification level
        """
        webhook_url = self.settings["slack"]["webhook_url"]
        
        # Format message with emoji based on level
        emoji = {
            "info": "ℹ️",
            "success": "✅",
            "warning": "⚠️",
            "error": "❌"
        }.get(level, "ℹ️")
        
        payload = {
            "channel": self.settings["slack"]["channel"],
            "text": f"{emoji} {message}",
            "username": "Deployment Bot",
            "icon_emoji": ":robot_face:"
        }
        
        response = requests.post(
            webhook_url,
            data=json.dumps(payload),
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code != 200:
            raise NotificationError(
                f"Slack API error: {response.status_code} - {response.text}"
            )
    
    def _send_telegram_notification(self, message: str, level: str) -> None:
        """Send a Telegram notification.
        
        Args:
            message: The message to send
            level: Notification level
        """
        bot_token = self.settings["telegram"]["bot_token"]
        chat_id = self.settings["telegram"]["chat_id"]
        
        # Format message with emoji based on level
        emoji = {
            "info": "ℹ️",
            "success": "✅",
            "warning": "⚠️",
            "error": "❌"
        }.get(level, "ℹ️")
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        data = {
            "chat_id": chat_id,
            "text": f"{emoji} {message}",
            "parse_mode": "HTML"
        }
        
        response = requests.post(url, data=data)
        response_data = response.json()
        
        if not response_data.get("ok", False):
            raise NotificationError(
                f"Telegram API error: {response_data.get('description', 'Unknown error')}"
            )
