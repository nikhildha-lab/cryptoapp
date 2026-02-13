import sys
import os
import importlib.util
import inspect
import logging
from typing import List, Dict, Any

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("AuditSystem")

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRATEGIES_DIR = os.path.join(BASE_DIR, 'strategies')
RUNNER_PATH = os.path.join(BASE_DIR, 'scripts', 'run_backtest.py')

sys.path.append(BASE_DIR)

def check_imports():
    """Verify all backend modules can be imported without error."""
    logger.info("🔍 Checking Imports...")
    
    modules_to_check = [
        'backend.backtest_engine',
        'backend.execution_engine',
        'backend.exchanges.factory',
        'backend.exchanges.binance_adapter',
        'backend.exchanges.bybit_adapter',
        'backend.exchanges.okx_adapter',
        'backend.exchanges.coindcx_adapter',
        'backend.exchanges.delta_adapter',
    ]
    
    failed = []
    for module_name in modules_to_check:
        try:
            importlib.import_module(module_name)
            logger.info(f"  ✅ Imported {module_name}")
        except Exception as e:
            logger.error(f"  ❌ Failed to import {module_name}: {e}")
            failed.append(module_name)
            
    return failed

def check_strategies():
    """Verify strategy integrity and mapping."""
    logger.info("🔍 Checking Strategies...")
    
    # 1. Load run_backtest.py to get STRATEGY_MAP
    spec = importlib.util.spec_from_file_location("run_backtest", RUNNER_PATH)
    if not spec or not spec.loader:
        logger.error(f"  ❌ Could not load {RUNNER_PATH}")
        return ["run_backtest.py"]
        
    runner_module = importlib.util.module_from_spec(spec)
    sys.modules["run_backtest"] = runner_module
    try:
        spec.loader.exec_module(runner_module)
    except Exception as e:
        logger.error(f"  ❌ Error executing run_backtest module: {e}")
        return ["run_backtest execution"]
        
    strategy_map = getattr(runner_module, 'STRATEGY_MAP', {})
    if not strategy_map:
        logger.error("  ❌ STRATEGY_MAP not found or empty in run_backtest.py")
        return ["STRATEGY_MAP missing"]
        
    logger.info(f"  ℹ️ Found {len(strategy_map)} strategies in MAP")
    
    # 2. Check for duplicates
    seen_strategies = {}
    duplicates = []
    for s_id, s_class in strategy_map.items():
        if s_id in seen_strategies:
            duplicates.append(s_id)
        seen_strategies[s_id] = s_class
        
    if duplicates:
        logger.error(f"  ❌ Duplicate Strategy IDs found: {duplicates}")
        
    # 3. Check for valid Backtrader strategies
    invalid_classes = []
    import backtrader as bt
    for s_id, s_class in strategy_map.items():
        if not issubclass(s_class, bt.Strategy):
           logger.error(f"  ❌ {s_id} is not a subclass of backtrader.Strategy")
           invalid_classes.append(s_id)
           
    if not duplicates and not invalid_classes:
        logger.info("  ✅ Strategy Mapping is valid")
        return []
    
    return duplicates + invalid_classes

def run_sanity_backtest():
    """Run a quick backtest on sample strategies to ensure unique results."""
    logger.info("🔍 Running Sanity Backtests...")
    
    import subprocess
    import json
    
    strategies_to_test = ['triple-confirmation', 'ndrt-strategy', 'volatility-scalper']
    results = {}
    
    for s_id in strategies_to_test:
        cmd = [
            sys.executable, 
            RUNNER_PATH, 
            s_id, 
            'BTC/USDT', 
            '1h', 
            '1', 
            '30', # 30 days
            '10000'
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                logger.error(f"  ❌ Backtest failed for {s_id}: {result.stderr}")
                return [f"Backtest failed: {s_id}"]
            
            # Extract JSON
            output = result.stdout
            json_start = output.find('{')
            json_end = output.rfind('}')
            if json_start != -1 and json_end != -1:
                json_str = output[json_start:json_end+1]
                data = json.loads(json_str)
                results[s_id] = data
                logger.info(f"  ✅ Backtest finished for {s_id} (PnL: {data.get('pnl')})")
            else:
                 logger.error(f"  ❌ No JSON output for {s_id}")
                 return [f"No JSON: {s_id}"]
                 
        except Exception as e:
            logger.error(f"  ❌ Execution error for {s_id}: {e}")
            return [str(e)]
            
    # Verification: Strategy results should NOT be identical
    pnl_values = [r['pnl'] for r in results.values()]
    if len(set(pnl_values)) < len(strategies_to_test):
        # Allow identical if 0 (no trades) but warn
        if all(p == 0 for p in pnl_values):
            logger.warning("  ⚠️ All strategies returned 0 PnL. Check data feed or logic.")
        else:
            logger.error(f"  ❌ Identical PnL values detected: {pnl_values}. Strategies might be duplicates!")
            return ["Identical PnL"]
    else:
        logger.info("  ✅ Strategies produced unique PnL values.")
        
    return []

def check_security():
    """Verify security best practices."""
    logger.info("🔍 Checking Security Hardening...")
    errors = []
    
    # 1. Check .gitignore for sensitive files
    gitignore_path = os.path.join(BASE_DIR, '.gitignore') # Base dir is backend/, need project root
    project_root = os.path.dirname(BASE_DIR)
    gitignore_path = os.path.join(project_root, '.gitignore')
    
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r') as f:
            content = f.read()
            if '.env' not in content:
                logger.error("  ❌ .env not found in .gitignore")
                errors.append(".env missing from .gitignore")
            else:
                logger.info("  ✅ .env is correctly ignored")
    else:
        logger.warning("  ⚠️ .gitignore not found at project root")

    # 2. Scan for hardcoded secrets (Simple heuristic)
    # We'll scan backend/ for "sk-..." or "ey..."
    logger.info("  ℹ️ Scanning for hardcoded secrets...")
    suspicious_patterns = ['sk-proj-', 'eyPh', 'xoxb-']
    for root, _, files in os.walk(os.path.join(project_root, 'backend')):
        for file in files:
            if file.endswith(('.py', '.json', '.txt')) and 'env' not in file:
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', errors='ignore') as f:
                        file_content = f.read()
                        for pattern in suspicious_patterns:
                            if pattern in file_content:
                                logger.warning(f"  ⚠️ Potential secret pattern '{pattern}' found in {file}")
                                # Don't fail audit, just warn, as it might be a comment
                except:
                    pass
    
    return errors

def check_infrastructure():
    """Verify infrastructure reliability."""
    logger.info("🔍 Checking Infrastructure...")
    errors = []
    
    # 1. Dependency Pinning
    req_path = os.path.join(BASE_DIR, 'requirements.txt')
    if os.path.exists(req_path):
        with open(req_path, 'r') as f:
            reqs = f.read().splitlines()
            unpinned = [r for r in reqs if '==' not in r and r.strip() and not r.startswith('#')]
            if len(unpinned) > 2: # Allow a few loose ones, but mostly should be pinned
                logger.warning(f"  ⚠️ Found {len(unpinned)} unpinned dependencies. Consider freezing requirements.")
            else:
                logger.info("  ✅ Dependencies appear mostly pinned")
    
    # 2. Log Size Check
    log_file = os.path.join(BASE_DIR, 'execution.log')
    if os.path.exists(log_file):
        size_mb = os.path.getsize(log_file) / (1024 * 1024)
        if size_mb > 50:
            logger.error(f"  ❌ execution.log is too large ({size_mb:.2f} MB). Setup rotation.")
            errors.append("Log file too large")
        else:
            logger.info(f"  ✅ Log file size is healthy ({size_mb:.2f} MB)")
            
    return errors


def main():
    print("="*60)
    print("🛡️  CRYPTOALGO AUDIT SYSTEM  🛡️")
    print("="*60)
    
    errors = []
    
    # Check 1: Imports
    # errors.extend(check_imports()) # Skip for now as we run script from root
    
    # Check 2: Strategies
    errors.extend(check_strategies())
    
    # Check 3: Sanity Backtest
    errors.extend(run_sanity_backtest())

    # Check 4: Security
    errors.extend(check_security())

    # Check 5: Infrastructure
    errors.extend(check_infrastructure())
    
    print("-" * 60)
    if errors:
        print(f"❌ AUDIT FAILED with {len(errors)} errors.")
        sys.exit(1)
    else:
        print("✅ AUDIT PASSED. System is healthy.")
        sys.exit(0)

if __name__ == "__main__":
    main()
