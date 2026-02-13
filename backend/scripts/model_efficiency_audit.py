
import json
import os
import pandas as pd
import numpy as np
from datetime import datetime

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHORTLIST_PATH = os.path.join(BASE_DIR, 'data/shortlisted_strategies.json')
HISTORY_PATH = os.path.join(BASE_DIR, '../data/trade_history.json')
REPORT_PATH = os.path.join(BASE_DIR, '../data/model_efficiency_report.json')

def run_efficiency_audit():
    print(f"[{datetime.now().isoformat()}] 🕵️ AlphaXGB Efficiency Audit: Starting...")
    
    if not os.path.exists(SHORTLIST_PATH) or not os.path.exists(HISTORY_PATH):
        print("❌ Missing data files. Ensure optimization has run and trades exist.")
        return

    try:
        # Load Data
        with open(SHORTLIST_PATH, 'r') as f:
            predictions = json.load(f)
        with open(HISTORY_PATH, 'r') as f:
            history = json.load(f)

        if not predictions or not history:
            print("❌ Empty datasets. Cannot correlate.")
            return

        pred_df = pd.DataFrame(predictions)
        hist_df = pd.DataFrame(history)

        # Sanitize History
        hist_df['pnl'] = pd.to_numeric(hist_df['pnl'], errors='coerce')
        hist_df = hist_df[hist_df['pnl'].notnull()]
        
        # We aggregate actuals by (strategyId, symbol, timeframe) to see how the "system" performed
        # vs how it was "predicted" to perform in those buckets.
        actual_performance = hist_df.groupby(['strategyId', 'symbol', 'timeframe']).agg({
            'pnl': ['mean', 'count']
        }).reset_index()
        actual_performance.columns = ['strategyId', 'symbol', 'timeframe', 'actual_avg_pnl', 'trade_count']

        # Join with predictions
        # Note: Predictions are often grouped by the same keys in the UI
        merged = pd.merge(
            pred_df, 
            actual_performance, 
            on=['strategyId', 'symbol', 'timeframe'], 
            how='inner'
        )

        if merged.empty:
            print("⚠️ No matching combinations found between predictions and actual trades.")
            return

        # Metrics
        merged['pnl_delta'] = merged['actual_avg_pnl'] - merged['pnl']
        merged['abs_error'] = merged['pnl_delta'].abs()
        
        mae = merged['abs_error'].mean()
        rmse = np.sqrt((merged['pnl_delta']**2).mean())
        
        # Efficiency Score: % of variance explained (simplified)
        # Or better: Correlation
        correlation = merged['pnl'].corr(merged['actual_avg_pnl'])
        
        # Accuracy: How often did it get the direction right? (Profit predicted vs Profit actual)
        correct_direction = ((merged['pnl'] > 0) == (merged['actual_avg_pnl'] > 0)).sum()
        accuracy = (correct_direction / len(merged)) * 100

        report = {
            "last_audit": datetime.now().isoformat(),
            "sample_size_combos": len(merged),
            "total_trades_analyzed": int(merged['trade_count'].sum()),
            "metrics": {
                "mae": round(float(mae), 4),
                "rmse": round(float(rmse), 4),
                "correlation": round(float(correlation), 4) if not np.isnan(correlation) else 0,
                "directional_accuracy_perc": round(float(accuracy), 2)
            },
            "top_correlated_strategies": merged.sort_values('abs_error').head(5)[
                ['strategyId', 'symbol', 'timeframe', 'pnl', 'actual_avg_pnl', 'abs_error']
            ].to_dict(orient='records'),
            "worst_predictions": merged.sort_values('abs_error', ascending=False).head(5)[
                ['strategyId', 'symbol', 'timeframe', 'pnl', 'actual_avg_pnl', 'abs_error']
            ].to_dict(orient='records')
        }

        with open(REPORT_PATH, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"✅ Efficiency Audit Complete. Directional Accuracy: {accuracy:.2f}%")
        print(f"📁 Report saved to: {REPORT_PATH}")

    except Exception as e:
        print(f"❌ Audit Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_efficiency_audit()
