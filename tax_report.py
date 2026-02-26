"""
Tax Report Generator
Produces human-readable console reports and exports CSV summaries
from the tax analysis results produced by tax_analyzer.py.
"""

import csv
import json
from datetime import date

from tax_data_generator import generate_dataset
from tax_analyzer import run_full_analysis


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def _usd(value: float) -> str:
    return f"${value:,.2f}"


def _pct(value: float) -> str:
    return f"{value:.2f}%"


def _bar(value: float, max_value: float, width: int = 30) -> str:
    filled = int(value / max_value * width) if max_value else 0
    return "[" + "#" * filled + "-" * (width - filled) + "]"


def _section(title: str) -> None:
    print("\n" + "=" * 65)
    print(f"  {title}")
    print("=" * 65)


def _subsection(title: str) -> None:
    print(f"\n  --- {title} ---")


# ---------------------------------------------------------------------------
# Individual report sections
# ---------------------------------------------------------------------------

def print_summary(data: dict) -> None:
    _section("EXECUTIVE SUMMARY")
    s = data["summary"]
    rows = [
        ("Total Taxpayers",          f"{s['total_taxpayers']:,}"),
        ("Total Income Reported",    _usd(s["total_income_reported"])),
        ("Avg. Income per Filer",    _usd(s["avg_income"])),
        ("Total Federal Tax",        _usd(s["total_federal_tax"])),
        ("Total State Tax",          _usd(s["total_state_tax"])),
        ("Total FICA",               _usd(s["total_fica"])),
        ("Total Tax Collected",      _usd(s["total_tax_collected"])),
        ("Overall Effective Rate",   _pct(s["overall_effective_rate"])),
        ("Avg. Tax per Filer",       _usd(s["avg_total_tax"])),
        ("Total Refunds Issued",     _usd(s["total_refunds_issued"])),
        ("Total Tax Owed",           _usd(s["total_tax_owed"])),
    ]
    for label, val in rows:
        print(f"  {label:<32} {val:>18}")


def print_income_distribution(data: dict) -> None:
    _section("INCOME DISTRIBUTION")
    inc = data["income"]
    st  = inc["overall_stats"]

    _subsection("Overall Income Statistics")
    for k, v in st.items():
        display = _usd(v) if k not in ("count",) else f"{v:,}"
        print(f"    {k:<12} {display:>18}")

    _subsection("Income Bracket Distribution")
    max_count = max(b["count"] for b in inc["bracket_distribution"].values()) or 1
    for label, info in inc["bracket_distribution"].items():
        bar = _bar(info["count"], max_count)
        print(f"  {label:<18} {bar}  {info['count']:>4} ({info['percent']:>5.1f}%)")

    _subsection("Average Income by Income Source")
    for src, stats in inc["by_income_source"].items():
        mean = _usd(stats.get("mean", 0))
        cnt  = stats.get("count", 0)
        print(f"  {src:<22} mean={mean}  n={cnt:>4}")


def print_tax_rates(data: dict) -> None:
    _section("TAX RATE ANALYSIS")
    tr = data["tax_rates"]

    _subsection("Effective Tax Rate Distribution")
    st = tr["effective_rate_stats"]
    for k, v in st.items():
        display = _pct(v) if k not in ("count",) else f"{v:,}"
        print(f"    {k:<12} {display:>14}")

    _subsection("Marginal Rate Distribution")
    max_cnt = max(tr["marginal_distribution"].values(), default=1)
    for rate, cnt in tr["marginal_distribution"].items():
        bar = _bar(cnt, max_cnt)
        print(f"  {rate:<8} {bar}  {cnt:>4}")

    _subsection("By Filing Status")
    for status, info in tr["by_filing_status"].items():
        print(
            f"  {status:<10}  n={info['count']:>4}  "
            f"avg_effective={_pct(info['avg_effective']):<10}  "
            f"avg_federal={_usd(info['avg_federal_tax'])}"
        )


def print_deductions(data: dict) -> None:
    _section("DEDUCTION ANALYSIS")
    d = data["deductions"]
    total = d["itemizer_count"] + d["standard_filer_count"]

    print(f"  Itemizers:         {d['itemizer_count']:>5}  ({d['itemizer_pct']:.1f}%)")
    print(f"  Standard Filers:   {d['standard_filer_count']:>5}  ({100 - d['itemizer_pct']:.1f}%)")
    print(f"  Avg Itemized Total:{_usd(d['avg_itemized_total']):>14}")
    print(f"  Avg Std Deduction: {_usd(d['avg_standard_deduction']):>14}")
    print(f"  Avg Tax Saved (itemize vs std): {_usd(d['avg_tax_savings_itemize'])}")

    _subsection("Itemized Category Averages (among itemizers)")
    for cat, stats in d["category_breakdown"].items():
        mean = _usd(stats.get("mean", 0))
        cnt  = stats.get("count", 0)
        print(f"  {cat:<28} mean={mean}  n={cnt:>4}")


def print_refunds(data: dict) -> None:
    _section("REFUND / AMOUNT OWED ANALYSIS")
    r = data["refunds"]

    print(f"  Receiving Refund:  {r['refund_count']:>5}  ({r['over_withheld_pct']:.1f}%)")
    print(f"  Owe Taxes:         {r['owed_count']:>5}  ({100 - r['over_withheld_pct']:.1f}%)")

    _subsection("Refund Statistics")
    for k, v in r["refund_stats"].items():
        display = _usd(v) if k not in ("count",) else f"{v:,}"
        print(f"    {k:<12} {display:>14}")

    _subsection("Amount Owed Statistics")
    for k, v in r["owed_stats"].items():
        display = _usd(v) if k not in ("count",) else f"{v:,}"
        print(f"    {k:<12} {display:>14}")

    _subsection("Refund Bucket Distribution")
    max_cnt = max(r["bucket_distribution"].values(), default=1)
    for label, cnt in r["bucket_distribution"].items():
        bar = _bar(cnt, max_cnt)
        print(f"  {label:<24} {bar}  {cnt:>4}")


def print_state_comparison(data: dict) -> None:
    _section("STATE-LEVEL COMPARISON")
    header = f"  {'State':<6} {'Count':>5}  {'Avg Income':>14}  {'Avg State Tax':>14}  {'Avg Total Tax':>14}  {'Eff Rate':>10}"
    print(header)
    print("  " + "-" * 70)
    for state, info in data["by_state"].items():
        print(
            f"  {state:<6} {info['count']:>5}  "
            f"{_usd(info['avg_income']):>14}  "
            f"{_usd(info['avg_state_tax']):>14}  "
            f"{_usd(info['avg_total_tax']):>14}  "
            f"{_pct(info['avg_effective_rate']):>10}"
        )


def print_capital_gains(data: dict) -> None:
    _section("CAPITAL GAINS & DIVIDENDS")
    cg = data["capital_gains"]

    print(f"  Filers with Capital Gains: {cg['cg_filer_count']:>5} ({cg['cg_filer_pct']:.1f}%)")
    print(f"  Avg CG as % of Income:     {_pct(cg['avg_cg_pct_of_income'])}")

    _subsection("Capital Gains Statistics")
    for k, v in cg["capital_gains_stats"].items():
        display = _usd(v) if k not in ("count",) else f"{v:,}"
        print(f"    {k:<12} {display:>14}")

    _subsection("Dividend Income Statistics")
    for k, v in cg["dividend_income_stats"].items():
        display = _usd(v) if k not in ("count",) else f"{v:,}"
        print(f"    {k:<12} {display:>14}")


def print_credits_dependents(data: dict) -> None:
    _section("DEPENDENTS & CREDITS")
    cd = data["credits_dependents"]

    _subsection("Dependent Distribution")
    max_cnt = max(cd["dependent_distribution"].values(), default=1)
    for dep, cnt in cd["dependent_distribution"].items():
        bar = _bar(cnt, max_cnt)
        print(f"  {dep} dependent(s): {bar}  {cnt:>4}")

    _subsection("Average Total Tax by Number of Dependents")
    for dep, avg_tax in cd["avg_tax_by_dependents"].items():
        print(f"  {dep} dependent(s): {_usd(avg_tax)}")

    print(f"\n  Avg Child Tax Credit:    {_usd(cd['avg_credit'])}")
    print(f"  Total Credits Claimed:   {_usd(cd['total_credits_claimed'])}")


def print_fica(data: dict) -> None:
    _section("FICA / PAYROLL TAX ANALYSIS")
    f = data["fica"]

    print(f"  Avg FICA as % of Income: {_pct(f['avg_fica_pct_of_income'])}")
    print(f"  Total FICA Collected:    {_usd(f['total_fica_collected'])}")

    _subsection("Social Security Tax")
    for k, v in f["social_security_stats"].items():
        display = _usd(v) if k not in ("count",) else f"{v:,}"
        print(f"    {k:<12} {display:>14}")

    _subsection("Medicare Tax")
    for k, v in f["medicare_stats"].items():
        display = _usd(v) if k not in ("count",) else f"{v:,}"
        print(f"    {k:<12} {display:>14}")


# ---------------------------------------------------------------------------
# CSV Export
# ---------------------------------------------------------------------------

def export_state_summary_csv(data: dict, output: str = "state_summary.csv") -> None:
    rows = []
    for state, info in data["by_state"].items():
        rows.append({"state": state, **info})
    if not rows:
        return
    with open(output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\n  State summary exported -> {output}")


def export_analysis_json(data: dict, output: str = "tax_analysis.json") -> None:
    with open(output, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Full analysis exported -> {output}")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main() -> None:
    print("\n" + "#" * 65)
    print("#  TAX DATA ANALYSIS REPORT")
    print(f"#  Generated: {date.today().isoformat()}")
    print("#" * 65)

    # Generate sample data if not already present
    import os
    if not os.path.exists("tax_data.csv"):
        import random
        random.seed(42)
        generate_dataset(500, "tax_data.csv")

    results = run_full_analysis("tax_data.csv")

    print_summary(results)
    print_income_distribution(results)
    print_tax_rates(results)
    print_deductions(results)
    print_refunds(results)
    print_state_comparison(results)
    print_capital_gains(results)
    print_credits_dependents(results)
    print_fica(results)

    _section("EXPORTS")
    export_state_summary_csv(results)
    export_analysis_json(results)

    print("\n" + "=" * 65)
    print("  Analysis complete.")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
