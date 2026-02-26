/* ================================================================
   TaxLens – Frontend Application
   Glassmorphism Aurora Design
   ================================================================ */
'use strict';

const PAGE_SIZE = 50;

/* ── Aurora colour palette ── */
const C = {
  indigo:  '#818cf8',
  cyan:    '#22d3ee',
  emerald: '#34d399',
  rose:    '#fb7185',
  amber:   '#fbbf24',
  violet:  '#a78bfa',
  pink:    '#f472b6',
  sky:     '#38bdf8',
  lime:    '#a3e635',
};
const PALETTE = [C.indigo, C.cyan, C.emerald, C.rose, C.amber, C.violet, C.pink, C.sky, C.lime];

/* ── Chart.js global defaults ── */
Chart.defaults.color          = '#8892b0';
Chart.defaults.borderColor    = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family    = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size      = 12;
Chart.defaults.animation.duration = 700;
Chart.defaults.animation.easing   = 'easeOutQuart';

/* Shared scale config */
const SCALES = {
  x: { ticks:{ color:'#8892b0', maxRotation:30 }, grid:{ color:'rgba(255,255,255,0.04)' } },
  y: { ticks:{ color:'#8892b0' },                  grid:{ color:'rgba(255,255,255,0.04)' } },
};
const LEGEND = { labels:{ color:'#8892b0', usePointStyle:true, pointStyleWidth:8, padding:16 } };

/* Create a gradient fill for a canvas */
function grad(ctx, top, bottom, alpha = 0.35) {
  if (!ctx) return top;
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  g.addColorStop(0, top.replace(')', `,${alpha})`).replace('rgb','rgba'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  return g;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${r},${g},${b})`;
}

function gradFill(id, color, alpha = 0.28) {
  const el = document.getElementById(id);
  if (!el) return color;
  const ctx = el.getContext('2d');
  const g   = ctx.createLinearGradient(0, 0, 0, 280);
  const [r,g2,b] = color.match(/\w\w/g).map(x=>parseInt(x,16));
  g.addColorStop(0, `rgba(${r},${g2},${b},${alpha})`);
  g.addColorStop(1, `rgba(${r},${g2},${b},0)`);
  return g;
}

/* ── Chart registry ── */
const _charts = {};
function mkChart(id, config) {
  if (_charts[id]) _charts[id].destroy();
  const el = document.getElementById(id);
  if (!el) return;
  _charts[id] = new Chart(el, config);
}

/* ── Formatters ── */
const usd = v => '$' + Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct = v => Number(v).toFixed(2) + '%';
const num = v => Number(v).toLocaleString('en-US');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g,' ');

/* ── Loading bar ── */
function setLoader(pct, label) {
  const fill = document.getElementById('loaderFill');
  const lbl  = document.getElementById('loaderLabel');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent = label;
}
function hideLoader() {
  const el = document.getElementById('loaderScreen');
  if (el) el.classList.add('done');
}

/* ── Status ── */
function setStatus(ok, msg) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (dot)  dot.className  = `status-dot ${ok ? 'ok' : 'error'}`;
  if (text) text.textContent = msg;
}

/* ── Toast ── */
function toast(msg, type='ok') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${type==='ok' ? '✦' : '✕'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 3500);
}

/* ── KPI card builder ── */
function kpiCard(label, value, sub='', variant='') {
  return `<div class="kpi-card ${variant?'v-'+variant:''}">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;
}

/* ── Stats table rows ── */
function statsRows(stats, fmt) {
  return Object.entries(stats).map(([k,v]) =>
    `<tr><td>${cap(k)}</td><td class="num">${k==='count'?num(v):fmt(v)}</td></tr>`
  ).join('');
}

/* ── API fetch ── */
async function apiFetch(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

/* ================================================================
   SECTION RENDERERS
   ================================================================ */

/* ── SUMMARY ── */
async function renderSummary(full) {
  const s  = full.summary;
  const tr = full.tax_rates;
  const fs = tr.by_filing_status;

  /* Hero stats */
  document.getElementById('heroStats').innerHTML = [
    `<div class="hero-stat"><div class="hero-stat-val">${num(s.total_taxpayers)}</div><div class="hero-stat-label">Filers</div></div>`,
    `<div class="hero-stat"><div class="hero-stat-val">${pct(s.overall_effective_rate)}</div><div class="hero-stat-label">Eff. Rate</div></div>`,
    `<div class="hero-stat"><div class="hero-stat-val">${usd(s.avg_total_tax).replace('.00','')}</div><div class="hero-stat-label">Avg Tax</div></div>`,
  ].join('');

  /* KPI grid */
  document.getElementById('kpiGrid').innerHTML = [
    kpiCard('Total Taxpayers',       num(s.total_taxpayers),         '',               'indigo'),
    kpiCard('Total Income Reported', usd(s.total_income_reported),   `Avg ${usd(s.avg_income)}`, ''),
    kpiCard('Federal Tax Collected', usd(s.total_federal_tax),       '',               'warm'),
    kpiCard('State Tax Collected',   usd(s.total_state_tax),         '',               'warm'),
    kpiCard('FICA Collected',        usd(s.total_fica),              '',               'warm'),
    kpiCard('Total Tax Collected',   usd(s.total_tax_collected),     `Avg ${usd(s.avg_total_tax)}`, 'rose'),
    kpiCard('Overall Effective Rate',pct(s.overall_effective_rate),  '',               'indigo'),
    kpiCard('Total Refunds Issued',  usd(s.total_refunds_issued),    '',               'green'),
    kpiCard('Total Tax Owed',        usd(s.total_tax_owed),          '',               'rose'),
  ].join('');

  /* Income by source – gradient bars */
  const srcData = full.income.by_income_source;
  mkChart('chartIncomeSource', {
    type: 'bar',
    data: {
      labels: Object.keys(srcData).map(cap),
      datasets: [{
        data: Object.values(srcData).map(d=>d.mean),
        backgroundColor: PALETTE,
        borderRadius: 7,
        borderSkipped: false,
      }],
    },
    options: {
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: c=>' '+usd(c.raw) } } },
      scales: SCALES,
    },
  });

  /* Filing status – donut */
  mkChart('chartFilingStatus', {
    type: 'doughnut',
    data: {
      labels: Object.keys(fs).map(cap),
      datasets: [{ data: Object.values(fs).map(d=>d.count), backgroundColor:[C.indigo,C.cyan,C.violet], borderWidth:0, hoverOffset:8 }],
    },
    options: { plugins:{ legend:LEGEND }, cutout:'68%' },
  });

  /* Tax breakdown – donut */
  mkChart('chartTaxBreakdown', {
    type: 'doughnut',
    data: {
      labels: ['Federal Tax','State Tax','FICA'],
      datasets: [{ data:[s.total_federal_tax,s.total_state_tax,s.total_fica], backgroundColor:[C.indigo,C.emerald,C.amber], borderWidth:0, hoverOffset:8 }],
    },
    options: { plugins:{ legend:LEGEND }, cutout:'68%' },
  });
}

/* ── INCOME ── */
async function renderIncome(full) {
  const inc = full.income;
  const bd  = inc.bracket_distribution;

  mkChart('chartIncomeBrackets', {
    type: 'bar',
    data: {
      labels: Object.keys(bd),
      datasets: [{
        label: 'Taxpayers',
        data: Object.values(bd).map(d=>d.count),
        backgroundColor: Object.keys(bd).map((_,i)=>PALETTE[i%PALETTE.length]),
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>`${c.raw} filers (${bd[Object.keys(bd)[c.dataIndex]].percent}%)` } } },
      scales: SCALES,
    },
  });

  document.getElementById('tblIncomeStats').innerHTML =
    `<thead><tr><th>Metric</th><th class="num">Value</th></tr></thead>
     <tbody>${statsRows(inc.overall_stats, usd)}</tbody>`;

  const rows = Object.entries(inc.by_income_source).map(([src,s])=>
    `<tr><td>${cap(src)}</td><td class="num">${usd(s.mean)}</td><td class="num">${usd(s.median)}</td><td class="num">${usd(s.min)}</td><td class="num">${usd(s.max)}</td><td class="num">${num(s.count)}</td></tr>`
  ).join('');
  document.getElementById('tblIncomeSource').innerHTML =
    `<thead><tr><th>Source</th><th class="num">Mean</th><th class="num">Median</th><th class="num">Min</th><th class="num">Max</th><th class="num">Count</th></tr></thead>
     <tbody>${rows}</tbody>`;
}

/* ── TAX RATES ── */
async function renderTaxRates(full) {
  const tr = full.tax_rates;
  const md = tr.marginal_distribution;
  const fs = tr.by_filing_status;

  mkChart('chartMarginal', {
    type: 'bar',
    data: {
      labels: Object.keys(md),
      datasets: [{
        label: 'Filers',
        data: Object.values(md),
        backgroundColor: [C.emerald,C.cyan,C.indigo,C.violet,C.amber,C.rose],
        borderRadius: 7,
        borderSkipped: false,
      }],
    },
    options: { plugins:{ legend:{display:false} }, scales:SCALES },
  });

  mkChart('chartEffectiveByStatus', {
    type: 'bar',
    data: {
      labels: Object.keys(fs).map(cap),
      datasets: [{
        label: 'Avg Effective Rate (%)',
        data: Object.values(fs).map(d=>d.avg_effective),
        backgroundColor: [C.indigo,C.cyan,C.violet],
        borderRadius: 7,
        borderSkipped: false,
      }],
    },
    options: { plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>pct(c.raw) } } }, scales:SCALES },
  });

  document.getElementById('tblEffectiveStats').innerHTML =
    `<thead><tr><th>Metric</th><th class="num">Value</th></tr></thead>
     <tbody>${statsRows(tr.effective_rate_stats, pct)}</tbody>`;

  const rows = Object.entries(fs).map(([st,d])=>
    `<tr><td>${cap(st)}</td><td class="num">${num(d.count)}</td><td class="num">${pct(d.avg_effective)}</td><td class="num">${usd(d.avg_federal_tax)}</td></tr>`
  ).join('');
  document.getElementById('tblFilingStats').innerHTML =
    `<thead><tr><th>Filing Status</th><th class="num">Count</th><th class="num">Avg Effective Rate</th><th class="num">Avg Federal Tax</th></tr></thead>
     <tbody>${rows}</tbody>`;
}

/* ── DEDUCTIONS ── */
async function renderDeductions(full) {
  const d = full.deductions;
  document.getElementById('kpiDeductions').innerHTML = [
    kpiCard('Itemizers',              num(d.itemizer_count),        `${d.itemizer_pct}% of filers`,            'indigo'),
    kpiCard('Standard Filers',        num(d.standard_filer_count),  `${(100-d.itemizer_pct).toFixed(1)}% of filers`, ''),
    kpiCard('Avg Itemized Total',     usd(d.avg_itemized_total),    '',                                        'warm'),
    kpiCard('Avg Standard Deduction', usd(d.avg_standard_deduction),'',                                        ''),
    kpiCard('Avg Tax Saved',          usd(d.avg_tax_savings_itemize),'itemized vs standard',                   'green'),
  ].join('');

  mkChart('chartItemizedVsStd', {
    type: 'doughnut',
    data: {
      labels: ['Itemized','Standard'],
      datasets: [{ data:[d.itemizer_count, d.standard_filer_count], backgroundColor:[C.indigo,C.violet], borderWidth:0, hoverOffset:8 }],
    },
    options: { plugins:{ legend:LEGEND }, cutout:'65%' },
  });

  const cats = d.category_breakdown;
  mkChart('chartItemizedCats', {
    type: 'bar',
    data: {
      labels: Object.keys(cats).map(cap),
      datasets: [{
        label: 'Avg Amount',
        data: Object.values(cats).map(c=>c.mean||0),
        backgroundColor: [C.indigo,C.cyan,C.emerald,C.amber],
        borderRadius: 7,
        borderSkipped: false,
      }],
    },
    options: { plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>' '+usd(c.raw) } } }, scales:SCALES },
  });
}

/* ── REFUNDS ── */
async function renderRefunds(full) {
  const r = full.refunds;
  document.getElementById('kpiRefunds').innerHTML = [
    kpiCard('Receiving Refund', num(r.refund_count),              `${r.over_withheld_pct}% of filers`,               'green'),
    kpiCard('Owe Taxes',        num(r.owed_count),               `${(100-r.over_withheld_pct).toFixed(1)}% of filers`,'rose'),
    kpiCard('Avg Refund',       usd(r.refund_stats.mean  || 0),  '',                                                  'green'),
    kpiCard('Avg Amount Owed',  usd(r.owed_stats.mean   || 0),   '',                                                  'rose'),
    kpiCard('Largest Refund',   usd(r.refund_stats.max  || 0),   '',                                                  'indigo'),
    kpiCard('Largest Owed',     usd(r.owed_stats.max    || 0),   '',                                                  'warm'),
  ].join('');

  const bd = r.bucket_distribution;
  mkChart('chartRefundBuckets', {
    type: 'bar',
    data: {
      labels: Object.keys(bd),
      datasets: [{
        label: 'Filers',
        data: Object.values(bd),
        backgroundColor: Object.keys(bd).map((_,i)=>PALETTE[i%PALETTE.length]),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: { indexAxis:'y', plugins:{ legend:{display:false} }, scales:SCALES },
  });

  mkChart('chartRefundOwed', {
    type: 'doughnut',
    data: {
      labels: ['Refund','Owe'],
      datasets: [{ data:[r.refund_count, r.owed_count], backgroundColor:[C.emerald, C.rose], borderWidth:0, hoverOffset:8 }],
    },
    options: { plugins:{ legend:LEGEND }, cutout:'65%' },
  });
}

/* ── STATE ── */
async function renderState(full) {
  const st     = full.by_state;
  const states = Object.keys(st);

  mkChart('chartStateTax', {
    type: 'bar',
    data: {
      labels: states,
      datasets: [
        { label:'Federal', data:states.map(s=>st[s].avg_federal_tax), backgroundColor:C.indigo, borderRadius:4, borderSkipped:false, stack:'tax' },
        { label:'State',   data:states.map(s=>st[s].avg_state_tax),   backgroundColor:C.cyan,   borderRadius:4, borderSkipped:false, stack:'tax' },
        { label:'FICA',    data:states.map(s=>st[s].avg_total_tax-st[s].avg_federal_tax-st[s].avg_state_tax), backgroundColor:C.violet, borderRadius:4, borderSkipped:false, stack:'tax' },
      ],
    },
    options: {
      plugins:{ legend:LEGEND, tooltip:{ callbacks:{ label:c=>`${c.dataset.label}: ${usd(c.raw)}` } } },
      scales:{ x:{...SCALES.x, stacked:true}, y:{...SCALES.y, stacked:true} },
    },
  });

  mkChart('chartStateRate', {
    type: 'radar',
    data: {
      labels: states,
      datasets: [{
        label: 'Effective Rate (%)',
        data: states.map(s=>st[s].avg_effective_rate),
        backgroundColor: 'rgba(129,140,248,0.12)',
        borderColor: C.indigo,
        pointBackgroundColor: C.indigo,
        pointBorderColor: 'transparent',
        pointRadius: 4,
      }],
    },
    options: {
      plugins:{ legend:LEGEND },
      scales:{ r:{ ticks:{ color:'#8892b0', backdropColor:'transparent' }, grid:{ color:'rgba(255,255,255,0.05)' }, angleLines:{ color:'rgba(255,255,255,0.05)' }, pointLabels:{ color:'#8892b0', font:{size:11} } } },
    },
  });

  const rows = Object.entries(st).map(([s,d])=>
    `<tr><td><strong>${s}</strong></td><td class="num">${num(d.count)}</td><td class="num">${usd(d.avg_income)}</td><td class="num">${usd(d.avg_federal_tax)}</td><td class="num">${usd(d.avg_state_tax)}</td><td class="num">${usd(d.avg_total_tax)}</td><td class="num">${pct(d.avg_effective_rate)}</td><td class="num">${usd(d.total_state_revenue)}</td></tr>`
  ).join('');
  document.getElementById('tblState').innerHTML =
    `<thead><tr><th>State</th><th class="num">Count</th><th class="num">Avg Income</th><th class="num">Avg Federal</th><th class="num">Avg State</th><th class="num">Avg Total</th><th class="num">Eff Rate</th><th class="num">State Revenue</th></tr></thead>
     <tbody>${rows}</tbody>`;
}

/* ── CAPITAL GAINS ── */
async function renderCapGains(full) {
  const cg = full.capital_gains;
  document.getElementById('kpiCapGains').innerHTML = [
    kpiCard('CG Filers',         num(cg.cg_filer_count),                 `${cg.cg_filer_pct}% of all filers`, 'indigo'),
    kpiCard('Avg Capital Gains', usd(cg.capital_gains_stats.mean  || 0), '',                                   'warm'),
    kpiCard('Max Capital Gains', usd(cg.capital_gains_stats.max   || 0), '',                                   'rose'),
    kpiCard('Avg Dividends',     usd(cg.dividend_income_stats.mean|| 0), '',                                   'green'),
    kpiCard('CG % of Income',    pct(cg.avg_cg_pct_of_income),           '',                                   'indigo'),
  ].join('');

  const cgs = cg.capital_gains_stats;
  const dvs = cg.dividend_income_stats;
  const labels = ['Mean','Median','Min','Max'];

  mkChart('chartCGStats', {
    type: 'bar',
    data: { labels, datasets: [{ label:'Capital Gains', data:[cgs.mean,cgs.median,cgs.min,cgs.max], backgroundColor:[C.amber,C.amber,C.violet,C.rose], borderRadius:7, borderSkipped:false }] },
    options: { plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>' '+usd(c.raw)}} }, scales:SCALES },
  });

  mkChart('chartDivStats', {
    type: 'bar',
    data: { labels, datasets: [{ label:'Dividends', data:[dvs.mean,dvs.median,dvs.min,dvs.max], backgroundColor:[C.emerald,C.emerald,C.violet,C.indigo], borderRadius:7, borderSkipped:false }] },
    options: { plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>' '+usd(c.raw)}} }, scales:SCALES },
  });
}

/* ── CREDITS ── */
async function renderCredits(full) {
  const cd = full.credits_dependents;
  document.getElementById('kpiCredits').innerHTML = [
    kpiCard('Avg Child Tax Credit',  usd(cd.avg_credit),             '', 'green'),
    kpiCard('Total Credits Claimed', usd(cd.total_credits_claimed),  '', 'indigo'),
    kpiCard('Max Credit',            usd(cd.credit_stats.max || 0),  '', 'warm'),
  ].join('');

  const dd = cd.dependent_distribution;
  mkChart('chartDependents', {
    type: 'doughnut',
    data: {
      labels: Object.keys(dd).map(k=>`${k} dependent${k==='1'?'':'s'}`),
      datasets: [{ data:Object.values(dd), backgroundColor:PALETTE, borderWidth:0, hoverOffset:8 }],
    },
    options: { plugins:{ legend:LEGEND }, cutout:'55%' },
  });

  const tbd = cd.avg_tax_by_dependents;
  mkChart('chartTaxByDeps', {
    type: 'line',
    data: {
      labels: Object.keys(tbd).map(k=>`${k} dep.`),
      datasets: [{
        label: 'Avg Total Tax',
        data: Object.values(tbd),
        borderColor: C.rose,
        backgroundColor: gradFill('chartTaxByDeps', 'fb7185', 0.22),
        tension: 0.45,
        fill: true,
        pointBackgroundColor: C.rose,
        pointBorderColor: 'transparent',
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    },
    options: { plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>' '+usd(c.raw)}} }, scales:SCALES },
  });
}

/* ── FICA ── */
async function renderFICA(full) {
  const f = full.fica;
  document.getElementById('kpiFica').innerHTML = [
    kpiCard('Total FICA Collected',    usd(f.total_fica_collected),            '', 'indigo'),
    kpiCard('Avg FICA % of Income',    pct(f.avg_fica_pct_of_income),          '', 'warm'),
    kpiCard('Avg Social Security',     usd(f.social_security_stats.mean || 0), '', 'green'),
    kpiCard('Avg Medicare',            usd(f.medicare_stats.mean        || 0), '', 'indigo'),
    kpiCard('Total SS Collected',      usd(f.social_security_stats.total|| 0), '', ''),
    kpiCard('Total Medicare',          usd(f.medicare_stats.total       || 0), '', ''),
  ].join('');

  const ss  = f.social_security_stats;
  const med = f.medicare_stats;
  mkChart('chartFICA', {
    type: 'bar',
    data: {
      labels: ['Mean','Median','Min','Max'],
      datasets: [
        { label:'Social Security', data:[ss.mean, ss.median, ss.min, ss.max],   backgroundColor:C.indigo, borderRadius:7, borderSkipped:false },
        { label:'Medicare',        data:[med.mean,med.median,med.min,med.max],  backgroundColor:C.cyan,   borderRadius:7, borderSkipped:false },
      ],
    },
    options: { plugins:{ legend:LEGEND, tooltip:{callbacks:{label:c=>' '+usd(c.raw)}} }, scales:SCALES },
  });
}

/* ── RECORDS ── */
let _recOffset=0, _recTotal=0;
const COLS = ['taxpayer_id','filing_status','state','total_income','taxable_income','federal_tax','state_tax','fica_total','total_tax_liability','effective_tax_rate','marginal_tax_rate','refund_or_owed','uses_itemized'];

async function loadRecords(offset=0) {
  const data    = await apiFetch(`/api/records?limit=${PAGE_SIZE}&offset=${offset}`);
  _recOffset    = offset;
  _recTotal     = data.total;
  const records = data.records;

  document.getElementById('recordsTotal').textContent = `${num(_recTotal)} total records`;
  document.getElementById('pageInfo').textContent = `${offset+1}–${Math.min(offset+PAGE_SIZE,_recTotal)}`;
  document.getElementById('btnPrev').disabled = offset===0;
  document.getElementById('btnNext').disabled = offset+PAGE_SIZE>=_recTotal;

  document.getElementById('tblRecordsHead').innerHTML = `<tr>${COLS.map(c=>`<th>${cap(c)}</th>`).join('')}</tr>`;
  document.getElementById('tblRecordsBody').innerHTML = records.map(r=>{
    const cells = COLS.map(col=>{
      let val = r[col];
      if (['total_income','taxable_income','federal_tax','state_tax','fica_total','total_tax_liability','refund_or_owed'].includes(col)) val = usd(val);
      else if (['effective_tax_rate','marginal_tax_rate'].includes(col)) val = pct(val);
      const cls = col==='refund_or_owed' ? (Number(r[col])>=0?'c-green':'c-rose') : '';
      return `<td class="${cls}">${val}</td>`;
    });
    return `<tr>${cells.join('')}</tr>`;
  }).join('');
}

/* ── Navigation ── */
const TITLES = { summary:'Dashboard', income:'Income Distribution', taxrates:'Tax Rates', deductions:'Deductions', refunds:'Refunds & Owed', state:'By State', capgains:'Capital Gains', credits:'Credits & Dependents', fica:'FICA / Payroll', records:'Raw Records' };

function navigate(section) {
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active', l.dataset.section===section));
  document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active', s.id===`section-${section}`));
  const title = document.getElementById('pageTitle');
  if (title) title.textContent = TITLES[section] || section;
}

/* ── Boot ── */
let _full = null;

async function boot() {
  setLoader(15, 'Connecting to API…');
  try {
    setLoader(35, 'Fetching analytics…');
    _full = await apiFetch('/api/full');
    setLoader(75, 'Rendering dashboard…');
    await renderSummary(_full);
    navigate('summary');
    setLoader(100, 'Done');
    setStatus(true, `${num(_full.summary.total_taxpayers)} records loaded`);
    setTimeout(hideLoader, 500);
    toast('Dashboard ready', 'ok');

    /* Lazy-render on nav click */
    document.querySelectorAll('.nav-link').forEach(link=>{
      link.addEventListener('click', async e=>{
        e.preventDefault();
        const sec = link.dataset.section;
        navigate(sec);
        if      (sec==='income')      await renderIncome(_full);
        else if (sec==='taxrates')    await renderTaxRates(_full);
        else if (sec==='deductions')  await renderDeductions(_full);
        else if (sec==='refunds')     await renderRefunds(_full);
        else if (sec==='state')       await renderState(_full);
        else if (sec==='capgains')    await renderCapGains(_full);
        else if (sec==='credits')     await renderCredits(_full);
        else if (sec==='fica')        await renderFICA(_full);
        else if (sec==='records')     await loadRecords(0);
        else if (sec==='summary')     await renderSummary(_full);
      });
    });
  } catch(err) {
    setLoader(100,'Error');
    setStatus(false,'Error loading data');
    toast('Failed to load: '+err.message, 'error');
    setTimeout(hideLoader, 600);
    console.error(err);
  }
}

/* ── Regenerate ── */
document.getElementById('btnRegen').addEventListener('click', async()=>{
  setStatus(false,'Regenerating…');
  toast('Regenerating dataset…', 'ok');
  try {
    const seed = Math.floor(Math.random()*99999);
    await fetch(`/api/regenerate?records=500&seed=${seed}`, {method:'POST'});
    _full = await apiFetch('/api/full');
    setStatus(true,`${num(_full.summary.total_taxpayers)} records loaded`);
    await renderSummary(_full);
    navigate('summary');
    toast('New dataset generated!', 'ok');
  } catch(err) {
    toast('Regenerate failed: '+err.message, 'error');
    setStatus(false,'Error');
  }
});

/* ── CSV Upload ── */
document.getElementById('csvUpload').addEventListener('change', async e=>{
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  toast('Uploading…', 'ok');
  try {
    const res  = await fetch('/api/upload',{method:'POST',body:form});
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail||'Upload failed');
    _full = await apiFetch('/api/full');
    setStatus(true,`${num(_full.summary.total_taxpayers)} records loaded`);
    await renderSummary(_full);
    navigate('summary');
    toast(`Uploaded ${num(json.records_loaded)} records`, 'ok');
  } catch(err) {
    toast('Upload failed: '+err.message, 'error');
  }
  e.target.value='';
});

/* ── Pagination ── */
document.getElementById('btnPrev').addEventListener('click',()=>loadRecords(_recOffset-PAGE_SIZE));
document.getElementById('btnNext').addEventListener('click',()=>loadRecords(_recOffset+PAGE_SIZE));

/* ── Mobile sidebar toggle ── */
const menuToggle = document.getElementById('menuToggle');
const sidebar    = document.getElementById('sidebar');
if (menuToggle && sidebar) {
  menuToggle.addEventListener('click',()=>sidebar.classList.toggle('open'));
  document.addEventListener('click',e=>{ if(!sidebar.contains(e.target)&&!menuToggle.contains(e.target)) sidebar.classList.remove('open'); });
}

/* Start */
boot();
