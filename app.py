"""
Tax Analyzer – FastAPI Backend
Serves the full tax analytics API and static frontend files.

Run:
    uvicorn app:app --reload --port 8000
Then open:
    http://localhost:8000
"""

import os
import random
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
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
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Tax Data Analyzer API",
    description="Full-stack tax analytics platform – 2024 US federal & state tax data",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "tax_data.csv"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_data() -> list[dict]:
    """Generate sample data if the CSV doesn't exist yet."""
    if not Path(DATA_FILE).exists():
        random.seed(42)
        generate_dataset(500, DATA_FILE)
    return load_tax_data(DATA_FILE)


# ---------------------------------------------------------------------------
# Static files & root
# ---------------------------------------------------------------------------

static_dir = Path("static")
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
def root():
    index = Path("static/index.html")
    if index.exists():
        return FileResponse(str(index))
    return {"message": "Tax Analyzer API – see /docs for endpoints"}


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/api/summary")
def api_summary():
    """High-level KPIs: total income, total tax collected, effective rate, etc."""
    records = _ensure_data()
    return generate_summary(records)


@app.get("/api/income")
def api_income():
    """Income bracket distribution and breakdown by income source."""
    records = _ensure_data()
    return analyze_income_distribution(records)


@app.get("/api/tax-rates")
def api_tax_rates():
    """Effective and marginal tax rate statistics, by filing status."""
    records = _ensure_data()
    return analyze_tax_rates(records)


@app.get("/api/deductions")
def api_deductions():
    """Itemized vs standard deduction comparison and category breakdown."""
    records = _ensure_data()
    return analyze_deductions(records)


@app.get("/api/refunds")
def api_refunds():
    """Refund and amount-owed statistics with bucket distribution."""
    records = _ensure_data()
    return analyze_refunds(records)


@app.get("/api/state")
def api_state():
    """Per-state average income, tax, and effective rate."""
    records = _ensure_data()
    return analyze_by_state(records)


@app.get("/api/capital-gains")
def api_capital_gains():
    """Capital gains and dividend income statistics."""
    records = _ensure_data()
    return analyze_capital_gains(records)


@app.get("/api/credits")
def api_credits():
    """Dependent counts and child tax credit analysis."""
    records = _ensure_data()
    return analyze_credits_dependents(records)


@app.get("/api/fica")
def api_fica():
    """Social Security and Medicare payroll tax breakdown."""
    records = _ensure_data()
    return analyze_fica(records)


@app.get("/api/full")
def api_full():
    """Return all analysis sections in a single response."""
    return run_full_analysis(DATA_FILE)


@app.post("/api/regenerate")
def api_regenerate(records: int = 500, seed: int = 42):
    """Regenerate the sample dataset with the given record count and seed."""
    if records < 1 or records > 10_000:
        raise HTTPException(status_code=400, detail="records must be between 1 and 10000")
    random.seed(seed)
    generate_dataset(records, DATA_FILE)
    return {"status": "ok", "records_generated": records, "seed": seed}


@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    """Upload a custom CSV tax dataset (must match the expected column schema)."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    content = await file.read()
    with open(DATA_FILE, "wb") as f:
        f.write(content)
    records = load_tax_data(DATA_FILE)
    return {"status": "ok", "records_loaded": len(records)}


@app.get("/api/records")
def api_records(limit: int = 50, offset: int = 0):
    """Paginated raw records from the current dataset."""
    records = _ensure_data()
    total = len(records)
    page  = records[offset: offset + limit]
    return {"total": total, "offset": offset, "limit": limit, "records": page}
