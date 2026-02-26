"""
Tax Data Analyzer
Core analytics engine for tax data analysis.
Provides bracket analysis, deduction insights, refund forecasting,
effective-rate distributions, and state-level comparisons.
"""

import csv
import math
import statistics
from collections import defaultdict
from typing import Any


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_tax_data(filepath: str = "tax_data.csv") -> list[dict]:
    """Load tax records from a CSV file; auto-cast numeric fields."""
    numeric_fields = {
        "gross_income", "capital_gains", "dividend_income", "other_income",
        "total_income", "standard_deduction", "itemized_deductions",
        "deduction_used", "taxable_income", "federal_tax", "state_tax",
        "social_security_tax", "medicare_tax", "fica_total",
        "total_tax_liability", "effective_tax_rate", "marginal_tax_rate",
        "tax_withheld", "refund_or_owed", "dependents", "child_tax_credit",
        "mortgage_interest", "charitable_giving", "medical_expenses",
        "salt_deduction", "taxpayer_id", "tax_year",
    }
    bool_fields = {"uses_itemized"}

    records = []
    with open(filepath, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            for field in numeric_fields:
                if field in row:
                    try:
                        row[field] = float(row[field])
                    except (ValueError, TypeError):
                        row[field] = 0.0
            for field in bool_fields:
                if field in row:
                    row[field] = row[field].strip().lower() in ("true", "1", "yes")
            records.append(row)
    return records


# ---------------------------------------------------------------------------
# Descriptive Statistics helpers
# ---------------------------------------------------------------------------

def _values(records: list[dict], field: str) -> list[float]:
    return [r[field] for r in records if isinstance(r.get(field), (int, float))]


def _describe(vals: list[float]) -> dict:
    if not vals:
        return {}
    n = len(vals)
    mu = statistics.mean(vals)
    return {
        "count":  n,
        "mean":   round(mu, 2),
        "median": round(statistics.median(vals), 2),
        "stdev":  round(statistics.stdev(vals), 2) if n > 1 else 0,
        "min":    round(min(vals), 2),
        "max":    round(max(vals), 2),
        "total":  round(sum(vals), 2),
    }


# ---------------------------------------------------------------------------
# 1. Income Distribution Analysis
# ---------------------------------------------------------------------------

def analyze_income_distribution(records: list[dict]) -> dict:
    incomes = _values(records, "total_income")
    brackets = [
        ("< $25k",        0,       25_000),
        ("$25k – $50k",   25_000,  50_000),
        ("$50k – $75k",   50_000,  75_000),
        ("$75k – $100k",  75_000, 100_000),
        ("$100k – $150k", 100_000,150_000),
        ("$150k – $200k", 150_000,200_000),
        ("$200k – $500k", 200_000,500_000),
        ("> $500k",       500_000, float("inf")),
    ]
    distribution = {}
    for label, lo, hi in brackets:
        count = sum(1 for v in incomes if lo <= v < hi)
        distribution[label] = {
            "count":   count,
            "percent": round(count / len(incomes) * 100, 1) if incomes else 0,
        }

    by_source = defaultdict(list)
    for r in records:
        by_source[r["primary_income_src"]].append(r["total_income"])

    source_stats = {
        src: _describe(vals) for src, vals in by_source.items()
    }

    return {
        "overall_stats":         _describe(incomes),
        "bracket_distribution":  distribution,
        "by_income_source":      source_stats,
    }


# ---------------------------------------------------------------------------
# 2. Tax Bracket & Rate Analysis
# ---------------------------------------------------------------------------

def analyze_tax_rates(records: list[dict]) -> dict:
    effective = _values(records, "effective_tax_rate")
    marginal  = _values(records, "marginal_tax_rate")

    marginal_dist: dict[str, int] = defaultdict(int)
    for r in records:
        key = f"{r['marginal_tax_rate']:.0f}%"
        marginal_dist[key] += 1

    by_status: dict[str, dict] = {}
    for status in ("single", "married", "hoh"):
        subset = [r for r in records if r["filing_status"] == status]
        by_status[status] = {
            "count":           len(subset),
            "avg_effective":   round(statistics.mean(_values(subset, "effective_tax_rate")), 2) if subset else 0,
            "avg_federal_tax": round(statistics.mean(_values(subset, "federal_tax")), 2) if subset else 0,
        }

    return {
        "effective_rate_stats": _describe(effective),
        "marginal_rate_stats":  _describe(marginal),
        "marginal_distribution": dict(sorted(marginal_dist.items())),
        "by_filing_status":     by_status,
    }


# ---------------------------------------------------------------------------
# 3. Deduction Analysis
# ---------------------------------------------------------------------------

def analyze_deductions(records: list[dict]) -> dict:
    itemizers    = [r for r in records if r["uses_itemized"]]
    std_filers   = [r for r in records if not r["uses_itemized"]]

    itemized_cats = {
        "mortgage_interest": _values(itemizers, "mortgage_interest"),
        "charitable_giving": _values(itemizers, "charitable_giving"),
        "medical_expenses":  _values(itemizers, "medical_expenses"),
        "salt_deduction":    _values(itemizers, "salt_deduction"),
    }

    cat_stats = {cat: _describe(vals) for cat, vals in itemized_cats.items()}

    tax_savings_itemize = []
    for r in itemizers:
        saved = (r["itemized_deductions"] - r["standard_deduction"]) * (r["marginal_tax_rate"] / 100)
        tax_savings_itemize.append(round(saved, 2))

    return {
        "itemizer_count":          len(itemizers),
        "standard_filer_count":    len(std_filers),
        "itemizer_pct":            round(len(itemizers) / len(records) * 100, 1),
        "avg_itemized_total":      round(statistics.mean(_values(itemizers, "itemized_deductions")), 2) if itemizers else 0,
        "avg_standard_deduction":  round(statistics.mean(_values(std_filers, "standard_deduction")), 2) if std_filers else 0,
        "category_breakdown":      cat_stats,
        "avg_tax_savings_itemize": round(statistics.mean(tax_savings_itemize), 2) if tax_savings_itemize else 0,
    }


# ---------------------------------------------------------------------------
# 4. Refund / Amount-Owed Analysis
# ---------------------------------------------------------------------------

def analyze_refunds(records: list[dict]) -> dict:
    refunds = [r for r in records if r["refund_or_owed"] >= 0]
    owed    = [r for r in records if r["refund_or_owed"] < 0]

    refund_amounts = _values(refunds, "refund_or_owed")
    owed_amounts   = [abs(r["refund_or_owed"]) for r in owed]

    bins = [
        ("Refund > $5k",        5000,  float("inf")),
        ("Refund $2k–$5k",      2000,  5000),
        ("Refund $1–$2k",       1,     2000),
        ("Roughly even (±$1)",  0,     1),
        ("Owe $1–$1k",         -1000, -1),
        ("Owe $1k–$5k",        -5000, -1000),
        ("Owe > $5k",          -float("inf"), -5000),
    ]
    bucket_dist: dict[str, int] = {}
    for label, lo, hi in bins:
        bucket_dist[label] = sum(1 for r in records if lo <= r["refund_or_owed"] < hi)

    return {
        "refund_count":       len(refunds),
        "owed_count":         len(owed),
        "refund_stats":       _describe(refund_amounts),
        "owed_stats":         _describe(owed_amounts),
        "bucket_distribution":bucket_dist,
        "over_withheld_pct":  round(len(refunds) / len(records) * 100, 1),
    }


# ---------------------------------------------------------------------------
# 5. State-Level Comparison
# ---------------------------------------------------------------------------

def analyze_by_state(records: list[dict]) -> dict:
    by_state: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_state[r["state"]].append(r)

    state_summary: dict[str, Any] = {}
    for state, recs in sorted(by_state.items()):
        state_summary[state] = {
            "count":               len(recs),
            "avg_income":          round(statistics.mean(_values(recs, "total_income")), 2),
            "avg_state_tax":       round(statistics.mean(_values(recs, "state_tax")), 2),
            "avg_federal_tax":     round(statistics.mean(_values(recs, "federal_tax")), 2),
            "avg_total_tax":       round(statistics.mean(_values(recs, "total_tax_liability")), 2),
            "avg_effective_rate":  round(statistics.mean(_values(recs, "effective_tax_rate")), 2),
            "total_state_revenue": round(sum(_values(recs, "state_tax")), 2),
        }

    return state_summary


# ---------------------------------------------------------------------------
# 6. Capital Gains Analysis
# ---------------------------------------------------------------------------

def analyze_capital_gains(records: list[dict]) -> dict:
    cg_filers = [r for r in records if r["capital_gains"] > 0]
    cg_vals   = _values(cg_filers, "capital_gains")
    div_vals  = _values([r for r in records if r["dividend_income"] > 0], "dividend_income")

    cg_pct_income = []
    for r in cg_filers:
        if r["total_income"] > 0:
            cg_pct_income.append(round(r["capital_gains"] / r["total_income"] * 100, 2))

    return {
        "cg_filer_count":         len(cg_filers),
        "cg_filer_pct":           round(len(cg_filers) / len(records) * 100, 1),
        "capital_gains_stats":    _describe(cg_vals),
        "dividend_income_stats":  _describe(div_vals),
        "avg_cg_pct_of_income":   round(statistics.mean(cg_pct_income), 2) if cg_pct_income else 0,
    }


# ---------------------------------------------------------------------------
# 7. Dependency & Credits Analysis
# ---------------------------------------------------------------------------

def analyze_credits_dependents(records: list[dict]) -> dict:
    dep_dist: dict[int, int] = defaultdict(int)
    for r in records:
        dep_dist[int(r["dependents"])] += 1

    credits = _values(records, "child_tax_credit")
    by_deps: dict[int, list[float]] = defaultdict(list)
    for r in records:
        by_deps[int(r["dependents"])].append(r["total_tax_liability"])

    avg_tax_by_deps = {
        deps: round(statistics.mean(vals), 2) for deps, vals in sorted(by_deps.items())
    }

    return {
        "dependent_distribution": dict(sorted(dep_dist.items())),
        "credit_stats":           _describe(credits),
        "avg_tax_by_dependents":  avg_tax_by_deps,
        "avg_credit":             round(statistics.mean(credits), 2) if credits else 0,
        "total_credits_claimed":  round(sum(credits), 2),
    }


# ---------------------------------------------------------------------------
# 8. FICA / Payroll Tax Analysis
# ---------------------------------------------------------------------------

def analyze_fica(records: list[dict]) -> dict:
    ss_vals  = _values(records, "social_security_tax")
    med_vals = _values(records, "medicare_tax")
    fica_all = _values(records, "fica_total")

    fica_as_pct = []
    for r in records:
        if r["total_income"] > 0:
            fica_as_pct.append(round(r["fica_total"] / r["total_income"] * 100, 2))

    return {
        "social_security_stats":  _describe(ss_vals),
        "medicare_stats":         _describe(med_vals),
        "fica_total_stats":       _describe(fica_all),
        "avg_fica_pct_of_income": round(statistics.mean(fica_as_pct), 2) if fica_as_pct else 0,
        "total_fica_collected":   round(sum(fica_all), 2),
    }


# ---------------------------------------------------------------------------
# 9. High-Level Summary
# ---------------------------------------------------------------------------

def generate_summary(records: list[dict]) -> dict:
    total_income    = sum(_values(records, "total_income"))
    total_federal   = sum(_values(records, "federal_tax"))
    total_state     = sum(_values(records, "state_tax"))
    total_fica      = sum(_values(records, "fica_total"))
    total_liability = sum(_values(records, "total_tax_liability"))
    total_refunds   = sum(r["refund_or_owed"] for r in records if r["refund_or_owed"] > 0)
    total_owed      = sum(abs(r["refund_or_owed"]) for r in records if r["refund_or_owed"] < 0)

    return {
        "total_taxpayers":       len(records),
        "total_income_reported": round(total_income, 2),
        "total_federal_tax":     round(total_federal, 2),
        "total_state_tax":       round(total_state, 2),
        "total_fica":            round(total_fica, 2),
        "total_tax_collected":   round(total_liability, 2),
        "overall_effective_rate":round(total_liability / total_income * 100, 2) if total_income else 0,
        "total_refunds_issued":  round(total_refunds, 2),
        "total_tax_owed":        round(total_owed, 2),
        "avg_income":            round(total_income / len(records), 2) if records else 0,
        "avg_total_tax":         round(total_liability / len(records), 2) if records else 0,
    }


# ---------------------------------------------------------------------------
# Public API – run all analyses
# ---------------------------------------------------------------------------

def run_full_analysis(filepath: str = "tax_data.csv") -> dict:
    records = load_tax_data(filepath)
    print(f"Loaded {len(records)} tax records from '{filepath}'")

    return {
        "summary":           generate_summary(records),
        "income":            analyze_income_distribution(records),
        "tax_rates":         analyze_tax_rates(records),
        "deductions":        analyze_deductions(records),
        "refunds":           analyze_refunds(records),
        "by_state":          analyze_by_state(records),
        "capital_gains":     analyze_capital_gains(records),
        "credits_dependents":analyze_credits_dependents(records),
        "fica":              analyze_fica(records),
    }


if __name__ == "__main__":
    import json
    results = run_full_analysis("tax_data.csv")
    print(json.dumps(results, indent=2, default=str))
