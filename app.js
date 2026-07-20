const dashboardData = window.dashboardData;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const exactCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const propertyColors = { "7 Ash Lane": "#f97316", "38 Lakewood Dr": "#2563eb", "14 Lakewood Dr": "#16a34a", General: "#9333ea" };
const categoryColors = ["#2563eb", "#f97316", "#16a34a", "#db2777", "#9333ea", "#0891b2", "#ca8a04", "#475569"];
const dashboardPin = "BPI2025";
const bgContractingName = "BG Contracting";
const state = { view: "Overview", year: "All", property: "All", category: "All", payer: "All", query: "" };
const $ = (id) => document.getElementById(id);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const groupSum = (rows, key) => rows.reduce((acc, row) => {
  const name = key(row);
  acc[name] = (acc[name] || 0) + row.amount;
  return acc;
}, {});
const sortedEntries = (record) => Object.entries(record).sort((a, b) => b[1] - a[1]);
const monthName = (month) => {
  const [year, monthNumber] = month.split("-");
  return new Date(Number(year), Number(monthNumber) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const optionHtml = (items) => ['<option>All</option>', ...items.map((item) => '<option>' + escapeHtml(item) + '</option>')].join("");
const panel = (title, subtitle, content, extraClass = "") => '<section class="panel ' + extraClass + '"><div class="panel-heading"><div><h3>' + title + '</h3><p>' + subtitle + '</p></div></div>' + content + '</section>';
const metric = (label, value, detail, tone) => '<article class="metric-card ' + tone + '"><span>' + label + '</span><strong>' + value + '</strong><p>' + detail + '</p></article>';
const barRow = (label, value, max, color) => '<div class="bar-row"><div class="bar-label"><span>' + escapeHtml(label) + '</span><strong>' + exactCurrency.format(value) + '</strong></div><div class="bar-track"><div class="bar-fill" style="width:' + Math.max((value / max) * 100, 3) + '%;background:' + color + '"></div></div></div>';

function filteredExpenses() {
  const search = state.query.trim().toLowerCase();
  return dashboardData.expenses.filter((row) => {
    const text = [row.id, row.property, row.category, row.paidBy, row.notes].join(" ").toLowerCase();
    return (state.year === "All" || String(row.year) === state.year)
      && (state.property === "All" || row.property === state.property)
      && (state.category === "All" || row.category === state.category)
      && (state.payer === "All" || row.paidBy === state.payer)
      && (!search || text.includes(search));
  });
}

function filteredPayments() {
  return dashboardData.vendorPayments.filter((row) => state.year === "All" || String(row.year) === state.year);
}

function filteredContributions() {
  return dashboardData.contributions.filter((row) =>
    (state.year === "All" || String(row.year) === state.year)
    && (state.property === "All" || row.property === state.property)
  );
}

function totalsFor(rows, payments, contributionsRows) {
  const berkCharges = sum(rows.filter((row) => row.paidBy === bgContractingName).map((row) => row.amount));
  const berkPayments = sum(payments.filter((row) => row.paidTo === bgContractingName).map((row) => row.amount));
  return {
    expenseTotal: sum(rows.map((row) => row.amount)),
    berkCharges,
    berkPayments,
    berkBalance: berkCharges - berkPayments,
    llcPaid: sum(rows.filter((row) => row.paidBy === "LLC Bank Account").map((row) => row.amount)),
    contributions: sum(contributionsRows.map((row) => row.amount)),
  };
}

function renderOverview(rows, totals) {
  const byProperty = sortedEntries(groupSum(rows, (row) => row.property));
  const byCategory = sortedEntries(groupSum(rows, (row) => row.category));
  const byPayer = sortedEntries(groupSum(rows, (row) => row.paidBy));
  const byMonth = sortedEntries(groupSum(rows, (row) => row.month)).sort((a, b) => a[0].localeCompare(b[0]));
  const maxProperty = Math.max(...byProperty.map(([, value]) => value), 1);
  const maxCategory = Math.max(...byCategory.map(([, value]) => value), 1);
  const maxMonth = Math.max(...byMonth.map(([, value]) => value), 1);
  $("overview-view").innerHTML =
    '<section class="kpi-grid">'
    + metric("Total expenses", currency.format(totals.expenseTotal), rows.length + " rows in view", "orange")
    + metric("LLC bank paid", currency.format(totals.llcPaid), "Direct bank expenses", "blue")
    + metric("Berkshire General Contracting charges", currency.format(totals.berkCharges), "Vendor credit and work", "green")
    + metric("Member contributions", currency.format(totals.contributions), state.year === "All" ? "All contributions" : state.year + " only", "pink")
    + '</section><section class="dashboard-grid">'
    + panel("Expenses By Property", "Filtered totals", '<div class="bar-list">' + byProperty.map(([name, value]) => barRow(name, value, maxProperty, propertyColors[name] || "#64748b")).join("") + '</div>')
    + panel("Monthly Spend", "Year-wise trend", '<div class="month-chart">' + byMonth.map(([name, value]) => '<div class="month-column"><div class="month-bar" style="height:' + Math.max((value / maxMonth) * 100, 8) + '%"></div><span>' + monthName(name) + '</span></div>').join("") + '</div>')
    + panel("Category Mix", "Where money went", '<div class="bar-list">' + byCategory.map(([name, value], index) => barRow(name, value, maxCategory, categoryColors[index % categoryColors.length])).join("") + '</div>')
    + panel("Paid By / Charge Source", "Clearer than raw spreadsheet", '<div class="payer-grid">' + byPayer.map(([name, value]) => '<div class="payer-pill"><span>' + escapeHtml(name) + '</span><strong>' + exactCurrency.format(value) + '</strong></div>').join("") + '</div>')
    + '</section>';
}

function renderBg(rows, payments, totals) {
  const bgRows = rows.filter((row) => row.paidBy === bgContractingName);
  const byCategory = sortedEntries(groupSum(bgRows, (row) => row.category));
  const byProperty = sortedEntries(groupSum(bgRows, (row) => row.property));
  const categoryRows = byCategory.map(([name, value]) => '<tr><td>' + escapeHtml(name) + '</td><td class="amount-cell">' + exactCurrency.format(value) + '</td><td>' + (totals.berkCharges ? Math.round((value / totals.berkCharges) * 100) : 0) + '%</td></tr>').join("");
  $("bg-view").innerHTML = '<section class="vendor-layout">'
    + '<div class="vendor-hero"><p class="eyebrow">BG Contracting</p><h3>' + currency.format(totals.berkBalance) + '</h3><p>Estimated remaining balance based on filtered Berkshire General Contracting charges minus payments released.</p><div class="vendor-math"><span>' + currency.format(totals.berkCharges) + ' Berkshire General Contracting charges</span><span>' + currency.format(totals.berkPayments) + ' paid</span></div></div>'
    + panel("Payments Released", "From vendor payments tab", '<div class="payment-list">' + payments.map((row) => '<div class="payment-row"><div><strong>' + escapeHtml(row.id) + '</strong><span>' + escapeHtml(row.date) + '</span></div><p>' + escapeHtml(row.notes || row.bankDescription) + '</p><strong>' + exactCurrency.format(row.amount) + '</strong></div>').join("") + '</div>')
    + '<section class="vendor-breakdown-grid">'
    + panel("Charges By Category", "Berkshire General Contracting category totals", '<div class="table-wrap compact-table"><table><thead><tr><th>Expense Category</th><th>Amount</th><th>Share</th></tr></thead><tbody>' + categoryRows + '<tr class="total-row"><td>Total</td><td class="amount-cell">' + exactCurrency.format(totals.berkCharges) + '</td><td>100%</td></tr></tbody></table></div>')
    + panel("Charges By Property", "Berkshire General Contracting property totals", '<div class="bar-list">' + byProperty.map(([name, value]) => barRow(name, value, totals.berkCharges || 1, propertyColors[name] || "#64748b")).join("") + '</div>')
    + '</section></section>';
}

function renderContributions(rows, contributionsRows) {
  const members = [...new Set(dashboardData.contributions.map((row) => row.member).filter(Boolean))].sort();
  const contributionTotals = members.map((member) => [
    member,
    sum(contributionsRows.filter((row) => row.member === member).map((row) => row.amount)),
  ]);
  const memberExpenseRows = rows.filter((row) => members.includes(row.paidBy));
  const expenseTotals = members.map((member) => [
    member,
    sum(memberExpenseRows.filter((row) => row.paidBy === member).map((row) => row.amount)),
  ]);
  const contributionTableRows = contributionTotals.map(([member, value]) => '<tr><td>' + escapeHtml(member) + '</td><td class="amount-cell">' + exactCurrency.format(value) + '</td></tr>').join("");
  const expenseTableRows = expenseTotals.map(([member, value]) => '<tr><td>' + escapeHtml(member) + '</td><td class="amount-cell">' + exactCurrency.format(value) + '</td></tr>').join("");
  const transactionRows = contributionsRows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => '<tr><td>' + escapeHtml(row.date) + '</td><td>' + escapeHtml(row.member) + '</td><td>' + escapeHtml(row.property) + '</td><td>' + escapeHtml(row.type) + '</td><td class="amount-cell">' + exactCurrency.format(row.amount) + '</td><td>' + escapeHtml(row.notes) + '</td></tr>')
    .join("");
  $("contributions-view").innerHTML =
    '<section class="dashboard-grid">'
    + panel("Member Contributions", "Totals from 1_Contributions", '<div class="table-wrap compact-table"><table><thead><tr><th>Member</th><th>Total Contributions</th></tr></thead><tbody>' + contributionTableRows + '<tr class="total-row"><td>Total</td><td class="amount-cell">' + exactCurrency.format(sum(contributionTotals.map(([, value]) => value))) + '</td></tr></tbody></table></div>')
    + panel("Expenses Paid By Member", "Member-paid expense totals", '<div class="table-wrap compact-table"><table><thead><tr><th>Member</th><th>Total Expenses Paid</th></tr></thead><tbody>' + expenseTableRows + '<tr class="total-row"><td>Total</td><td class="amount-cell">' + exactCurrency.format(sum(expenseTotals.map(([, value]) => value))) + '</td></tr></tbody></table></div>')
    + '</section>'
    + panel("Contribution Transactions", "Rows from 1_Contributions", '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Member</th><th>Property</th><th>Type</th><th>Amount</th><th>Notes</th></tr></thead><tbody>' + transactionRows + '</tbody></table></div>', "table-panel contribution-transactions");
}

function renderTransactions(rows) {
  $("transactions-view").innerHTML = panel("Transactions", "Searchable expense detail", '<div class="table-wrap"><table><thead><tr><th>Date</th><th>ID</th><th>Property</th><th>Category</th><th>Paid By</th><th>Amount</th><th>Notes</th></tr></thead><tbody>' + rows.map((row) => '<tr><td>' + escapeHtml(row.date) + '</td><td>' + escapeHtml(row.id) + '</td><td>' + escapeHtml(row.property) + '</td><td>' + escapeHtml(row.category) + '</td><td><span class="source-badge ' + (row.paidBy === bgContractingName ? "berk" : "") + '">' + escapeHtml(row.paidBy) + '</span></td><td class="amount-cell">' + exactCurrency.format(row.amount) + '</td><td>' + escapeHtml(row.notes) + '</td></tr>').join("") + '</tbody></table></div>', "table-panel");
}

function render() {
  const rows = filteredExpenses();
  const payments = filteredPayments();
  const contributions = filteredContributions();
  const totals = totalsFor(rows, payments, contributions);
  $("view-title").textContent = state.view;
  $("year-label").textContent = state.year === "All" ? "All years" : state.year;
  $("expense-count").textContent = rows.length + " expenses";
  $("overview-view").hidden = state.view !== "Overview";
  $("bg-view").hidden = state.view !== "BG Contracting";
  $("contributions-view").hidden = state.view !== "Contributions";
  $("transactions-view").hidden = state.view !== "Transactions";
  renderOverview(rows, totals);
  renderBg(rows, payments, totals);
  renderContributions(rows, contributions);
  renderTransactions(rows);
}

function init() {
  const gate = $("pin-gate");
  const shell = $("dashboard-shell");
  const form = $("pin-form");
  const input = $("pin-input");
  const error = $("pin-error");
  const unlock = () => {
    gate.classList.add("hidden");
    shell.classList.remove("locked");
  };
  if (sessionStorage.getItem("bpi-dashboard-unlocked") === "yes") {
    unlock();
  } else {
    input.focus();
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value.trim().toUpperCase() === dashboardPin.toUpperCase()) {
      sessionStorage.setItem("bpi-dashboard-unlocked", "yes");
      unlock();
      return;
    }
    error.textContent = "Incorrect PIN. Please try again.";
    input.value = "";
    input.focus();
  });
  $("last-updated").textContent = dashboardData.meta.lastUpdated;
  $("year-filter").innerHTML = optionHtml(dashboardData.meta.years);
  $("property-filter").innerHTML = optionHtml(dashboardData.meta.properties);
  $("category-filter").innerHTML = optionHtml(dashboardData.meta.categories);
  $("payer-filter").innerHTML = optionHtml(dashboardData.meta.payers);
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
    render();
  }));
  [["year-filter", "year"], ["property-filter", "property"], ["category-filter", "category"], ["payer-filter", "payer"]].forEach(([id, key]) => {
    $(id).addEventListener("change", (event) => { state[key] = event.target.value; render(); });
  });
  $("search-filter").addEventListener("input", (event) => { state.query = event.target.value; render(); });
  render();
}

init();
