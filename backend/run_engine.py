#!/usr/bin/env python3
"""
Execution Engine Startup Script
Runs the 24/7 trading bot that monitors deployed strategies
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    from execution_engine import ExecutionEngine
    
    print("=" * 60)
    print("🚀 CRYPTO TRADING ENGINE STARTING")
    print("=" * 60)
    print()
    
    engine = ExecutionEngine()
    engine.run()
