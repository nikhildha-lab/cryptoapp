
import json
import os

LOGS_FILE = 'data/audit_logs.json'

def extract_optimizer_logs():
    if not os.path.exists(LOGS_FILE):
        print("Logs file not found")
        return

    with open(LOGS_FILE, 'r') as f:
        try:
            logs = json.load(f)
        except Exception as e:
            print(f"Error reading logs: {e}")
            return

    # Logs are stored newest first in the array.
    # To print in chronological order, we reverse the entire array.
    logs.reverse()

    # Filter for Optimizer
    opt_logs = [l for l in logs if l.get('source') == 'Optimizer']
    
    # Print last 200 chronological logs
    for log in opt_logs[-200:]:
        print(f"[{log.get('timestamp')}] {log.get('level').upper()}: {log.get('message')}")

if __name__ == "__main__":
    extract_optimizer_logs()
