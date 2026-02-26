# Data-Analytics
Business Intelligence Data Analytics Application

A comprehensive analytics engine, and human-readable reporting tools. The system analyzes 500 sample tax records across multiple dimensions including income distribution, tax rates, deductions, refunds, and state-level comparisons.

Key Changes
tax_data_generator.py: Generates realistic synthetic tax data for 500 taxpayers with:

Multiple income sources (wages, self-employment, investment, rental, retirement)
Accurate 2024 federal tax bracket calculations for different filing statuses
State tax calculations based on actual state rates
FICA (Social Security and Medicare) tax computation
Itemized vs. standard deduction logic
Dependent and child tax credit simulation
tax_analyzer.py: Core analytics engine providing:

Income distribution analysis by bracket and source
Tax rate analysis (effective and marginal rates by filing status)
Deduction analysis comparing itemizers vs. standard filers
Refund/amount-owed forecasting with bucket distributions
State-level tax comparisons
Capital gains and dividend income analysis
Dependent and tax credit impact analysis
FICA tax statistics
tax_report.py: Report generation system that:

Produces formatted console output with visual elements (progress bars, tables)
Exports analysis results to JSON and CSV formats
Provides executive summary, detailed breakdowns by category
Includes state-level comparison tables
tax_data.csv: Sample dataset of 500 tax records with 34 fields covering income, deductions, taxes, and credits

tax_analysis.json: Pre-computed analysis results with comprehensive statistics across all dimensions

state_summary.csv: State-level tax summary export

requirements.txt & .gitignore: Project configuration files

Notable Implementation Details
All calculations use 2024 US federal tax brackets and standard deductions
Supports three filing statuses (single, married, head of household) with appropriate bracket structures
Deduction analysis includes mortgage interest, charitable giving, medical expenses, and SALT deductions
Refund analysis categorizes taxpayers into 7 buckets from "Refund > $5k" to "Owe > $5k"
State analysis covers 10 states with varying tax rates (0% to 9.3%)
Uses Python standard library only (no external dependencies)
Type hints included for Python 3.10+ compatibility
