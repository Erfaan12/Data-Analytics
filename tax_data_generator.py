"""
Tax Data Generator
Generates realistic sample tax data for analysis and testing.
"""

import csv
import random
from datetime import date, timedelta


# 2024 US Federal Tax Brackets (Single filers)
FEDERAL_TAX_BRACKETS_SINGLE = [
    (11600,   0.10),
    (47150,   0.12),
    (100525,  0.22),
    (191950,  0.24),
    (243725,  0.32),
    (609350,  0.35),
    (float("inf"), 0.37),
]

# 2024 US Federal Tax Brackets (Married Filing Jointly)
FEDERAL_TAX_BRACKETS_MFJ = [
    (23200,   0.10),
    (94300,   0.12),
    (201050,  0.22),
    (383900,  0.24),
    (487450,  0.32),
    (731200,  0.35),
    (float("inf"), 0.37),
]

# Standard Deductions 2024
STANDARD_DEDUCTIONS = {
    "single":   14600,
    "married":  29200,
    "hoh":      21900,
}

FILING_STATUSES = ["single", "married", "hoh"]

INCOME_SOURCES = [
    "wages",
    "self_employment",
    "investment",
    "rental",
    "retirement",
]

STATES = {
    "CA": 0.093,
    "NY": 0.0685,
    "TX": 0.00,
    "FL": 0.00,
    "WA": 0.00,
    "IL": 0.0495,
    "OH": 0.04,
    "GA": 0.055,
    "NC": 0.0525,
    "VA": 0.0575,
}

DEDUCTION_CATEGORIES = [
    "mortgage_interest",
    "charitable",
    "medical",
    "state_local_taxes",
    "student_loan_interest",
    "business_expenses",
]


def random_date(start_year: int = 2023, end_year: int = 2024) -> str:
    start = date(start_year, 1, 1)
    end   = date(end_year, 12, 31)
    delta = end - start
    return (start + timedelta(days=random.randint(0, delta.days))).isoformat()


def generate_taxpayer(taxpayer_id: int) -> dict:
    filing_status = random.choice(FILING_STATUSES)
    state         = random.choice(list(STATES.keys()))
    primary_src   = random.choice(INCOME_SOURCES)

    # Income generation (realistic distribution)
    income_ranges = {
        "wages":          (25000,  250000),
        "self_employment": (15000, 200000),
        "investment":     (5000,   500000),
        "rental":         (10000,  150000),
        "retirement":     (20000,  120000),
    }
    lo, hi = income_ranges[primary_src]
    gross_income = round(random.uniform(lo, hi), 2)

    # Additional income streams
    capital_gains    = round(random.uniform(0, gross_income * 0.3), 2) if random.random() > 0.5 else 0
    dividend_income  = round(random.uniform(0, gross_income * 0.1), 2) if random.random() > 0.6 else 0
    other_income     = round(random.uniform(0, 10000), 2)               if random.random() > 0.7 else 0

    total_income = gross_income + capital_gains + dividend_income + other_income

    # Deductions
    std_ded = STANDARD_DEDUCTIONS.get(filing_status, 14600)
    itemized = {}
    itemized_total = 0

    if total_income > 75000 and random.random() > 0.4:
        for cat in DEDUCTION_CATEGORIES:
            if random.random() > 0.5:
                max_ded = min(total_income * 0.15, 30000)
                amt = round(random.uniform(500, max_ded), 2)
                itemized[cat] = amt
                itemized_total += amt

    uses_itemized  = itemized_total > std_ded
    deduction_used = itemized_total if uses_itemized else std_ded

    # Taxable income
    taxable_income = max(0, total_income - deduction_used)

    # Federal tax
    federal_tax = _calculate_tax(
        taxable_income,
        FEDERAL_TAX_BRACKETS_MFJ if filing_status == "married" else FEDERAL_TAX_BRACKETS_SINGLE,
    )

    # State tax
    state_rate = STATES[state]
    state_tax  = round(taxable_income * state_rate, 2)

    # FICA (Social Security + Medicare) — only on earned income
    fica_base   = min(gross_income, 168600)   # SS wage base 2024
    social_sec  = round(fica_base * 0.062, 2)
    medicare    = round(gross_income * 0.0145, 2)
    fica_total  = social_sec + medicare

    total_tax        = round(federal_tax + state_tax + fica_total, 2)
    effective_rate   = round((total_tax / total_income * 100), 2) if total_income > 0 else 0
    marginal_rate    = _get_marginal_rate(
        taxable_income,
        FEDERAL_TAX_BRACKETS_MFJ if filing_status == "married" else FEDERAL_TAX_BRACKETS_SINGLE,
    )

    withheld     = round(federal_tax * random.uniform(0.85, 1.15), 2)
    refund_due   = round(withheld - federal_tax, 2)

    dependents   = random.randint(0, 4)
    child_tax_cr = min(dependents * 2000, total_income * 0.2)

    return {
        "taxpayer_id":         taxpayer_id,
        "filing_status":       filing_status,
        "state":               state,
        "tax_year":            2024,
        "primary_income_src":  primary_src,
        "gross_income":        gross_income,
        "capital_gains":       capital_gains,
        "dividend_income":     dividend_income,
        "other_income":        other_income,
        "total_income":        round(total_income, 2),
        "standard_deduction":  std_ded,
        "itemized_deductions": round(itemized_total, 2),
        "uses_itemized":       uses_itemized,
        "deduction_used":      round(deduction_used, 2),
        "taxable_income":      round(taxable_income, 2),
        "federal_tax":         round(federal_tax, 2),
        "state_tax":           state_tax,
        "social_security_tax": social_sec,
        "medicare_tax":        medicare,
        "fica_total":          fica_total,
        "total_tax_liability": total_tax,
        "effective_tax_rate":  effective_rate,
        "marginal_tax_rate":   marginal_rate,
        "tax_withheld":        withheld,
        "refund_or_owed":      refund_due,
        "dependents":          dependents,
        "child_tax_credit":    round(child_tax_cr, 2),
        "filing_date":         random_date(),
        "mortgage_interest":   itemized.get("mortgage_interest", 0),
        "charitable_giving":   itemized.get("charitable", 0),
        "medical_expenses":    itemized.get("medical", 0),
        "salt_deduction":      itemized.get("state_local_taxes", 0),
    }


def _calculate_tax(income: float, brackets: list) -> float:
    tax      = 0.0
    prev_cap = 0.0
    for cap, rate in brackets:
        if income <= prev_cap:
            break
        taxable_in_bracket = min(income, cap) - prev_cap
        tax       += taxable_in_bracket * rate
        prev_cap   = cap
    return round(tax, 2)


def _get_marginal_rate(income: float, brackets: list) -> float:
    prev_cap = 0.0
    for cap, rate in brackets:
        if income <= cap:
            return rate * 100
        prev_cap = cap
    return brackets[-1][1] * 100


def generate_dataset(num_records: int = 500, output_file: str = "tax_data.csv") -> str:
    records = [generate_taxpayer(i + 1) for i in range(num_records)]

    if not records:
        return output_file

    fieldnames = list(records[0].keys())
    with open(output_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    print(f"Generated {num_records} tax records -> {output_file}")
    return output_file


if __name__ == "__main__":
    random.seed(42)
    generate_dataset(500, "tax_data.csv")
