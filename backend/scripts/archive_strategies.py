import json
import os
from datetime import datetime

FILE_PATH = 'data/active_strategies.json'
ARCHIVE_DIR = 'data/archive'

def archive_stopped_strategies():
    if not os.path.exists(FILE_PATH):
        print("File not found!")
        return

    with open(FILE_PATH, 'r') as f:
        strategies = json.load(f)

    active = []
    stopped = []

    for s in strategies:
        if s.get('status') == 'stopped':
            stopped.append(s)
        else:
            active.append(s)

    if not stopped:
        print("No stopped strategies to archive.")
        return

    # Ensure archive dir exists
    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR)

    # Save stopped to archive
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_file = os.path.join(ARCHIVE_DIR, f"stopped_strategies_{timestamp}.json")
    
    with open(archive_file, 'w') as f:
        json.dump(stopped, f, indent=2)
    
    print(f"Archived {len(stopped)} strategies to {archive_file}")
    print(f"Total Realized PnL moved to archive: {sum(s.get('pnl', 0) for s in stopped)}")

    # Save active back to main file
    with open(FILE_PATH, 'w') as f:
        json.dump(active, f, indent=2)
    
    print(f"Updated {FILE_PATH} with {len(active)} active strategies.")

if __name__ == "__main__":
    archive_stopped_strategies()
