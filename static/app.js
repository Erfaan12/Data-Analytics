/* ============================================================
   Tax Data Analyzer – Frontend Application
   ============================================================ */

'use strict';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API = '';          // same-origin; empty prefix = relative URLs
const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Chart palette
// ---------------------------------------------------------------------------
const PALETTE = [
  '#4f8ef7','#38c98b','#f7934f','#f75f5f','#a78bfa',
  '#34d399','#fbbf24','#fb7185','#60a5fa','#f472b6',
];
const CHART_DEFAULTS = {
  plugins: { legend: { labels: { color: '#8891aa', font: { size: 12 } } } },
  scales: {
    x: { ticks: { color: '#8891aa' }, grid: { color: '#2e3347' } },
    y: { ticks: { color: '#8891aa' }, grid: { color: '#2e3347' } },
  },
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
const usd   = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct   = v => Number(v).toFixed(2) + '%';
const num   = v => Number(v).toLocaleString('en-US');
const cap   = s => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

function setStatus(ok, msg) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.className  = `status-dot ${ok ? 'ok' : 'error'}`;
  text.textContent = msg;
}

function kpiCard(label, value, sub = '', variant = '') {
  return `<div class="kpi-card ${variant}">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;
}

function statsRows(stats, formatFn) {
  return Object.entries(stats).map(([k, v]) => {
    const val = k === 'count' ? num(v) : formatFn(v);
    return `<tr><td>${cap(k)}</td><td class="num">${val}</td></tr>`;
  }).join('');
}

// Destroy + recreate a chart instance
const _chartInstances = {};
function mkChart(id, config) {
  if (_chartInstances[id]) _chartInstances[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  _chartInstances[id] = new Chart(ctx, config);
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function apiFetch(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

// ---- SUMMARY ---------------------------------------------------------------
async function renderSummary(full) {
  const s = full.summary;
  const tr = full.tax_rates;
  const by = tr.by_filing_status;

  document.getElementById('kpiGrid').innerHTML = [
    kpiCard('Total Taxpayers',      num(s.total_taxpayers),          '', 'accent'),
    kpiCard('Total Income',          usd(s.total_income_reported),   `Avg ${usd(s.avg_income)}`, ''),
    kpiCard('Federal Tax Collected', usd(s.total_federal_tax),       '', 'orange'),
    kpiCard('State Tax Collected',   usd(s.total_state_tax),         '', 'orange'),
    kpiCard('FICA Collected',        usd(s.total_fica),              '', 'orange'),
    kpiCard('Total Tax Collected',   usd(s.total_tax_collected),     `Avg ${usd(s.avg_total_tax)}`, 'red'),
    kpiCard('Overall Effective Rate',pct(s.overall_effective_rate),  '', 'accent'),
    kpiCard('Total Refunds Issued',  usd(s.total_refunds_issued),    '', 'green'),
    kpiCard('Total Tax Owed',        usd(s.total_tax_owed),          '', 'red'),
  ].join('');

  // Income by source
  const srcData = full.income.by_income_source;
  mkChart('chartIncomeSource', {
    type: 'bar',
    data: {
      labels: Object.keys(srcData).map(cap),
      datasets: [{
        label: 'Avg Income',
        data: Object.values(srcData).map(d => d.mean),
        backgroundColor: PALETTE,
        borderRadius: 6,
      }],
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
  });

  // Filing status pie
  const fs = tr.by_filing_status;
  mkChart('chartFilingStatus', {
    type: 'doughnut',
    data: {
      labels: Object.keys(fs).map(cap),
      datasets: [{ data: Object.values(fs).map(d => d.count), backgroundColor: PALETTE, borderWidth: 0 }],
    },
    options: { plugins: { legend: { labels: { color: '#8891aa' } } } },
  });

  // Tax breakdown doughnut
  mkChart('chartTaxBreakdown', {
    type: 'doughnut',
    data: {
      labels: ['Federal Tax', 'State Tax', 'FICA'],
      datasets: [{
        data: [s.total_federal_tax, s.total_state_tax, s.total_fica],
        backgroundColor: [PALETTE[0], PALETTE[1], PALETTE[2]],
        borderWidth: 0,
      }],
    },
    options: { plugins: { legend: { labels: { color: '#8891aa' } } } },
  });
}

// ---- INCOME ----------------------------------------------------------------
async function renderIncome(full) {
  const inc = full.income;
  const bd  = inc.bracket_distribution;

  mkChart('chartIncomeBrackets', {
    type: 'bar',
    data: {
      labels: Object.keys(bd),
      datasets: [
        { label: 'Taxpayers', data: Object.values(bd).map(d => d.count), backgroundColor: PALETTE[0], borderRadius: 6 },
      ],
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
  });

  // Overall stats table
  document.getElementById('tblIncomeStats').innerHTML =
    `<thead><tr><th>Metric</th><th class="num">Value</th></tr></thead>
     <tbody>${statsRows(inc.overall_stats, usd)}</tbody>`;

  // By source table
  const srcRows = Object.entries(inc.by_income_source).map(([src, s]) =>
    `<tr><td>${cap(src)}</td><td class="num">${usd(s.mean)}</td><td class="num">${usd(s.median)}</td>
     <td class="num">${usd(s.min)}</td><td class="num">${usd(s.max)}</td><td class="num">${num(s.count)}</td></tr>`
  ).join('');
  document.getElementById('tblIncomeSource').innerHTML =
    `<thead><tr><th>Source</th><th class="num">Mean</th><th class="num">Median</th>
     <th class="num">Min</th><th class="num">Max</th><th class="num">Count</th></tr></thead>
     <tbody>${srcRows}</tbody>`;
}

// ---- TAX RATES -------------------------------------------------------------
async function renderTaxRates(full) {
  const tr  = full.tax_rates;
  const md  = tr.marginal_distribution;
  const fs  = tr.by_filing_status;

  mkChart('chartMarginal', {
    type: 'bar',
    data: {
      labels: Object.keys(md),
      datasets: [{ label: 'Taxpayers', data: Object.values(md), backgroundColor: PALETTE[3], borderRadius: 6 }],
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
  });

  mkChart('chartEffectiveByStatus', {
    type: 'bar',
    data: {
      labels: Object.keys(fs).map(cap),
      datasets: [{
        label: 'Avg Effective Rate (%)',
        data: Object.values(fs).map(d => d.avg_effective),
        backgroundColor: [PALETTE[0], PALETTE[1], PALETTE[2]],
        borderRadius: 6,
      }],
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
  });

  document.getElementById('tblEffectiveStats').innerHTML =
    `<thead><tr><th>Metric</th><th class="num">Value</th></tr></thead>
     <tbody>${statsRows(tr.effective_rate_stats, pct)}</tbody>`;

  const fsRows = Object.entries(fs).map(([status, d]) =>
    `<tr><td>${cap(status)}</td><td class="num">${num(d.count)}</td>
     <td class="num">${pct(d.avg_effective)}</td><td class="num">${usd(d.avg_federal_tax)}</td></tr>`
  ).join('');
  document.getElementById('tblFilingStats').innerHTML =
    `<thead><tr><th>Filing Status</th><th class="num">Count</th>
     <th class="num">Avg Effective Rate</th><th class="num">Avg Federal Tax</th></tr></thead>
     <tbody>${fsRows}</tbody>`;
}

// ---- DEDUCTIONS ------------------------------------------------------------
async function renderDeductions(full) {
  const d = full.deductions;

  document.getElementById('kpiDeductions').innerHTML = [
    kpiCard('Itemizers',             num(d.itemizer_count),              `${d.itemizer_pct}% of filers`, 'accent'),
    kpiCard('Standard Filers',       num(d.standard_filer_count),        `${(100-d.itemizer_pct).toFixed(1)}% of filers`, ''),
    kpiCard('Avg Itemized Total',    usd(d.avg_itemized_total),          '', 'orange'),
    kpiCard('Avg Standard Deduction',usd(d.avg_standard_deduction),      '', ''),
    kpiCard('Avg Tax Saved (Itemize)',usd(d.avg_tax_savings_itemize),    'vs. standard deduction', 'green'),
  ].join('');

  mkChart('chartItemizedVsStd', {
    type: 'doughnut',
    data: {
      labels: ['Itemized', 'Standard'],
      datasets: [{ data: [d.itemizer_count, d.standard_filer_count], backgroundColor: [PALETTE[0], PALETTE[4]], borderWidth: 0 }],
    },
    options: { plugins: { legend: { labels: { color: '#8891aa' } } } },
  });

  const cats = d.category_breakdown;
  mkChart('chartItemizedCats', {
    type: 'bar',
    data: {
      labels: Object.keys(cats).map(cap),
      datasets: [{ label: 'Avg Amount', data: Object.values(cats).map(c => c.mean || 0), backgroundColor: PALETTE, borderRadius: 6 }],
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
  });
}

// ---- REFUNDS ---------------------------------------------------------------
async function renderRefunds(full) {
  const r = full.refunds;

  document.getElementById('kpiRefunds').innerHTML = [
    kpiCard('Receiving Refund',  num(r.refund_count),   `${r.over_withheld_pct}% of filers`, 'green'),
    kpiCard('Owe Taxes',         num(r.owed_count),     `${(100-r.over_withheld_pct).toFixed(1)}% of filers`, 'red'),
    kpiCard('Avg Refund',        usd(r.refund_stats.mean || 0), '', 'green'),
    kpiCard('Avg Amount Owed',   usd(r.owed_stats.mean  || 0),  '', 'red'),
    kpiCard('Largest Refund',    usd(r.refund_stats.max || 0),  '', 'accent'),
    kpiCard('Largest Owed',      usd(r.owed_stats.max   || 0),  '', 'orange'),
  ].join('');

  const bd = r.bucket_distribution;
  mkChart('chartRefundBuckets', {
    type: 'bar',
    data: {
      labels: Object.keys(bd),
      datasets: [{ label: 'Count', data: Object.values(bd), backgroundColor: Object.keys(bd).map((k,i) => PALETTE[i % PALETTE.length]), borderRadius: 6 }],
    },
    options: { ...CHART_DEFAULTS, indexAxis: 'y', plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
  });

  mkChart('chartRefundOwed', {
    type: 'doughnut',
    data: {
      labels: ['Getting Refund', 'Owe Taxes'],
      datasets: [{ data: [r.refund_count, r.owed_count], backgroundColor: [PALETTE[1], PALETTE[3]], borderWidth: 0 }],
    },
    options: { plugins: { legend: { labels: { color: '#8891aa' } } } },
  });
}

// ---- STATE -----------------------------------------------------------------
async function renderState(full) {
  const st = full.by_state;
  const states = Object.keys(st);

  mkChart('chartStateTax', {
    type: 'bar',
    data: {
      labels: states,
      datasets: [
        { label: 'Avg Federal Tax', data: states.map(s => st[s].avg_federal_tax), backgroundColor: PALETTE[0], borderRadius: 4 },
        { label: 'Avg State Tax',   data: states.map(s => st[s].avg_state_tax),   backgroundColor: PALETTE[1], borderRadius: 4 },
        { label: 'Avg FICA',        data: states.map(s => st[s].avg_total_tax - st[s].avg_federal_tax - st[s].avg_state_tax), backgroundColor: PALETTE[2], borderRadius: 4 },
      ],
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins }, scales: { ...CHART_DEFAULTS.scales, x: { ...CHART_DEFAULTS.scales.x, stacked: true }, y: { ...CHART_DEFAULTS.scales.y, stacked: true } } },
  });

  mkChart('chartStateRate', {
    type: 'radar',
    data: {
      labels: states,
      datasets: [{
        label: 'Avg Effective Rate (%)',
        data: states.map(s => st[s].avg_effective_rate),
        backgroundColor: 'rgba(79,142,247,0.15)',
        borderColor: PALETTE[0],
        pointBackgroundColor: PALETTE[0],
      }],
    },
    options: {
      plugins: { legend: { labels: { color: '#8891aa' } } },
      scales: { r: { ticks: { color: '#8891aa', backdropColor: 'transparent' }, grid: { color: '#2e3347' }, angleLines: { color: '#2e3347' }, pointLabels: { color: '#8891aa' } } },
    },
  });

  const stateRows = Object.entries(st).map(([state, d]) =>
    `<tr>
       <td><strong>${state}</strong></td>
       <td class="num">${num(d.count)}</td>
       <td class="num">${usd(d.avg_income)}</td>
       <td class="num">${usd(d.avg_federal_tax)}</td>
       <td class="num">${usd(d.avg_state_tax)}</td>
       <td class="num">${usd(d.avg_total_tax)}</td>
       <td class="num">${pct(d.avg_effective_rate)}</td>
       <td class="num">${usd(d.total_state_revenue)}</td>
     </tr>`
  ).join('');
  document.getElementById('tblState').innerHTML =
    `<thead><tr>
       <th>State</th><th class="num">Count</th><th class="num">Avg Income</th>
       <th class="num">Avg Federal</th><th class="num">Avg State</th>
       <th class="num">Avg Total</th><th class="num">Eff Rate</th>
       <th class="num">State Revenue</th>
     </tr></thead>
     <tbody>${stateRows}</tbody>`;
}

// ---- CAPITAL GAINS ---------------------------------------------------------
async function renderCapGains(full) {
  const cg = full.capital_gains;

  document.getElementById('kpiCapGains').innerHTML = [
    kpiCard('CG Filers',         num(cg.cg_filer_count),           `${cg.cg_filer_pct}% of all filers`, 'accent'),
    kpiCard('Avg Capital Gains', usd(cg.capital_gains_stats.mean  || 0), '', 'orange'),
    kpiCard('Max Capital Gains', usd(cg.capital_gains_stats.max   || 0), '', 'red'),
    kpiCard('Avg Dividends',     usd(cg.dividend_income_stats.mean || 0),'', 'green'),
    kpiCard('CG as % of Income', pct(cg.avg_cg_pct_of_income),         '', 'accent'),
  ].join('');

  const cgStats  = cg.capital_gains_stats;
  const divStats = cg.dividend_income_stats;

  mkChart('chartCGStats', {
    type: 'bar',
    data: {
      labels: ['Mean', 'Median', 'Min', 'Max'],
      datasets: [{ label: 'Capital Gains ($)', data: [cgStats.mean, cgStats.median, cgStats.min, cgStats.max], backgroundColor: PALETTE[2], borderRadius: 6 }],
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
  });

  mkChart('chartDivStats', {
    type: 'bar',
    data: {
      labels: ['Mean', 'Median', 'Min', 'Max'],
      datasets: [{ label: 'Dividends ($)', data: [divStats.mean, divStats.median, divStats.min, divStats.max], backgroundColor: PALETTE[1], borderRadius: 6 }],
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
  });
}

// ---- CREDITS ---------------------------------------------------------------
async function renderCredits(full) {
  const cd = full.credits_dependents;

  document.getElementById('kpiCredits').innerHTML = [
    kpiCard('Avg Child Tax Credit',   usd(cd.avg_credit),              '', 'green'),
    kpiCard('Total Credits Claimed',  usd(cd.total_credits_claimed),   '', 'accent'),
    kpiCard('Avg Credit Stats Max',   usd(cd.credit_stats.max || 0),   '', 'orange'),
  ].join('');

  const dd = cd.dependent_distribution;
  mkChart('chartDependents', {
    type: 'pie',
    data: {
      labels: Object.keys(dd).map(k => `${k} dep.`),
      datasets: [{ data: Object.values(dd), backgroundColor: PALETTE, borderWidth: 0 }],
    },
    options: { plugins: { legend: { labels: { color: '#8891aa' } } } },
  });

  const tbd = cd.avg_tax_by_dependents;
  mkChart('chartTaxByDeps', {
    type: 'line',
    data: {
      labels: Object.keys(tbd).map(k => `${k} dep.`),
      datasets: [{
        label: 'Avg Total Tax ($)',
        data: Object.values(tbd),
        borderColor: PALETTE[3],
        backgroundColor: 'rgba(247,95,95,0.12)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: PALETTE[3],
      }],
    },
    options: CHART_DEFAULTS,
  });
}

// ---- FICA ------------------------------------------------------------------
async function renderFICA(full) {
  const f = full.fica;

  document.getElementById('kpiFica').innerHTML = [
    kpiCard('Total FICA Collected',    usd(f.total_fica_collected),              '', 'accent'),
    kpiCard('Avg FICA % of Income',    pct(f.avg_fica_pct_of_income),            '', 'orange'),
    kpiCard('Avg Social Security',     usd(f.social_security_stats.mean || 0),   '', 'green'),
    kpiCard('Avg Medicare',            usd(f.medicare_stats.mean || 0),          '', 'accent'),
    kpiCard('Total SS Collected',      usd(f.social_security_stats.total || 0),  '', ''),
    kpiCard('Total Medicare Collected',usd(f.medicare_stats.total || 0),         '', ''),
  ].join('');

  const ss  = f.social_security_stats;
  const med = f.medicare_stats;

  mkChart('chartFICA', {
    type: 'bar',
    data: {
      labels: ['Mean', 'Median', 'Min', 'Max'],
      datasets: [
        { label: 'Social Security', data: [ss.mean, ss.median, ss.min, ss.max],   backgroundColor: PALETTE[0], borderRadius: 6 },
        { label: 'Medicare',        data: [med.mean, med.median, med.min, med.max], backgroundColor: PALETTE[2], borderRadius: 6 },
      ],
    },
    options: CHART_DEFAULTS,
  });
}

// ---------------------------------------------------------------------------
// Records table
// ---------------------------------------------------------------------------
let _recOffset = 0;
let _recTotal  = 0;

const DISPLAYED_COLS = [
  'taxpayer_id','filing_status','state','total_income','taxable_income',
  'federal_tax','state_tax','fica_total','total_tax_liability',
  'effective_tax_rate','marginal_tax_rate','refund_or_owed','uses_itemized',
];

async function loadRecords(offset = 0) {
  const data = await apiFetch(`/api/records?limit=${PAGE_SIZE}&offset=${offset}`);
  _recOffset = offset;
  _recTotal  = data.total;
  const records = data.records;

  document.getElementById('recordsTotal').textContent = `${num(_recTotal)} total records`;
  document.getElementById('pageInfo').textContent =
    `${offset + 1}–${Math.min(offset + PAGE_SIZE, _recTotal)}`;

  document.getElementById('btnPrev').disabled = offset === 0;
  document.getElementById('btnNext').disabled = offset + PAGE_SIZE >= _recTotal;

  const cols = records.length ? DISPLAYED_COLS : [];
  document.getElementById('tblRecordsHead').innerHTML =
    `<tr>${cols.map(c => `<th>${cap(c)}</th>`).join('')}</tr>`;

  document.getElementById('tblRecordsBody').innerHTML = records.map(r => {
    const cells = DISPLAYED_COLS.map(col => {
      let val = r[col];
      const isNum = typeof val === 'number';
      if (['total_income','taxable_income','federal_tax','state_tax',
           'fica_total','total_tax_liability','refund_or_owed'].includes(col)) val = usd(val);
      else if (['effective_tax_rate','marginal_tax_rate'].includes(col)) val = pct(val);
      else if (col === 'refund_or_owed') val = usd(val);
      const cls = col === 'refund_or_owed' ? (Number(r[col]) >= 0 ? 'green' : 'red') : '';
      return `<td class="${cls}">${val}</td>`;
    });
    return `<tr>${cells.join('')}</tr>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const TITLES = {
  summary:'Dashboard', income:'Income Distribution', taxrates:'Tax Rates',
  deductions:'Deductions', refunds:'Refunds & Owed', state:'By State',
  capgains:'Capital Gains', credits:'Credits & Dependents', fica:'FICA / Payroll',
  records:'Raw Records',
};

function navigate(section) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === section));
  document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
  document.getElementById('pageTitle').textContent = TITLES[section] || section;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
let _full = null;

async function boot() {
  setStatus(false, 'Loading…');
  try {
    _full = await apiFetch('/api/full');
    setStatus(true, `${num(_full.summary.total_taxpayers)} records loaded`);
    toast('Data loaded successfully', 'ok');

    await renderSummary(_full);
    navigate('summary');

    // Pre-render visible charts; others rendered on first visit
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', async e => {
        e.preventDefault();
        const sec = link.dataset.section;
        navigate(sec);
        if (sec === 'income')      await renderIncome(_full);
        else if (sec === 'taxrates')   await renderTaxRates(_full);
        else if (sec === 'deductions') await renderDeductions(_full);
        else if (sec === 'refunds')    await renderRefunds(_full);
        else if (sec === 'state')      await renderState(_full);
        else if (sec === 'capgains')   await renderCapGains(_full);
        else if (sec === 'credits')    await renderCredits(_full);
        else if (sec === 'fica')       await renderFICA(_full);
        else if (sec === 'records')    await loadRecords(0);
        else if (sec === 'summary')    await renderSummary(_full);
      });
    });

  } catch (err) {
    setStatus(false, 'Error loading data');
    toast('Failed to load data: ' + err.message, 'error');
    console.error(err);
  }
}

// Regenerate
document.getElementById('btnRegen').addEventListener('click', async () => {
  try {
    setStatus(false, 'Regenerating…');
    await fetch('/api/regenerate?records=500&seed=' + Math.floor(Math.random() * 9999), { method: 'POST' });
    _full = await apiFetch('/api/full');
    setStatus(true, `${num(_full.summary.total_taxpayers)} records loaded`);
    await renderSummary(_full);
    navigate('summary');
    toast('Dataset regenerated!', 'ok');
  } catch (err) {
    toast('Regenerate failed: ' + err.message, 'error');
    setStatus(false, 'Error');
  }
});

// CSV Upload
document.getElementById('csvUpload').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Upload failed');
    _full = await apiFetch('/api/full');
    setStatus(true, `${num(_full.summary.total_taxpayers)} records loaded`);
    await renderSummary(_full);
    navigate('summary');
    toast(`Uploaded ${num(json.records_loaded)} records`, 'ok');
  } catch (err) {
    toast('Upload failed: ' + err.message, 'error');
  }
  e.target.value = '';
});

// Records pagination
document.getElementById('btnPrev').addEventListener('click', () => loadRecords(_recOffset - PAGE_SIZE));
document.getElementById('btnNext').addEventListener('click', () => loadRecords(_recOffset + PAGE_SIZE));

// Start
boot();
