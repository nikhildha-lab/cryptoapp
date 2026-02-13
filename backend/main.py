from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sys
import os

# Add current directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engine.backtester import run_backtest
from strategies.rsi import RSIStrategyParams

app = FastAPI(title="CryptoAlgo Backtesting Engine")

# CORS middleware to allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BacktestRequest(BaseModel):
    strategy: str
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    period: int = 14
    overbought: int = 70
    oversold: int = 30
    stop_loss: float = 0.02
    take_profit: float = 0.05

@app.get("/")
def read_root():
    return {"status": "online", "service": "CryptoAlgo Backtester"}

@app.post("/backtest")
def backtest_strategy(request: BacktestRequest):
    try:
        # Map request to strategy params
        if request.strategy.lower() == "rsi":
            params = RSIStrategyParams(
                period=request.period,
                overbought=request.overbought,
                oversold=request.oversold,
                stop_loss=request.stop_loss,
                take_profit=request.take_profit
            )
            result = run_backtest(request.symbol, request.timeframe, params)
            return result
        else:
            raise HTTPException(status_code=400, detail="Unknown strategy")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
