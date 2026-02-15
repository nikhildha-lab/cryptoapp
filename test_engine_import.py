
import sys
import os
import time

# Setup paths
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from execution_engine import ExecutionEngine
    print("✅ ExecutionEngine imported successfully")
except ImportError as e:
    print(f"❌ Import Error: {e}")
    sys.exit(1)

def test_engine_init():
    try:
        print("Initializing Execution Engine...")
        engine = ExecutionEngine()
        print("✅ ExecutionEngine initialized")
        
        if hasattr(engine, 'ai_analysis_cache'):
             print("✅ AI Cache attribute found")
        else:
             print("❌ AI Cache attribute MISSING")
             
    except Exception as e:
        print(f"❌ Initialization Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_engine_init()
