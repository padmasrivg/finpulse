/**
 * FinPulse — Frontend JavaScript
 * Handles: API calls, form logic, charts (Chart.js), chat, dashboard
 */

/* ═══════════════════════════════════════════════
   CONSTANTS & STATE
═══════════════════════════════════════════════ */

const API_BASE = "http://localhost:5000/api";

const CATEGORIES = {
  edtech: [
    { id: "marketing", label: "Marketing", icon: "📣" },
    { id: "cloud",     label: "Cloud",     icon: "☁️" },
    { id: "instructor",label: "Instructor", icon: "👨‍🏫" },
    { id: "content",   label: "Content",   icon: "🎬" },
  ],
  professional: [
    { id: "travel",   label: "Travel",   icon: "✈️" },
    { id: "salary",   label: "Salary",   icon: "💼" },
    { id: "software", label: "Software", icon: "💻" },
    { id: "office",   label: "Office",   icon: "🏢" },
  ],
};

const CAT_COLORS = {
  marketing:  "#00e5ff",
  cloud:      "#00ff9d",
  instructor: "#ffb700",
  content:    "#c084fc",
  travel:     "#00e5ff",
  salary:     "#ff4757",
  software:   "#00ff9d",
  office:     "#ffb700",
};

let currentCompanyType = "edtech";
let charts = {};

/* ═══════════════════════════════════════════════
   API HELPERS
═══════════════════════════════════════════════ */

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    console.error(`API Error [${path}]:`, e.message);
    throw e;
  }
}

/* ═══════════════════════════════════════════════
   COMPANY TYPE TOGGLE
═══════════════════════════════════════════════ */

function initCompanyToggle() {
  const btns = document.querySelectorAll(".toggle-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCompanyType = btn.dataset.type;

      const label = document.getElementById("dashCompanyLabel");
      if (label) {
        label.textContent =
          currentCompanyType === "edtech"
            ? "EdTech Company Analytics"
            : "Professional Services Analytics";
      }

      // Re-render category pills if on index page
      if (typeof renderCategoryPills === "function") renderCategoryPills();

      // Refresh dashboard if on dashboard page
      if (document.getElementById("kpiTotal")) loadDashboard();
    });
  });
}

/* ═══════════════════════════════════════════════
   INDEX PAGE — EXPENSE FORM
═══════════════════════════════════════════════ */

function renderCategoryPills() {
  const container = document.getElementById("categoryPills");
  if (!container) return;

  container.innerHTML = "";
  const cats = CATEGORIES[currentCompanyType] || [];
  document.getElementById("category").value = "";

  cats.forEach((cat) => {
    const pill = document.createElement("button");
    pill.className = "cat-pill";
    pill.innerHTML = `${cat.icon} ${cat.label}`;
    pill.dataset.id = cat.id;
    pill.addEventListener("click", () => selectCategory(cat.id));
    container.appendChild(pill);
  });
}

function selectCategory(id) {
  document.querySelectorAll(".cat-pill").forEach((p) => {
    p.classList.toggle("selected", p.dataset.id === id);
  });
  document.getElementById("category").value = id;
}

function showToast(msg, type = "success") {
  const toast = document.getElementById("formToast");
  if (!toast) return;
  toast.textContent = (type === "success" ? "✓ " : "✗ ") + msg;
  toast.className = `fp-toast ${type}`;
  setTimeout(() => { toast.className = "fp-toast"; }, 4000);
}

async function handleAddExpense() {
  const category = document.getElementById("category").value;
  const amount = document.getElementById("amount").value;
  const description = document.getElementById("description").value.trim();
  const vendor = document.getElementById("vendor").value.trim();
  const date = document.getElementById("date").value;

  if (!category) return showToast("Please select a category", "error");
  if (!amount || parseFloat(amount) <= 0) return showToast("Enter a valid amount", "error");
  if (!description) return showToast("Description is required", "error");
  if (!date) return showToast("Please select a date", "error");

  const btn = document.getElementById("btnAddExpense");
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';

  try {
    await apiFetch("/expenses", {
      method: "POST",
      body: JSON.stringify({
        company_type: currentCompanyType,
        category, amount: parseFloat(amount),
        description, vendor, date,
      }),
    });

    showToast("Expense added successfully!");
    document.getElementById("amount").value = "";
    document.getElementById("description").value = "";
    document.getElementById("vendor").value = "";
    document.querySelectorAll(".cat-pill").forEach((p) => p.classList.remove("selected"));
    document.getElementById("category").value = "";

    await loadRecentTransactions();
    await loadHeroStats();
    await loadMiniCategoryBars();
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>Add Expense';
  }
}

async function loadRecentTransactions() {
  const container = document.getElementById("transactionsList");
  if (!container) return;

  try {
    const data = await apiFetch(`/expenses?company_type=${currentCompanyType}&limit=10`);
    const expenses = data.expenses || [];

    if (!expenses.length) {
      container.innerHTML = `<div class="tx-empty">
        <i class="bi bi-inbox text-muted" style="font-size:2.5rem;"></i>
        <p class="mt-3 text-muted">No transactions yet.<br/>Add your first expense above.</p>
      </div>`;
      return;
    }

    container.innerHTML = expenses.map((e) => {
      const cats = CATEGORIES[currentCompanyType] || [];
      const cat = cats.find((c) => c.id === e.category) || { icon: "💰", label: e.category };
      const dateStr = new Date(e.date).toLocaleDateString("en-IN", {
        day: "numeric", month: "short",
      });
      return `<div class="tx-item">
  <div class="tx-icon">${cat.icon}</div>
  
  <div class="tx-info">
    <div class="tx-info__desc">${e.description}</div>
    <div class="tx-info__meta">${cat.label} · ${dateStr}</div>
  </div>
  
  <div class="tx-amount">₹${Number(e.amount).toLocaleString("en-IN")}</div>

  <button class="btn-delete" onclick="deleteExpense('${e._id}', this)">
    🗑️
  </button>
</div>`;
    }).join("");
  } catch (e) {
    container.innerHTML = `<div class="tx-empty text-muted small">Failed to load: ${e.message}</div>`;
  }
}

async function loadHeroStats() {
  try {
    const data = await apiFetch(`/dashboard/summary?company_type=${currentCompanyType}`);
    const totalEl  = document.getElementById("heroTotal");
    const countEl  = document.getElementById("heroCount");
    const anomalyEl = document.getElementById("heroAnomaly");

    if (totalEl)  totalEl.textContent  = `₹${Number(data.total_expenses).toLocaleString("en-IN")}`;
    if (countEl)  countEl.textContent  = data.total_transactions;
    if (anomalyEl) {
      const anomalyData = await apiFetch(`/dashboard/anomalies?company_type=${currentCompanyType}`);
      anomalyEl.textContent = anomalyData.count || 0;
    }
  } catch (e) { /* silent */ }
}

async function loadMiniCategoryBars() {
  const container = document.getElementById("miniCategoryBars");
  if (!container) return;

  try {
    const data = await apiFetch(`/dashboard/summary?company_type=${currentCompanyType}`);
    const cats = data.categories || [];

    if (!cats.length) {
      container.innerHTML = `<p class="text-muted small">Add expenses to see distribution</p>`;
      return;
    }

    container.innerHTML = cats.map((c) => {
      const color = CAT_COLORS[c.category] || "#00e5ff";
      const cats2 = CATEGORIES[currentCompanyType] || [];
      const catMeta = cats2.find((x) => x.id === c.category) || { icon: "💰" };
      return `<div class="mini-bar-item">
        <div class="mini-bar-header">
          <span class="mini-bar-header__cat">${catMeta.icon} ${c.category.charAt(0).toUpperCase() + c.category.slice(1)}</span>
          <span class="mini-bar-header__pct">₹${Number(c.total).toLocaleString("en-IN")} · ${c.percentage}%</span>
        </div>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${c.percentage}%; background:${color};"></div>
        </div>
      </div>`;
    }).join("");
  } catch (e) { /* silent */ }
}

function openSampleModal() {
  document.getElementById("sampleModal").classList.add("open");
  document.getElementById("modalBackdrop").classList.add("open");
}

function closeSampleModal() {
  document.getElementById("sampleModal").classList.remove("open");
  document.getElementById("modalBackdrop").classList.remove("open");
}

async function loadSampleData() {
  const statusEl    = document.getElementById("importStatus");
  const progressEl  = document.getElementById("importProgress");
  const fillEl      = document.getElementById("progressFill");
  const btn         = document.getElementById("btnConfirmLoad");

  progressEl.style.display = "block";
  btn.disabled = true;

  try {
    statusEl.textContent = "Fetching sample data...";
    fillEl.style.width = "20%";

    // Parse embedded CSV data
    const csvData = getSampleCSVData();
    statusEl.textContent = `Parsed ${csvData.length} records...`;
    fillEl.style.width = "50%";

    await apiFetch("/expenses/bulk", {
      method: "POST",
      body: JSON.stringify({ expenses: csvData }),
    });

    fillEl.style.width = "100%";
    statusEl.textContent = `✓ Imported ${csvData.length} expenses!`;

    setTimeout(() => {
      closeSampleModal();
      loadRecentTransactions();
      loadHeroStats();
      loadMiniCategoryBars();
    }, 1200);
  } catch (e) {
    statusEl.textContent = `✗ Import failed: ${e.message}`;
    fillEl.style.background = "var(--accent-red)";
    btn.disabled = false;
  }
}

function getSampleCSVData() {
  return [
    { company_type:"edtech",       category:"marketing",  amount:48000,  description:"Google Ads — Q1 Campaign",        vendor:"Google",              date:"2024-01-05" },
    { company_type:"edtech",       category:"cloud",      amount:22000,  description:"AWS EC2 Instances — Jan",          vendor:"Amazon Web Services", date:"2024-01-08" },
    { company_type:"edtech",       category:"instructor", amount:35000,  description:"Python Bootcamp Instructor Fee",   vendor:"Rahul Sharma",        date:"2024-01-10" },
    { company_type:"edtech",       category:"content",    amount:18000,  description:"Video Production — Module 3",      vendor:"StudioX Media",       date:"2024-01-12" },
    { company_type:"edtech",       category:"marketing",  amount:52000,  description:"Meta Ads — Lead Gen Campaign",     vendor:"Meta",                date:"2024-01-18" },
    { company_type:"edtech",       category:"cloud",      amount:19500,  description:"AWS S3 & CloudFront — Jan",        vendor:"Amazon Web Services", date:"2024-01-20" },
    { company_type:"edtech",       category:"instructor", amount:28000,  description:"Data Science Instructor Fee",      vendor:"Priya Nair",          date:"2024-01-22" },
    { company_type:"edtech",       category:"content",    amount:14500,  description:"Course Thumbnail Design",          vendor:"DesignHub",           date:"2024-01-25" },
    { company_type:"edtech",       category:"marketing",  amount:61000,  description:"LinkedIn Ads — B2B Campaign",      vendor:"LinkedIn",            date:"2024-02-03" },
    { company_type:"edtech",       category:"cloud",      amount:27000,  description:"AWS EC2 Scale-Up — Feb",           vendor:"Amazon Web Services", date:"2024-02-06" },
    { company_type:"edtech",       category:"instructor", amount:42000,  description:"AI/ML Course Instructor",          vendor:"Dr. Anand Kumar",     date:"2024-02-10" },
    { company_type:"edtech",       category:"content",    amount:21000,  description:"Animated Explainer Videos",        vendor:"Motion Arts",         date:"2024-02-14" },
    { company_type:"edtech",       category:"marketing",  amount:38000,  description:"SEO & Content Marketing",          vendor:"RankFirst Agency",    date:"2024-02-18" },
    { company_type:"edtech",       category:"cloud",      amount:31000,  description:"Database & Redis Cache — Feb",     vendor:"Amazon Web Services", date:"2024-02-20" },
    { company_type:"edtech",       category:"instructor", amount:33000,  description:"Web Dev Instructor Fee",           vendor:"Sneha Patel",         date:"2024-02-24" },
    { company_type:"edtech",       category:"content",    amount:16000,  description:"Podcast Production — 4 Episodes",  vendor:"SoundStudio",         date:"2024-02-26" },
    { company_type:"edtech",       category:"marketing",  amount:72000,  description:"YouTube Ads — Product Launch",     vendor:"Google",              date:"2024-03-02" },
    { company_type:"edtech",       category:"cloud",      amount:145000, description:"Sudden Cloud Outage Recovery",     vendor:"Amazon Web Services", date:"2024-03-05" },
    { company_type:"edtech",       category:"instructor", amount:55000,  description:"Full-Stack Dev — 2 Instructors",   vendor:"Dev Academy",         date:"2024-03-08" },
    { company_type:"edtech",       category:"content",    amount:25000,  description:"Live Workshop Recording",          vendor:"StreamPro",           date:"2024-03-12" },
    { company_type:"edtech",       category:"marketing",  amount:44000,  description:"Influencer Marketing",             vendor:"TechInfluencer Co",   date:"2024-03-15" },
    { company_type:"edtech",       category:"cloud",      amount:29000,  description:"CloudFront CDN — Mar",             vendor:"Amazon Web Services", date:"2024-03-18" },
    { company_type:"edtech",       category:"instructor", amount:38000,  description:"DevOps Instructor Fee",            vendor:"Kumar Systems",       date:"2024-03-22" },
    { company_type:"edtech",       category:"content",    amount:19000,  description:"E-book Production",               vendor:"WordCraft Studio",    date:"2024-03-25" },
    { company_type:"professional", category:"travel",     amount:35000,  description:"Client Visit — Mumbai",            vendor:"IndiGo Airlines",     date:"2024-01-07" },
    { company_type:"professional", category:"salary",     amount:320000, description:"January Salaries — 8 Employees",  vendor:"Payroll",             date:"2024-01-31" },
    { company_type:"professional", category:"software",   amount:12000,  description:"Salesforce CRM — Monthly",        vendor:"Salesforce",          date:"2024-01-05" },
    { company_type:"professional", category:"office",     amount:18000,  description:"Office Rent — Jan",               vendor:"Urban Property",      date:"2024-01-01" },
    { company_type:"professional", category:"travel",     amount:28000,  description:"Conference — Delhi",              vendor:"Air India",           date:"2024-01-15" },
    { company_type:"professional", category:"software",   amount:8500,   description:"Slack & Zoom Licences",           vendor:"Atlassian",           date:"2024-01-10" },
    { company_type:"professional", category:"office",     amount:5500,   description:"Office Supplies & Pantry",        vendor:"Staples",             date:"2024-01-20" },
    { company_type:"professional", category:"travel",     amount:92000,  description:"International Client Trip — Singapore", vendor:"Singapore Airlines", date:"2024-02-05" },
    { company_type:"professional", category:"salary",     amount:335000, description:"February Salaries",              vendor:"Payroll",             date:"2024-02-28" },
    { company_type:"professional", category:"software",   amount:14000,  description:"Jira & Confluence — Feb",         vendor:"Atlassian",           date:"2024-02-08" },
    { company_type:"professional", category:"office",     amount:18000,  description:"Office Rent — Feb",              vendor:"Urban Property",      date:"2024-02-01" },
    { company_type:"professional", category:"travel",     amount:41000,  description:"Client Workshop — Bangalore",     vendor:"IndiGo Airlines",     date:"2024-02-12" },
    { company_type:"professional", category:"software",   amount:9000,   description:"Adobe Creative Suite",           vendor:"Adobe",               date:"2024-02-15" },
    { company_type:"professional", category:"office",     amount:7200,   description:"Internet & Utilities — Feb",     vendor:"BSNL",                date:"2024-02-22" },
    { company_type:"professional", category:"travel",     amount:38000,  description:"Project Kick-off — Chennai",     vendor:"IndiGo Airlines",     date:"2024-03-04" },
    { company_type:"professional", category:"salary",     amount:341000, description:"March Salaries",                 vendor:"Payroll",             date:"2024-03-31" },
    { company_type:"professional", category:"software",   amount:11500,  description:"GitHub Enterprise",              vendor:"GitHub",              date:"2024-03-06" },
    { company_type:"professional", category:"office",     amount:18000,  description:"Office Rent — Mar",              vendor:"Urban Property",      date:"2024-03-01" },
    { company_type:"professional", category:"travel",     amount:65000,  description:"Client Presentation — Hyderabad", vendor:"Taj Hotels",         date:"2024-03-10" },
    { company_type:"professional", category:"software",   amount:16000,  description:"Power BI & Analytics Suite",     vendor:"Microsoft",           date:"2024-03-14" },
    { company_type:"professional", category:"office",     amount:9500,   description:"Furniture & Equipment",          vendor:"IKEA Business",       date:"2024-03-20" },
  ];
}

/* ═══════════════════════════════════════════════
   DASHBOARD — KPIs
═══════════════════════════════════════════════ */

async function loadDashboard() {
  await Promise.all([
    loadKPIs(),
    loadCharts(),
    loadTransactionTable(),
  ]);
}

async function loadKPIs() {
  try {
    const data = await apiFetch(`/dashboard/summary?company_type=${currentCompanyType}`);

    setText("kpiTotal",    `₹${Number(data.total_expenses).toLocaleString("en-IN")}`);
    setText("kpiCount",    data.total_transactions);
    setText("kpiAvg",      `₹${Number(data.avg_transaction).toLocaleString("en-IN")}`);
    setText("kpiTotalSub", `Top: ${data.highest_category || "—"}`);
    setText("kpiCountSub", `Across ${(data.categories || []).length} categories`);
    setText("kpiAvgSub",   "Per transaction average");
  } catch (e) {
    console.error("KPI load failed:", e.message);
  }

  try {
    const anomData = await apiFetch(`/dashboard/anomalies?company_type=${currentCompanyType}`);
    const count = anomData.count || 0;
    setText("kpiAnomalies", count);
    setText("kpiAnomalySub", count > 0 ? `${count} item(s) need review` : "No anomalies found");
  } catch (e) { /* silent */ }
}

/* ═══════════════════════════════════════════════
   DASHBOARD — CHARTS
═══════════════════════════════════════════════ */

const CHART_DEFAULTS = {
  color: {
    text:   "#7d8fa3",
    grid:   "rgba(0,229,255,0.06)",
    border: "rgba(0,229,255,0.12)",
  },
};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

async function loadCharts() {
  try {
    const data = await apiFetch(`/dashboard/summary?company_type=${currentCompanyType}`);
    const monthly = data.monthly_trends || [];
    const cats    = data.categories    || [];

    renderTrendChart(monthly);
    renderDonutChart(cats);
    renderBarChart(cats);
  } catch (e) {
    console.error("Charts load failed:", e.message);
  }
}

function renderTrendChart(monthly) {
  destroyChart("trend");
  const canvas = document.getElementById("chartTrend");
  if (!canvas || !monthly.length) return;

  const labels = monthly.map((m) => m.month);
  const values = monthly.map((m) => m.total);

  charts.trend = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Total Expenses",
        data: values,
        borderColor: "#00e5ff",
        backgroundColor: "rgba(0,229,255,0.07)",
        borderWidth: 2,
        pointBackgroundColor: "#00e5ff",
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          borderColor: "rgba(0,229,255,0.3)",
          borderWidth: 1,
          titleColor: "#7d8fa3",
          bodyColor: "#e8f0fe",
          callbacks: {
            label: (ctx) => `  ₹${Number(ctx.raw).toLocaleString("en-IN")}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: CHART_DEFAULTS.color.text, font: { family: "'Space Mono'" } },
          grid: { color: CHART_DEFAULTS.color.grid },
          border: { color: CHART_DEFAULTS.color.border },
        },
        y: {
          ticks: {
            color: CHART_DEFAULTS.color.text,
            font: { family: "'Space Mono'" },
            callback: (v) => `₹${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: CHART_DEFAULTS.color.grid },
          border: { color: CHART_DEFAULTS.color.border },
        },
      },
    },
  });
}

function renderDonutChart(cats) {
  destroyChart("donut");
  const canvas = document.getElementById("chartDonut");
  const legend = document.getElementById("donutLegend");
  if (!canvas || !cats.length) return;

  const labels = cats.map((c) => c.category);
  const values = cats.map((c) => c.total);
  const colors = cats.map((c) => CAT_COLORS[c.category] || "#00e5ff");

  charts.donut = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map((c) => c + "cc"),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          borderColor: "rgba(0,229,255,0.3)",
          borderWidth: 1,
          titleColor: "#7d8fa3",
          bodyColor: "#e8f0fe",
          callbacks: {
            label: (ctx) => ` ₹${Number(ctx.raw).toLocaleString("en-IN")} (${cats[ctx.dataIndex]?.percentage}%)`,
          },
        },
      },
    },
  });

  // Custom legend
  if (legend) {
    legend.innerHTML = cats.map((c, i) => {
      const cats2 = CATEGORIES[currentCompanyType] || [];
      const catMeta = cats2.find((x) => x.id === c.category) || { icon: "💰" };
      return `<div class="donut-legend-item">
        <div class="donut-legend-dot" style="background:${colors[i]};"></div>
        <span class="donut-legend-label">${catMeta.icon} ${c.category}</span>
        <span class="donut-legend-val">${c.percentage}%</span>
      </div>`;
    }).join("");
  }
}

function renderBarChart(cats) {
  destroyChart("bar");
  const canvas = document.getElementById("chartBar");
  if (!canvas || !cats.length) return;

  const labels = cats.map((c) => c.category.charAt(0).toUpperCase() + c.category.slice(1));
  const values = cats.map((c) => c.total);
  const colors = cats.map((c) => CAT_COLORS[c.category] || "#00e5ff");

  charts.bar = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Total",
        data: values,
        backgroundColor: colors.map((c) => c + "33"),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          borderColor: "rgba(0,229,255,0.3)",
          borderWidth: 1,
          titleColor: "#7d8fa3",
          bodyColor: "#e8f0fe",
          callbacks: {
            label: (ctx) => `  ₹${Number(ctx.raw).toLocaleString("en-IN")}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: CHART_DEFAULTS.color.text, font: { family: "'Space Mono'" } },
          grid: { color: CHART_DEFAULTS.color.grid },
          border: { color: CHART_DEFAULTS.color.border },
        },
        y: {
          ticks: {
            color: CHART_DEFAULTS.color.text,
            font: { family: "'Space Mono'" },
            callback: (v) => `₹${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: CHART_DEFAULTS.color.grid },
          border: { color: CHART_DEFAULTS.color.border },
        },
      },
    },
  });
}

/* ═══════════════════════════════════════════════
   DASHBOARD — ANOMALIES
═══════════════════════════════════════════════ */

async function loadAnomalies() {
  const container = document.getElementById("anomalyList");
  if (!container) return;

  container.innerHTML = `<div class="anomaly-empty">
    <div class="blink-dot mx-auto mb-2"></div>
    <p class="text-muted small">Running Isolation Forest scan...</p>
  </div>`;

  try {
    const data = await apiFetch(`/dashboard/anomalies?company_type=${currentCompanyType}`);
    const anomalies = data.anomalies || [];

    if (!anomalies.length) {
      container.innerHTML = `<div class="anomaly-empty">
        <i class="bi bi-shield-check" style="font-size:2rem;color:var(--accent-green);"></i>
        <p class="mt-2 text-muted small">✅ No anomalies detected — transactions look normal</p>
      </div>`;
      return;
    }

    container.innerHTML = anomalies.map((a) => {
      const sev = a.severity > 70 ? "high" : a.severity > 40 ? "medium" : "low";
      return `<div class="anomaly-item">
        <div class="anomaly-item__header">
          <span class="anomaly-item__amt">₹${Number(a.amount).toLocaleString("en-IN")}</span>
          <span class="anomaly-badge">Severity ${a.severity}%</span>
        </div>
        <div class="anomaly-item__desc">
          <span class="severity-dot severity-${sev}"></span>
          ${a.description}
        </div>
        <div class="anomaly-item__reason">${a.reason}</div>
      </div>`;
    }).join("");

    // Update KPI
    setText("kpiAnomalies", anomalies.length);
    setText("kpiAnomalySub", `${anomalies.length} item(s) need review`);
  } catch (e) {
    container.innerHTML = `<div class="anomaly-empty text-muted small">Scan failed: ${e.message}</div>`;
  }
}

/* ═══════════════════════════════════════════════
   DASHBOARD — AI INSIGHTS
═══════════════════════════════════════════════ */

async function loadInsights() {
  const container = document.getElementById("insightsList");
  if (!container) return;

  container.innerHTML = `<div class="insight-empty">
    <div class="blink-dot mx-auto mb-2"></div>
    <p class="text-muted small">Generating AI insights...</p>
  </div>`;

  try {
    const data = await apiFetch(`/insights?company_type=${currentCompanyType}`);
    const insights = data.insights || [];

    if (!insights.length) {
      container.innerHTML = `<div class="insight-empty">
        <i class="bi bi-database-x" style="font-size:2rem;color:var(--text-muted);"></i>
        <p class="mt-2 text-muted small">Not enough data to generate insights yet</p>
      </div>`;
      return;
    }

    container.innerHTML = insights.map((ins) => `
      <div class="insight-item">
        <div class="insight-item__title">
          <span class="severity-dot severity-${ins.severity}"></span>${ins.title}
        </div>
        <div class="insight-item__detail">${ins.detail}</div>
        <div class="insight-item__rec">💡 ${ins.recommendation}</div>
      </div>`).join("");
  } catch (e) {
    container.innerHTML = `<div class="insight-empty text-muted small">Failed: ${e.message}</div>`;
  }
}

/* ═══════════════════════════════════════════════
   DASHBOARD — TRANSACTION TABLE
═══════════════════════════════════════════════ */

async function loadTransactionTable() {
  const tbody = document.getElementById("txTableBody");
  if (!tbody) return;

  try {
    const data = await apiFetch(`/expenses?company_type=${currentCompanyType}&limit=20`);
    const expenses = data.expenses || [];

    if (!expenses.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No transactions found.</td></tr>`;
      return;
    }

    const cats2 = CATEGORIES[currentCompanyType] || [];

    tbody.innerHTML = expenses.map((e) => {
      const catMeta = cats2.find((c) => c.id === e.category) || { icon: "💰", label: e.category };
      const dateStr = new Date(e.date).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });
      return `<tr>
        <td><span class="text-muted" style="font-family:var(--font-mono);font-size:0.78rem;">${dateStr}</span></td>
        <td>${e.description}</td>
        <td><span class="cat-badge">${catMeta.icon} ${catMeta.label}</span></td>
        <td><span class="text-muted" style="font-size:0.82rem;">${e.vendor || "—"}</span></td>
        <td class="text-end"><span class="amount-cell">₹${Number(e.amount).toLocaleString("en-IN")}</span></td>
        <td class="text-center">
          <button class="btn-delete" onclick="deleteExpense('${e._id}', this)">
            <i class="bi bi-trash3"></i>
          </button>
        </td>
      </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Error: ${e.message}</td></tr>`;
  }
}

async function deleteExpense(id, btn) {
  console.log("Deleting ID:", id); 
  if (!confirm("Delete this expense?")) return;

  btn.disabled = true;

  try {
    await apiFetch(`/expenses/${id}`, { method: "DELETE" });

    // Fade effect
    btn.closest("tr").style.opacity = "0";

    setTimeout(async () => {
      btn.closest("tr").remove();

      // 🔥 Refresh everything
      await loadKPIs();
      await loadCharts();
      await loadHeroStats();
      await loadMiniCategoryBars();

    }, 300);

  } catch (e) {
    alert("Delete failed: " + e.message);
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════
   CHAT ASSISTANT
═══════════════════════════════════════════════ */

async function sendChatMessage(message) {
  if (!message.trim()) return;

  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  // Append user message
  chatMessages.innerHTML += `
    <div class="chat-msg chat-msg--user">
      <div class="chat-msg__avatar">YOU</div>
      <div class="chat-msg__bubble">${escapeHtml(message)}</div>
    </div>`;

  // Typing indicator
  const typingId = "typing-" + Date.now();
  chatMessages.innerHTML += `
    <div class="chat-msg chat-typing" id="${typingId}">
      <div class="chat-msg__avatar">FP</div>
      <div class="chat-msg__bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>`;

  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Clear input
  const inputEl = document.getElementById("chatInput");
  if (inputEl) inputEl.value = "";

  try {
    const data = await apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({ message, company_type: currentCompanyType }),
    });

    // Remove typing indicator
    document.getElementById(typingId)?.remove();

    // Format response (bold, em via markdown-lite)
    const formattedResponse = formatChatResponse(data.response || "No response.");

    chatMessages.innerHTML += `
      <div class="chat-msg">
        <div class="chat-msg__avatar">FP</div>
        <div class="chat-msg__bubble">${formattedResponse}</div>
      </div>`;

    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (e) {
    document.getElementById(typingId)?.remove();
    chatMessages.innerHTML += `
      <div class="chat-msg">
        <div class="chat-msg__avatar">FP</div>
        <div class="chat-msg__bubble" style="color:var(--accent-red);">
          ⚠️ Could not reach the API. Make sure Flask is running on port 5000.
        </div>
      </div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function formatChatResponse(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sendSuggestion(text) {
  const input = document.getElementById("chatInput");
  if (input) input.value = text;
  sendChatMessage(text);
}

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  // Set today's date as default for form
  const dateInput = document.getElementById("date");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  // Init company toggle (both pages)
  initCompanyToggle();

  // ── Index page init ──
  if (document.getElementById("categoryPills")) {
    renderCategoryPills();
    loadRecentTransactions();
    loadHeroStats();
    loadMiniCategoryBars();

    document.getElementById("btnAddExpense")?.addEventListener("click", handleAddExpense);

    document.getElementById("btnLoadSample")?.addEventListener("click", openSampleModal);
    document.getElementById("btnConfirmLoad")?.addEventListener("click", loadSampleData);
    document.getElementById("btnCancelLoad")?.addEventListener("click", closeSampleModal);
    document.getElementById("modalClose")?.addEventListener("click", closeSampleModal);
    document.getElementById("modalBackdrop")?.addEventListener("click", closeSampleModal);

    // Allow Enter to submit
    document.querySelectorAll(".fp-input").forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleAddExpense();
      });
    });
  }

  // ── Dashboard page init ──
  if (document.getElementById("kpiTotal")) {
    loadDashboard();

    document.getElementById("btnRefresh")?.addEventListener("click", loadDashboard);
    document.getElementById("btnRunAnomaly")?.addEventListener("click", loadAnomalies);
    document.getElementById("btnLoadInsights")?.addEventListener("click", loadInsights);

    // Chat
    const sendBtn = document.getElementById("btnChatSend");
    const chatInput = document.getElementById("chatInput");

    sendBtn?.addEventListener("click", () => {
      sendChatMessage(chatInput?.value || "");
    });
    chatInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChatMessage(chatInput.value);
    });
  }
});