
import requests
import os
import json


class DiscordNotifier:
    def __init__(self, webhook_url=None):
        self.webhook_url = webhook_url or os.getenv('DISCORD_WEBHOOK_URL')

    def send_message(self, content):
        if not self.webhook_url:
            return
        
        try:
            payload = {"content": content}
            requests.post(self.webhook_url, json=payload, timeout=5)
        except Exception as e:
            print(f"Failed to send Discord notification: {e}")

    def notify_trade(self, strategy_id, symbol, side, price, pnl=None):
        emoji = "🚀" if side == "BUY" else "💰"
        message = f"{emoji} **{side} Signal Executed**\n"
        message += f"**Strategy:** `{strategy_id}`\n"
        message += f"**Symbol:** `{symbol}`\n"
        message += f"**Price:** `{price}`\n"
        
        if pnl is not None:
            pnl_emoji = "📈" if pnl >= 0 else "📉"
            message += f"**PnL:** {pnl_emoji} `{pnl:.2f}%`"
            
        self.send_message(message)

class TelegramNotifier:
    def __init__(self, bot_token=None, chat_id=None):
        self.bot_token = bot_token or os.getenv('TELEGRAM_BOT_TOKEN')
        self.chat_id = chat_id or os.getenv('TELEGRAM_CHAT_ID')

    def send_message(self, content):
        if not self.bot_token or not self.chat_id:
            return
            
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            payload = {
                "chat_id": self.chat_id,
                "text": content,
                "parse_mode": "Markdown"
            }
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            print(f"Failed to send Telegram notification: {e}")

    def notify_trade(self, strategy_id, symbol, side, price, pnl=None):
        emoji = "🚀" if side == "BUY" else "💰"
        # Telegram uses slightly different markdown for bold/code
        message = f"{emoji} *{side} Signal Executed*\n"
        message += f"Strategy: `{strategy_id}`\n"
        message += f"Symbol: `{symbol}`\n"
        message += f"Price: `{price}`\n"
        
        if pnl is not None:
            pnl_emoji = "📈" if pnl >= 0 else "📉"
            message += f"PnL: {pnl_emoji} `{pnl:.2f}%`"
            
        self.send_message(message)

class NotificationHub:
    def __init__(self):
        self.notifiers = []
        
        # Initialize Discord
        discord = DiscordNotifier()
        if discord.webhook_url:
            self.notifiers.append(discord)
            
        # Initialize Telegram
        telegram = TelegramNotifier()
        if telegram.bot_token and telegram.chat_id:
            self.notifiers.append(telegram)

    def notify_trade(self, strategy_id, symbol, side, price, pnl=None):
        for notifier in self.notifiers:
            notifier.notify_trade(strategy_id, symbol, side, price, pnl)

    def send_broadcast(self, message):
        for notifier in self.notifiers:
            notifier.send_message(message)
