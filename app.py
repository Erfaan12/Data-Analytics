"""
Tax Analyzer – FastAPI Backend (Production-Ready)

Environment variables (all optional):
  PORT        Port to listen on             (default: 8000)
  HOST        Host to bind                  (default: 0.0.0.0)
  DATA_FILE   Path to the CSV dataset       (default: /data/tax_data.csv)
  DATA_SEED   RNG seed for sample data      (default: 42)
  DATA_ROWS   Rows to generate if no CSV    (default: 500)
  CORS_ORIGINS Comma-separated allowed origins (default: *)
  LOG_LEVEL   Uvicorn log level             (default: info)

Run locally:
    uvicorn app:app --reload --port 8000

Run in Docker:
    docker compose up
"""

import logging
import os
import random
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from tax_data_generator import generate_dataset
from tax_analyzer import (
    load_tax_data,
    generate_summary,
    analyze_income_distribution,
    analyze_tax_rates,
    analyze_deductions,
    analyze_refunds,
    analyze_by_state,
    analyze_capital_gains,
    analyze_credits_dependents,
    analyze_fica,
    run_full_analysis,
)

# ---------------------------------------------------------------------------
# Config from environment
# ---------------------------------------------------------------------------
DATA_FILE   = os.getenv("DATA_FILE",  "/data/tax_data.csv")
DATA_SEED   = int(os.getenv("DATA_SEED",  "42"))
DATA_ROWS   = int(os.getenv("DATA_ROWS",  "500"))
_raw_origins = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS = ["*"] if _raw_origins == "*" else [o.strip() for o in _raw_origins.split(",")]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("tax_analyzer")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Tax Data Analyzer",
    description="Full-stack tax analytics platform – 2024 US federal & state tax data",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request timing middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Response-Time-Ms"] = str(ms)
    return response

# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------
def _ensure_data() -> list[dict]:
    """Auto-generate sample data if the CSV is absent."""
    path = Path(DATA_FILE)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        log.info("No dataset found – generating %d rows (seed=%d) -> %s", DATA_ROWS, DATA_SEED, DATA_FILE)
        random.seed(DATA_SEED)
        generate_dataset(DATA_ROWS, DATA_FILE)
    return load_tax_data(DATA_FILE)

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------
_static = Path("static")
_static.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_static)), name="static")

@app.get("/", include_in_schema=False)
def root():
    index = _static / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse({"message": "Tax Analyzer API – visit /api/docs"})

# ---------------------------------------------------------------------------
# Health / readiness
# ---------------------------------------------------------------------------
@app.get("/healthz", tags=["ops"], summary="Health check")
def healthz():
    """Returns 200 when the service is alive (used by Docker / load-balancers)."""
    return {"status": "ok", "version": app.version}

@app.get("/readyz", tags=["ops"], summary="Readiness check")
def readyz():
    """Returns 200 when the dataset is loaded and ready to serve."""
    try:
        records = _ensure_data()
        return {"status": "ready", "records": len(records)}
    except Exception as exc:
        log.exception("Readiness check failed")
        raise HTTPException(status_code=503, detail=str(exc))

# ---------------------------------------------------------------------------
# Analytics API
# ---------------------------------------------------------------------------
@app.get("/api/summary", tags=["analytics"])
def api_summary():
    """High-level KPIs: total income, total tax collected, effective rate."""
    return generate_summary(_ensure_data())

@app.get("/api/income", tags=["analytics"])
def api_income():
    """Income bracket distribution and breakdown by income source."""
    return analyze_income_distribution(_ensure_data())

@app.get("/api/tax-rates", tags=["analytics"])
def api_tax_rates():
    """Effective and marginal tax rate statistics, by filing status."""
    return analyze_tax_rates(_ensure_data())

@app.get("/api/deductions", tags=["analytics"])
def api_deductions():
    """Itemized vs standard deduction comparison and category breakdown."""
    return analyze_deductions(_ensure_data())

@app.get("/api/refunds", tags=["analytics"])
def api_refunds():
    """Refund and amount-owed statistics with bucket distribution."""
    return analyze_refunds(_ensure_data())

@app.get("/api/state", tags=["analytics"])
def api_state():
    """Per-state average income, tax, and effective rate."""
    return analyze_by_state(_ensure_data())

@app.get("/api/capital-gains", tags=["analytics"])
def api_capital_gains():
    """Capital gains and dividend income statistics."""
    return analyze_capital_gains(_ensure_data())

@app.get("/api/credits", tags=["analytics"])
def api_credits():
    """Dependent counts and child tax credit analysis."""
    return analyze_credits_dependents(_ensure_data())

@app.get("/api/fica", tags=["analytics"])
def api_fica():
    """Social Security and Medicare payroll tax breakdown."""
    return analyze_fica(_ensure_data())

@app.get("/api/full", tags=["analytics"])
def api_full():
    """All analysis sections in one response."""
    return run_full_analysis(DATA_FILE)

# ---------------------------------------------------------------------------
# Dataset management
# ---------------------------------------------------------------------------
@app.post("/api/regenerate", tags=["dataset"])
def api_regenerate(records: int = 500, seed: int = 42):
    """Regenerate the sample dataset (1–10 000 rows)."""
    if not (1 <= records <= 10_000):
        raise HTTPException(status_code=400, detail="records must be 1–10000")
    Path(DATA_FILE).parent.mkdir(parents=True, exist_ok=True)
    random.seed(seed)
    generate_dataset(records, DATA_FILE)
    log.info("Dataset regenerated: %d rows, seed=%d", records, seed)
    return {"status": "ok", "records_generated": records, "seed": seed}

@app.post("/api/upload", tags=["dataset"])
async def api_upload(file: UploadFile = File(...)):
    """Upload a custom CSV dataset (must match the expected column schema)."""
    if not (file.filename or "").endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files accepted")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:          # 50 MB guard
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")
    Path(DATA_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(DATA_FILE).write_bytes(content)
    loaded = load_tax_data(DATA_FILE)
    log.info("CSV uploaded: %d records", len(loaded))
    return {"status": "ok", "records_loaded": len(loaded)}

@app.get("/api/records", tags=["dataset"])
def api_records(limit: int = 50, offset: int = 0):
    """Paginated raw records from the current dataset."""
    if limit > 500:
        raise HTTPException(status_code=400, detail="limit max is 500")
    records = _ensure_data()
    return {
        "total":   len(records),
        "offset":  offset,
        "limit":   limit,
        "records": records[offset: offset + limit],
    }
