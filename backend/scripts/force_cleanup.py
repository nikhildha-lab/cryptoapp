import json
import os
from datetime import datetime

FILE_PATH = 'data/active_strategies.json'
ARCHIVE_DIR = 'data/archive'

def cleanup_and_fix_status():
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
            # FIX: Force status to 'Running' for active ones
            if s.get('status') == 'active':
                s['status'] = 'Running'
            active.append(s)

    # Archive stopped if any exist
    if stopped:
        if not os.path.exists(ARCHIVE_DIR):
            os.makedirs(ARCHIVE_DIR)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_file = os.path.join(ARCHIVE_DIR, f"ghost_cleanup_{timestamp}.json")
        
        with open(archive_file, 'w') as f:
            json.dump(stopped, f, indent=2)
        print(f"Archived {len(stopped)} strategies to {archive_file}")
    else:
        print("No stopped strategies found to archive.")

    # Save active strategies with corrected status
    with open(FILE_PATH, 'w') as f:
        json.dump(active, f, indent=2)
    
    print(f"Updated {FILE_PATH} with {len(active)} strategies (Status set to 'Running').")

if __name__ == "__main__":
    cleanup_and_fix_status()
