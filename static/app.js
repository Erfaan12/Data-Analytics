'use strict';

/* ============================================================
   TaxLens – Application Logic
   ============================================================ */

const PAGE_SIZE = 50;

/* ── Colour tokens (must match CSS) ── */
const CLR = {
  blue:   '#6366f1',
  blueH:  '#818cf8',
  green:  '#22c55e',
  red:    '#ef4444',
  amber:  '#f59e0b',
  cyan:   '#06b6d4',
  violet: '#8b5cf6',
  pink:   '#ec4899',
  teal:   '#14b8a6',
  orange: '#f97316',
};
const PAL = [CLR.blue, CLR.cyan, CLR.green, CLR.amber, CLR.violet, CLR.pink, CLR.teal, CLR.orange, CLR.red];

/* ── Chart.js defaults ── */
Chart.defaults.color       = '#5c6482';
Chart.defaults.borderColor = '#1b1e2b';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size   = 12;
Chart.defaults.animation.duration = 550;
Chart.defaults.plugins.tooltip.backgroundColor = '#1b1e2b';
Chart.defaults.plugins.tooltip.borderColor     = '#272a3d';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.titleColor      = '#e8eaf2';
Chart.defaults.plugins.tooltip.bodyColor       = '#9ca3bf';
Chart.defaults.plugins.tooltip.cornerRadius    = 8;

const GRID_COLOR   = '#1b1e2b';
const TICK_COLOR   = '#5c6482';
const LEGEND_OPTS  = { labels: { color: '#9ca3bf', usePointStyle: true, pointStyleWidth: 8, padding: 16, font: { size: 12 } } };
const SCALE_OPTS   = {
  x: { ticks: { color: TICK_COLOR }, grid: { color: GRID_COLOR } },
  y: { ticks: { color: TICK_COLOR }, grid: { color: GRID_COLOR }, beginAtZero: true },
};

/* ── Chart registry ── */
const charts = {};
function mkChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, cfg);
}

/* ── Formatters ── */
const usd  = v => '$' + (+v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdK = v => { const n = +v; return n >= 1e6 ? '$'+(n/1e6).toFixed(1)+'M' : n >= 1e3 ? '$'+(n/1e3).toFixed(0)+'K' : usd(n); };
const pct  = v => (+v).toFixed(2) + '%';
const num  = v => (+v).toLocaleString('en-US');
const cap  = s => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g,' ');

/* ── Toast ── */
function toast(msg, type = 'ok', duration = 3500) {
  const stack = document.getElementById('toastStack');
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-dot"></span>${msg}`;
  stack.appendChild(el);
  const remove = () => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), { once: true }); };
  setTimeout(remove, duration);
}

/* ── Status dot in sidebar ── */
function setStatus(state, label) {
  const dot = document.getElementById('datasetDot');
  const lbl = document.getElementById('datasetLabel');
  if (dot) dot.className = 'dataset-dot ' + state;
  if (lbl) lbl.textContent = label;
}

/* ── KPI card builder ── */
function kpi(label, value, sub = '', cls = '') {
  return `<div class="kpi-card ${cls}">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;
}

/* ── Table row builder for stats ── */
function statRows(obj, fmtFn) {
  return Object.entries(obj).map(([k, v]) =>
    `<tr><td>${cap(k)}</td><td class="r">${k === 'count' ? num(v) : fmtFn(v)}</td></tr>`
  ).join('');
}

/* ── Fetch ── */
async function get(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

/* ── Gradient fill helper for line charts ── */
function gFill(id, hex, alpha = .25) {
  const el = document.getElementById(id);
  if (!el) return hex;
  const ctx = el.getContext('2d');
  const g   = ctx.createLinearGradient(0, 0, 0, 300);
  const [rr,gg,bb] = hex.match(/\w\w/g).map(x => parseInt(x, 16));
  g.addColorStop(0, `rgba(${rr},${gg},${bb},${alpha})`);
  g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
  return g;
}

/* ============================================================
   VIEW RENDERERS
   ============================================================ */

/* ── DASHBOARD ── */
function renderDashboard(d) {
  const s  = d.summary;
  const tr = d.tax_rates;
  const fs = tr.by_filing_status;

  /* KPI cards */
  document.getElementById('kpiRow').innerHTML = [
    kpi('Total Filers',         num(s.total_taxpayers),         '',                       'c-blue'),
    kpi('Total Income',         usdK(s.total_income_reported),  `Avg ${usdK(s.avg_income)}`),
    kpi('Tax Collected',        usdK(s.total_tax_collected),    `Avg ${usdK(s.avg_total_tax)}`, 'c-red'),
    kpi('Effective Rate',       pct(s.overall_effective_rate),  '2024 US average',        'c-amber'),
    kpi('Refunds Issued',       usdK(s.total_refunds_issued),   `${d.refunds.over_withheld_pct}% over-withheld`, 'c-green'),
  ].join('');

  /* Tax breakdown donut */
  mkChart('cTaxBreakdown', {
    type: 'doughnut',
    data: {
      labels: ['Federal Tax', 'State Tax', 'FICA'],
      datasets: [{ data: [s.total_federal_tax, s.total_state_tax, s.total_fica], backgroundColor: [CLR.blue, CLR.cyan, CLR.violet], borderWidth: 0, hoverOffset: 10 }],
    },
    options: { plugins: { legend: LEGEND_OPTS }, cutout: '60%' },
  });

  /* Filing status donut */
  mkChart('cFilingStatus', {
    type: 'doughnut',
    data: {
      labels: Object.keys(fs).map(cap),
      datasets: [{ data: Object.values(fs).map(v => v.count), backgroundColor: [CLR.blue, CLR.amber, CLR.teal], borderWidth: 0, hoverOffset: 10 }],
    },
    options: { plugins: { legend: LEGEND_OPTS }, cutout: '60%' },
  });

  /* Income by source bar */
  const src = d.income.by_income_source;
  mkChart('cIncomeSource', {
    type: 'bar',
    data: {
      labels: Object.keys(src).map(cap),
      datasets: [{ label: 'Avg Income', data: Object.values(src).map(v => v.mean), backgroundColor: PAL, borderRadius: 6, borderSkipped: false }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + usd(c.raw) } } },
      scales: SCALE_OPTS,
    },
  });

  /* Effective rate by filing status */
  mkChart('cEffByStatus', {
    type: 'bar',
    data: {
      labels: Object.keys(fs).map(cap),
      datasets: [{ label: 'Avg Effective Rate', data: Object.values(fs).map(v => v.avg_effective), backgroundColor: [CLR.blue, CLR.amber, CLR.teal], borderRadius: 6, borderSkipped: false }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + pct(c.raw) } } },
      scales: { ...SCALE_OPTS, y: { ...SCALE_OPTS.y, ticks: { ...SCALE_OPTS.y.ticks, callback: v => v + '%' } } },
    },
  });
}

/* ── INCOME ── */
function renderIncome(d) {
  const inc = d.income;
  const bd  = inc.bracket_distribution;

  mkChart('cIncomeBrackets', {
    type: 'bar',
    data: {
      labels: Object.keys(bd),
      datasets: [{
        label: 'Filers',
        data: Object.values(bd).map(v => v.count),
        backgroundColor: PAL,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw} filers (${bd[Object.keys(bd)[c.dataIndex]].percent}%)` } } },
      scales: SCALE_OPTS,
    },
  });

  document.getElementById('tIncomeStats').innerHTML =
    `<thead><tr><th>Metric</th><th class="r">Value</th></tr></thead>
     <tbody>${statRows(inc.overall_stats, usd)}</tbody>`;

  const srcRows = Object.entries(inc.by_income_source).map(([k, v]) =>
    `<tr>
      <td>${cap(k)}</td>
      <td class="r">${usd(v.mean)}</td><td class="r">${usd(v.median)}</td>
      <td class="r muted">${usd(v.min)}</td><td class="r muted">${usd(v.max)}</td>
      <td class="r">${num(v.count)}</td>
    </tr>`
  ).join('');
  document.getElementById('tIncomeSrc').innerHTML =
    `<thead><tr><th>Source</th><th class="r">Mean</th><th class="r">Median</th><th class="r">Min</th><th class="r">Max</th><th class="r">Filers</th></tr></thead>
     <tbody>${srcRows}</tbody>`;
}

/* ── TAX RATES ── */
function renderTaxRates(d) {
  const tr = d.tax_rates;
  const md = tr.marginal_distribution;
  const fs = tr.by_filing_status;

  mkChart('cMarginal', {
    type: 'bar',
    data: {
      labels: Object.keys(md),
      datasets: [{ label: 'Filers', data: Object.values(md), backgroundColor: [CLR.green, CLR.cyan, CLR.blue, CLR.violet, CLR.amber, CLR.red], borderRadius: 6, borderSkipped: false }],
    },
    options: { plugins: { legend: { display: false } }, scales: SCALE_OPTS },
  });

  document.getElementById('tEffStats').innerHTML =
    `<thead><tr><th>Metric</th><th class="r">Value</th></tr></thead>
     <tbody>${statRows(tr.effective_rate_stats, pct)}</tbody>`;

  const fsRows = Object.entries(fs).map(([k, v]) =>
    `<tr>
      <td><strong>${cap(k)}</strong></td>
      <td class="r">${num(v.count)}</td>
      <td class="r">${pct(v.avg_effective)}</td>
      <td class="r">${usd(v.avg_federal_tax)}</td>
    </tr>`
  ).join('');
  document.getElementById('tFilingStatus').innerHTML =
    `<thead><tr><th>Filing Status</th><th class="r">Filers</th><th class="r">Avg Effective Rate</th><th class="r">Avg Federal Tax</th></tr></thead>
     <tbody>${fsRows}</tbody>`;
}

/* ── DEDUCTIONS ── */
function renderDeductions(d) {
  const dd = d.deductions;
  document.getElementById('kpiDeductions').innerHTML = [
    kpi('Itemizers',              num(dd.itemizer_count),         `${dd.itemizer_pct}% of filers`,               'c-blue'),
    kpi('Standard Filers',        num(dd.standard_filer_count),   `${(100 - dd.itemizer_pct).toFixed(1)}% of filers`),
    kpi('Avg Itemized Total',     usd(dd.avg_itemized_total),     'per itemizing filer',                         'c-amber'),
    kpi('Avg Tax Saved',          usd(dd.avg_tax_savings_itemize),'itemized vs standard',                        'c-green'),
    kpi('Avg Standard Deduction', usd(dd.avg_standard_deduction), 'for standard filers'),
  ].join('');

  const cats = dd.category_breakdown;
  mkChart('cItemizedCats', {
    type: 'bar',
    data: {
      labels: Object.keys(cats).map(cap),
      datasets: [{ label: 'Avg Amount', data: Object.values(cats).map(v => v.mean || 0), backgroundColor: [CLR.blue, CLR.cyan, CLR.green, CLR.amber], borderRadius: 6, borderSkipped: false }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + usd(c.raw) } } },
      scales: { ...SCALE_OPTS, y: { ...SCALE_OPTS.y, ticks: { ...SCALE_OPTS.y.ticks, callback: v => usdK(v) } } },
    },
  });

  mkChart('cItemizedVsStd', {
    type: 'doughnut',
    data: {
      labels: ['Itemized', 'Standard Deduction'],
      datasets: [{ data: [dd.itemizer_count, dd.standard_filer_count], backgroundColor: [CLR.blue, CLR.violet], borderWidth: 0, hoverOffset: 10 }],
    },
    options: { plugins: { legend: LEGEND_OPTS }, cutout: '60%' },
  });
}

/* ── REFUNDS ── */
function renderRefunds(d) {
  const r = d.refunds;
  document.getElementById('kpiRefunds').innerHTML = [
    kpi('Getting Refund',   num(r.refund_count),          `${r.over_withheld_pct}% of all filers`,                'c-green'),
    kpi('Owe Taxes',        num(r.owed_count),             `${(100 - r.over_withheld_pct).toFixed(1)}% of filers`, 'c-red'),
    kpi('Avg Refund',       usd(r.refund_stats.mean || 0), 'among those receiving',                                 'c-green'),
    kpi('Avg Amount Owed',  usd(r.owed_stats.mean  || 0), 'among those who owe',                                   'c-red'),
    kpi('Largest Refund',   usd(r.refund_stats.max  || 0), '',                                                      'c-blue'),
    kpi('Largest Owed',     usd(r.owed_stats.max   || 0), '',                                                      'c-amber'),
  ].join('');

  const bd = r.bucket_distribution;
  mkChart('cRefundBuckets', {
    type: 'bar',
    data: {
      labels: Object.keys(bd),
      datasets: [{ label: 'Filers', data: Object.values(bd), backgroundColor: PAL, borderRadius: 5, borderSkipped: false }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: SCALE_OPTS.x, y: { ...SCALE_OPTS.y, grid: { color: GRID_COLOR }, ticks: { color: TICK_COLOR } } },
    },
  });

  mkChart('cRefundOwed', {
    type: 'doughnut',
    data: {
      labels: ['Getting Refund', 'Owe Taxes'],
      datasets: [{ data: [r.refund_count, r.owed_count], backgroundColor: [CLR.green, CLR.red], borderWidth: 0, hoverOffset: 10 }],
    },
    options: { plugins: { legend: LEGEND_OPTS }, cutout: '60%' },
  });
}

/* ── STATES ── */
function renderStates(d) {
  const st     = d.by_state;
  const states = Object.keys(st);

  mkChart('cStateTax', {
    type: 'bar',
    data: {
      labels: states,
      datasets: [
        { label: 'Federal', data: states.map(s => st[s].avg_federal_tax),   backgroundColor: CLR.blue,   borderRadius: 4, borderSkipped: false, stack: 't' },
        { label: 'State',   data: states.map(s => st[s].avg_state_tax),    backgroundColor: CLR.cyan,   borderRadius: 4, borderSkipped: false, stack: 't' },
        { label: 'FICA',    data: states.map(s => st[s].avg_total_tax - st[s].avg_federal_tax - st[s].avg_state_tax), backgroundColor: CLR.violet, borderRadius: 4, borderSkipped: false, stack: 't' },
      ],
    },
    options: {
      plugins: { legend: LEGEND_OPTS, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${usd(c.raw)}` } } },
      scales: {
        x: { ...SCALE_OPTS.x, stacked: true },
        y: { ...SCALE_OPTS.y, stacked: true, ticks: { ...SCALE_OPTS.y.ticks, callback: v => usdK(v) } },
      },
    },
  });

  const stRows = Object.entries(st).map(([s, v]) =>
    `<tr>
      <td><strong>${s}</strong></td>
      <td class="r">${num(v.count)}</td>
      <td class="r">${usd(v.avg_income)}</td>
      <td class="r">${usd(v.avg_federal_tax)}</td>
      <td class="r">${usd(v.avg_state_tax)}</td>
      <td class="r">${usd(v.avg_total_tax)}</td>
      <td class="r">${pct(v.avg_effective_rate)}</td>
      <td class="r">${usdK(v.total_state_revenue)}</td>
    </tr>`
  ).join('');
  document.getElementById('tStates').innerHTML =
    `<thead><tr>
      <th>State</th><th class="r">Filers</th><th class="r">Avg Income</th>
      <th class="r">Avg Federal</th><th class="r">Avg State</th>
      <th class="r">Avg Total</th><th class="r">Eff Rate</th>
      <th class="r">State Revenue</th>
    </tr></thead>
     <tbody>${stRows}</tbody>`;
}

/* ── CAPITAL GAINS ── */
function renderCapGains(d) {
  const cg = d.capital_gains;
  document.getElementById('kpiCapGains').innerHTML = [
    kpi('CG Filers',         num(cg.cg_filer_count),                `${cg.cg_filer_pct}% of all filers`, 'c-blue'),
    kpi('Avg Capital Gains', usd(cg.capital_gains_stats.mean  || 0), '',                                  'c-amber'),
    kpi('Max Capital Gains', usd(cg.capital_gains_stats.max   || 0), '',                                  'c-red'),
    kpi('Avg Dividends',     usd(cg.dividend_income_stats.mean || 0),'',                                  'c-green'),
    kpi('CG % of Income',    pct(cg.avg_cg_pct_of_income),           'avg among CG filers',               'c-violet'),
  ].join('');

  const cgs = cg.capital_gains_stats;
  const dvs = cg.dividend_income_stats;
  const lbl = ['Mean', 'Median', 'Min', 'Max'];

  mkChart('cCGStats', {
    type: 'bar',
    data: { labels: lbl, datasets: [{ label: 'Capital Gains ($)', data: [cgs.mean, cgs.median, cgs.min, cgs.max], backgroundColor: [CLR.amber, CLR.amber, CLR.violet, CLR.red], borderRadius: 6, borderSkipped: false }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + usd(c.raw) } } }, scales: { ...SCALE_OPTS, y: { ...SCALE_OPTS.y, ticks: { ...SCALE_OPTS.y.ticks, callback: v => usdK(v) } } } },
  });

  mkChart('cDivStats', {
    type: 'bar',
    data: { labels: lbl, datasets: [{ label: 'Dividends ($)', data: [dvs.mean, dvs.median, dvs.min, dvs.max], backgroundColor: [CLR.green, CLR.green, CLR.violet, CLR.blue], borderRadius: 6, borderSkipped: false }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + usd(c.raw) } } }, scales: { ...SCALE_OPTS, y: { ...SCALE_OPTS.y, ticks: { ...SCALE_OPTS.y.ticks, callback: v => usdK(v) } } } },
  });
}

/* ── CREDITS ── */
function renderCredits(d) {
  const cd = d.credits_dependents;
  document.getElementById('kpiCredits').innerHTML = [
    kpi('Avg Child Tax Credit',  usd(cd.avg_credit),            '',                  'c-green'),
    kpi('Total Credits Claimed', usdK(cd.total_credits_claimed), 'across all filers', 'c-blue'),
    kpi('Max Credit',            usd(cd.credit_stats.max || 0),  '',                  'c-amber'),
  ].join('');

  const dd  = cd.dependent_distribution;
  const tbd = cd.avg_tax_by_dependents;

  mkChart('cDependents', {
    type: 'bar',
    data: {
      labels: Object.keys(dd).map(k => `${k} dep.`),
      datasets: [{ label: 'Filers', data: Object.values(dd), backgroundColor: PAL, borderRadius: 6, borderSkipped: false }],
    },
    options: { plugins: { legend: { display: false } }, scales: SCALE_OPTS },
  });

  mkChart('cTaxByDeps', {
    type: 'line',
    data: {
      labels: Object.keys(tbd).map(k => `${k} dependent${k === '1' ? '' : 's'}`),
      datasets: [{
        label: 'Avg Total Tax',
        data: Object.values(tbd),
        borderColor: CLR.red,
        backgroundColor: gFill('cTaxByDeps', 'ef4444', .18),
        tension: .4, fill: true,
        pointBackgroundColor: CLR.red, pointBorderColor: '#13151e', pointBorderWidth: 2, pointRadius: 5,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + usd(c.raw) } } },
      scales: { ...SCALE_OPTS, y: { ...SCALE_OPTS.y, ticks: { ...SCALE_OPTS.y.ticks, callback: v => usdK(v) } } },
    },
  });
}

/* ── FICA ── */
function renderFICA(d) {
  const f = d.fica;
  document.getElementById('kpiFica').innerHTML = [
    kpi('Total FICA Collected',  usdK(f.total_fica_collected),             '',  'c-blue'),
    kpi('Avg FICA % of Income',  pct(f.avg_fica_pct_of_income),            '',  'c-amber'),
    kpi('Avg Social Security',   usd(f.social_security_stats.mean || 0),   '',  'c-green'),
    kpi('Avg Medicare',          usd(f.medicare_stats.mean        || 0),   '',  'c-violet'),
  ].join('');

  const el = document.getElementById('ficaPct');
  if (el) el.textContent = pct(f.avg_fica_pct_of_income);

  const ss  = f.social_security_stats;
  const med = f.medicare_stats;
  mkChart('cFICA', {
    type: 'bar',
    data: {
      labels: ['Mean', 'Median', 'Min', 'Max'],
      datasets: [
        { label: 'Social Security', data: [ss.mean, ss.median, ss.min, ss.max], backgroundColor: CLR.blue, borderRadius: 5, borderSkipped: false },
        { label: 'Medicare',        data: [med.mean, med.median, med.min, med.max], backgroundColor: CLR.cyan, borderRadius: 5, borderSkipped: false },
      ],
    },
    options: {
      plugins: { legend: LEGEND_OPTS, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${usd(c.raw)}` } } },
      scales: { ...SCALE_OPTS, y: { ...SCALE_OPTS.y, ticks: { ...SCALE_OPTS.y.ticks, callback: v => usdK(v) } } },
    },
  });

  document.getElementById('tFICA').innerHTML =
    `<thead><tr><th>Metric</th><th class="r">Social Security</th><th class="r">Medicare</th></tr></thead>
     <tbody>
       <tr><td>Total</td><td class="r">${usd(ss.total||0)}</td><td class="r">${usd(med.total||0)}</td></tr>
       <tr><td>Mean</td><td class="r">${usd(ss.mean||0)}</td><td class="r">${usd(med.mean||0)}</td></tr>
       <tr><td>Max</td><td class="r">${usd(ss.max||0)}</td><td class="r">${usd(med.max||0)}</td></tr>
     </tbody>`;
}

/* ============================================================
   RECORDS TABLE (with search, filter, sort, pagination)
   ============================================================ */
const COLS = [
  { key:'taxpayer_id',        label:'ID',         fmt: num  },
  { key:'filing_status',      label:'Filing',     fmt: cap  },
  { key:'state',              label:'State',      fmt: v=>v },
  { key:'total_income',       label:'Total Income', fmt: usd },
  { key:'taxable_income',     label:'Taxable Income', fmt: usd },
  { key:'federal_tax',        label:'Federal Tax',  fmt: usd },
  { key:'state_tax',          label:'State Tax',    fmt: usd },
  { key:'fica_total',         label:'FICA',          fmt: usd },
  { key:'total_tax_liability',label:'Total Tax',     fmt: usd },
  { key:'effective_tax_rate', label:'Eff Rate',      fmt: pct },
  { key:'marginal_tax_rate',  label:'Marg Rate',     fmt: pct },
  { key:'refund_or_owed',     label:'Refund/Owed',   fmt: usd, colored: true },
];

let _recOffset = 0, _recTotal = 0, _recSearch = '', _recStatus = '', _recState = '';
let _allRecords = [];   // full dataset cached for client-side filter
let _sortKey = 'taxpayer_id', _sortDir = 1;

function filterRecords() {
  let rows = _allRecords;
  if (_recSearch)  rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(_recSearch));
  if (_recStatus)  rows = rows.filter(r => r.filing_status === _recStatus);
  if (_recState)   rows = rows.filter(r => r.state         === _recState);
  rows = [...rows].sort((a, b) => {
    const av = +a[_sortKey] || a[_sortKey] || 0;
    const bv = +b[_sortKey] || b[_sortKey] || 0;
    return av < bv ? -_sortDir : av > bv ? _sortDir : 0;
  });
  return rows;
}

function renderRecordPage() {
  const rows    = filterRecords();
  _recTotal     = rows.length;
  _recOffset    = Math.min(_recOffset, Math.max(0, _recTotal - PAGE_SIZE));
  const page    = rows.slice(_recOffset, _recOffset + PAGE_SIZE);
  const lastPg  = Math.max(0, Math.ceil(_recTotal / PAGE_SIZE) - 1);
  const curPg   = Math.floor(_recOffset / PAGE_SIZE);

  document.getElementById('recordsCount').textContent = `${num(_recTotal)} records`;
  document.getElementById('pagInfo').textContent = _recTotal
    ? `${_recOffset + 1}–${Math.min(_recOffset + PAGE_SIZE, _recTotal)} of ${num(_recTotal)}`
    : '0 records';
  document.getElementById('btnFirst').disabled = _recOffset === 0;
  document.getElementById('btnPrev').disabled  = _recOffset === 0;
  document.getElementById('btnNext').disabled  = _recOffset + PAGE_SIZE >= _recTotal;
  document.getElementById('btnLast').disabled  = curPg === lastPg;

  /* Header */
  document.getElementById('tRecordsHead').innerHTML = `<tr>${COLS.map(c => {
    const cls = c.key === _sortKey ? (_sortDir === 1 ? 'sort-asc' : 'sort-desc') : '';
    return `<th class="${cls}" data-key="${c.key}">${c.label}</th>`;
  }).join('')}</tr>`;

  /* Body */
  document.getElementById('tRecordsBody').innerHTML = page.map(r =>
    `<tr>${COLS.map(c => {
      let val = r[c.key];
      const display = c.fmt(val);
      let cls = '';
      if (c.colored) cls = +val >= 0 ? 'gr' : 'rd';
      return `<td class="${cls}">${display}</td>`;
    }).join('')}</tr>`
  ).join('') || '<tr><td colspan="12" style="text-align:center;color:var(--text-3);padding:32px">No records match your filters</td></tr>';

  /* Sort listeners */
  document.querySelectorAll('#tRecordsHead th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (_sortKey === key) _sortDir *= -1;
      else { _sortKey = key; _sortDir = 1; }
      _recOffset = 0;
      renderRecordPage();
    });
  });
}

async function initRecords(full) {
  _allRecords = full._raw || [];

  /* Populate state filter */
  const states = [...new Set(_allRecords.map(r => r.state))].sort();
  const sel    = document.getElementById('filterState');
  states.forEach(s => { const o = document.createElement('option'); o.value = o.textContent = s; sel.appendChild(o); });

  renderRecordPage();
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const VIEW_META = {
  dashboard: { title: 'Dashboard',       desc: 'US Federal & State Tax Analytics · Tax Year 2024' },
  income:    { title: 'Income Analysis', desc: 'Bracket distribution and income source breakdown' },
  taxrates:  { title: 'Tax Rates',       desc: 'Effective and marginal rates by filing status' },
  deductions:{ title: 'Deductions',      desc: 'Itemized vs. standard deduction analysis' },
  refunds:   { title: 'Refunds & Owed',  desc: 'Withholding accuracy and refund distribution' },
  states:    { title: 'By State',        desc: 'Federal, state, and FICA tax comparison across 10 states' },
  capgains:  { title: 'Capital Gains',   desc: 'Investment income and dividend statistics' },
  credits:   { title: 'Credits & Deps',  desc: 'Child tax credits and dependent impact on liability' },
  fica:      { title: 'FICA / Payroll',  desc: 'Social Security and Medicare tax breakdown' },
  records:   { title: 'Records',         desc: 'Searchable, filterable, sortable raw taxpayer data' },
};

let _currentView = 'dashboard';
let _full = null;

function navigate(view) {
  _currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));

  const meta = VIEW_META[view] || {};
  const t = document.getElementById('viewTitle'); if (t) t.textContent = meta.title || view;
  const d = document.getElementById('viewDesc');  if (d) d.textContent = meta.desc  || '';

  if (!_full) return;
  if      (view === 'income')     renderIncome(_full);
  else if (view === 'taxrates')   renderTaxRates(_full);
  else if (view === 'deductions') renderDeductions(_full);
  else if (view === 'refunds')    renderRefunds(_full);
  else if (view === 'states')     renderStates(_full);
  else if (view === 'capgains')   renderCapGains(_full);
  else if (view === 'credits')    renderCredits(_full);
  else if (view === 'fica')       renderFICA(_full);
  else if (view === 'records')    renderRecordPage();
  else if (view === 'dashboard')  renderDashboard(_full);
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  setStatus('', 'Loading…');
  try {
    /* Fetch full analysis + raw records in parallel */
    const [full, rawData] = await Promise.all([
      get('/api/full'),
      get('/api/records?limit=500&offset=0'),
    ]);
    _full = full;
    _full._raw = rawData.records;

    /* If dataset has more than 500 rows, fetch all */
    if (rawData.total > 500) {
      const extra = await get(`/api/records?limit=${rawData.total}&offset=0`);
      _full._raw  = extra.records;
    }

    setStatus('ready', `${num(full.summary.total_taxpayers)} records`);
    renderDashboard(_full);
    initRecords(_full);
    toast('Dataset loaded successfully', 'ok');
  } catch (err) {
    setStatus('error', 'Failed to load');
    toast('Failed to load data: ' + err.message, 'error', 6000);
    console.error(err);
  }
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

/* Nav */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    navigate(btn.dataset.view);
    /* Close sidebar on mobile */
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  });
});

/* Mobile sidebar */
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn        = document.getElementById('menuBtn');
const sidebarClose   = document.getElementById('sidebarClose');

menuBtn.addEventListener('click', () => { sidebar.classList.add('open'); sidebarOverlay.classList.add('active'); });
sidebarClose.addEventListener('click', () => { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); });
sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); });

/* Records: search + filters */
document.getElementById('recordSearch').addEventListener('input', e => {
  _recSearch = e.target.value.toLowerCase().trim();
  _recOffset = 0;
  renderRecordPage();
});
document.getElementById('filterStatus').addEventListener('change', e => {
  _recStatus = e.target.value;
  _recOffset = 0;
  renderRecordPage();
});
document.getElementById('filterState').addEventListener('change', e => {
  _recState = e.target.value;
  _recOffset = 0;
  renderRecordPage();
});

/* Records: pagination */
document.getElementById('btnFirst').addEventListener('click', () => { _recOffset = 0;                                    renderRecordPage(); });
document.getElementById('btnPrev') .addEventListener('click', () => { _recOffset = Math.max(0, _recOffset - PAGE_SIZE); renderRecordPage(); });
document.getElementById('btnNext') .addEventListener('click', () => { _recOffset += PAGE_SIZE;                           renderRecordPage(); });
document.getElementById('btnLast') .addEventListener('click', () => {
  _recOffset = Math.floor(Math.max(0, _recTotal - 1) / PAGE_SIZE) * PAGE_SIZE;
  renderRecordPage();
});

/* Regenerate dataset */
document.getElementById('btnRegen').addEventListener('click', async () => {
  toast('Generating new dataset…', 'warn', 2000);
  try {
    const seed = Math.floor(Math.random() * 99999);
    await fetch(`/api/regenerate?records=500&seed=${seed}`, { method: 'POST' });
    _full = null; _allRecords = [];
    setStatus('', 'Reloading…');
    await boot();
    navigate('dashboard');
  } catch (err) { toast('Failed: ' + err.message, 'error'); }
});

/* CSV upload (button) */
document.getElementById('csvUpload').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  toast('Uploading CSV…', 'warn', 2000);
  try {
    const form = new FormData(); form.append('file', file);
    const res  = await fetch('/api/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Upload failed');
    _full = null; _allRecords = [];
    await boot();
    navigate('dashboard');
    toast(`Loaded ${num(json.records_loaded)} records`, 'ok');
  } catch (err) { toast('Upload failed: ' + err.message, 'error'); }
  e.target.value = '';
});

/* Drag-and-drop CSV upload */
const dropZone = document.getElementById('dropZone');
let _dragDepth = 0;
document.addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { _dragDepth++; dropZone.classList.add('active'); } });
document.addEventListener('dragleave', () => { if (--_dragDepth <= 0) { _dragDepth = 0; dropZone.classList.remove('active'); } });
document.addEventListener('dragover',  e => e.preventDefault());
document.addEventListener('drop', async e => {
  e.preventDefault(); _dragDepth = 0; dropZone.classList.remove('active');
  const file = e.dataTransfer.files[0];
  if (!file || !file.name.endsWith('.csv')) { toast('Please drop a .csv file', 'warn'); return; }
  toast('Uploading dropped file…', 'warn', 2000);
  try {
    const form = new FormData(); form.append('file', file);
    const res  = await fetch('/api/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Upload failed');
    _full = null; _allRecords = [];
    await boot();
    navigate('dashboard');
    toast(`Loaded ${num(json.records_loaded)} records from ${file.name}`, 'ok');
  } catch (err) { toast('Upload failed: ' + err.message, 'error'); }
});

/* Export JSON */
document.getElementById('btnExport').addEventListener('click', () => {
  if (!_full) { toast('No data loaded yet', 'warn'); return; }
  const blob = new Blob([JSON.stringify(_full, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'tax_analysis.json'; a.click();
  URL.revokeObjectURL(url);
  toast('Analysis exported as JSON', 'ok');
});

/* ── Start ── */
boot();
