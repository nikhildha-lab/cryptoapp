import os
import subprocess
import json
import time

def kill_process_by_name(name):
    print(f"Searching for processes matching: {name}")
    try:
        # pkill -f matches full command line
        subprocess.run(["pkill", "-f", name], check=False)
        print(f"✅ Killed commands matching: {name}")
    except Exception as e:
        print(f"❌ Error killing {name}: {e}")

def wipe_json_file(filepath, default_content):
    print(f"Wiping {filepath}...")
    try:
        with open(filepath, 'w') as f:
            json.dump(default_content, f, indent=2)
        print("✅ Wiped.")
    except Exception as e:
        print(f"❌ Failed to wipe {filepath}: {e}")

def master_reset():
    print("🚀 INITIATING MASTER RESET...")
    
    # 1. Kill Python Processes
    kill_process_by_name("execution_engine.py")
    kill_process_by_name("poly_market_stream.py") 
    kill_process_by_name("verify_instance_reset.py")
    
    time.sleep(1)
    
    # 2. Wipe Data Files
    DATA_DIR = "data"
    wipe_json_file(os.path.join(DATA_DIR, "active_strategies.json"), [])
    wipe_json_file(os.path.join(DATA_DIR, "trade_history.json"), [])
    wipe_json_file(os.path.join(DATA_DIR, "commands.json"), {"commands": []})
    wipe_json_file(os.path.join(DATA_DIR, "audit_logs.json"), [])

    print("✅ MASTER RESET COMPLETE. Strategies and History are cleared.")
    print("⚠️ You must manually restart the engine.")

if __name__ == "__main__":
    master_reset()
