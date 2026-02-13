
import os
import sys
from dotenv import load_dotenv

# Add current directory and parent to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
sys.path.append(os.path.dirname(current_dir))

from notifiers import NotificationHub

def test_notifications():
    print("🚀 Initializing Notification Hub Test...")
    
    # Load env
    env_path = os.path.join(os.path.dirname(current_dir), '.env.local')
    load_dotenv(dotenv_path=env_path)
    
    hub = NotificationHub()
    
    active_channels = [type(n).__name__ for n in hub.notifiers]
    
    if not active_channels:
        print("⚠️  No active notification channels found.")
        print("Please ensure DISCORD_WEBHOOK_URL or (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID) are set in .env.local")
        return
        
    print(f"✅ Found active channels: {', '.join(active_channels)}")
    print("📡 Sending test trade signal...")
    
    try:
        hub.notify_trade(
            strategy_id="test-strategy-hub",
            symbol="BTC/USDT",
            side="BUY",
            price=68000.0,
            pnl=None
        )
        
        hub.notify_trade(
            strategy_id="test-strategy-hub",
            symbol="BTC/USDT",
            side="SELL",
            price=69500.0,
            pnl=2.21
        )
        
        print("✨ Test signals broadcasted! Please check your Discord/Telegram channels.")
        
    except Exception as e:
        print(f"❌ Notification failed: {e}")

if __name__ == "__main__":
    test_notifications()
