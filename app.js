// ==========================================================================
// Pennywise App Logic — app.js
// Modern, Dark Midnight Navy Theme matching Reference Design
// ==========================================================================

const CATEGORIES = {
  Food: { icon: "🍜", color: "#8b78ed" },
  Travel: { icon: "🚕", color: "#f0a36c" },
  Shopping: { icon: "🛍️", color: "#e67fa5" },
  Bills: { icon: "💡", color: "#e7bd59" },
  Education: { icon: "📚", color: "#62b7a0" },
  Health: { icon: "💊", color: "#68a6df" },
  Entertainment: { icon: "🎬", color: "#aa88d9" },
  Other: { icon: "✦", color: "#9ba1b5" }
};

const KEYWORDS = {
  Travel: ["travel", "trip", "uber", "ola", "taxi", "cab", "flight", "plane", "train", "metro", "bus", "fuel", "petrol", "diesel", "ticket", "toll", "auto", "commute", "fare"],
  Food: ["lunch", "dinner", "breakfast", "food", "grocery", "groceries", "restaurant", "cafe", "coffee", "tea", "swiggy", "zomato", "snack", "snacks", "pizza", "burger", "meal", "supermarket", "bakery", "drinks", "starbucks"],
  Shopping: ["shopping", "amazon", "flipkart", "myntra", "clothes", "clothing", "shoes", "shirt", "tshirt", "pants", "electronics", "gadget", "mall", "store", "apparel", "dress"],
  Bills: ["bill", "bills", "electricity", "water", "wifi", "internet", "broadband", "recharge", "mobile", "phone", "rent", "maintenance", "gas", "utility", "dth", "subscription"],
  Education: ["book", "books", "course", "tuition", "school", "college", "fees", "exam", "udemy", "coursera", "class", "study", "stationery"],
  Health: ["medicine", "medicines", "doctor", "hospital", "clinic", "pharmacy", "medical", "gym", "fitness", "dentist", "pill", "pills", "health", "checkup"],
  Entertainment: ["movie", "movies", "cinema", "netflix", "prime", "spotify", "hotstar", "concert", "game", "gaming", "steam", "theatre", "party", "club", "outing"]
};

function detectCategory(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    for (const w of words) {
      const regex = new RegExp(`\\b${w}\\b`, "i");
      if (regex.test(lower)) return cat;
    }
  }
  return null;
}

const $ = id => document.getElementById(id);

// Currency formatting with mandatory 2 decimal places to match ₹0.00 and ₹10,000.00
const money = n => {
  const val = Number(n) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

const today = new Date();
const dateISO = d => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const monthKey = d => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
};
const prettyDate = d => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

let expenses = JSON.parse(localStorage.getItem("pennywise_expenses") || "[]");
let budget = Number(localStorage.getItem("pennywise_budget") || 10000);
let editingId = null;
let toastTimer;

function save() {
  localStorage.setItem("pennywise_expenses", JSON.stringify(expenses));
  localStorage.setItem("pennywise_budget", String(budget));
}

function showToast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function currentMonthItems() {
  return expenses.filter(e => monthKey(e.date) === monthKey(today));
}

function total(items) {
  return items.reduce((s, e) => s + Number(e.amount), 0);
}

function safe(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function init() {
  // Auto-migrate any previously mis-categorized expenses based on explicit keywords
  let migrated = false;
  expenses = expenses.map(e => {
    if (!e.category || e.category === "Food") {
      const detected = detectCategory(e.title);
      if (detected && detected !== "Food") {
        migrated = true;
        return { ...e, category: detected };
      }
    }
    return e;
  });
  if (migrated) save();

  // Topbar and welcome dates
  const dayStr = today.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  $("todayLabel").textContent = dayStr;
  
  const monthStr = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  $("monthLabel").textContent = monthStr;
  
  $("expenseDate").value = dateISO(today);
  const catOptions = Object.keys(CATEGORIES).map(c => `<option value="${c}">${CATEGORIES[c].icon} ${c}</option>`).join("");
  $("expenseCategory").innerHTML = catOptions;
  $("categoryFilter").innerHTML = '<option value="">All categories</option>' + catOptions;
  $("budgetInput").value = budget;
  
  // Enforce dark mode by default unless user explicitly chose light
  if (localStorage.getItem("pennywise_dark") !== "0") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
  
  render();
}

function render() {
  const month = currentMonthItems();
  const spent = total(month);
  const all = total(expenses);

  $("totalSpent").textContent = money(all);
  $("monthSpent").textContent = money(spent);
  $("transactionCount").textContent = expenses.length;

  const activeDays = new Set(month.map(e => e.date)).size;
  const dailyAvg = activeDays > 0 ? (spent / activeDays) : 0;
  $("dailyAverage").textContent = money(dailyAvg);

  const footEl = $("dailyAvgFoot");
  if (footEl) {
    if (activeDays === 0) {
      footEl.innerHTML = '<span class="dot mint-dot"></span> Based on this month';
    } else if (activeDays === 1) {
      footEl.innerHTML = '<span class="dot mint-dot"></span> Across 1 active day';
    } else {
      footEl.innerHTML = `<span class="dot mint-dot"></span> Across ${activeDays} active days`;
    }
  }

  $("chartTotal").textContent = money(spent);
  $("budgetSpent").textContent = money(spent);
  $("budgetLimit").textContent = money(budget);

  const pct = budget ? (spent / budget) * 100 : 0;
  const progressFill = $("budgetProgress");
  progressFill.style.width = Math.min(100, pct) + "%";
  progressFill.style.background = pct > 100 ? "#ef4444" : "linear-gradient(90deg, #7c6aed, #9d8df6)";

  $("budgetRemaining").textContent = spent > budget
    ? `${money(spent - budget)} over budget`
    : `${money(budget - spent)} remaining`;
  $("budgetPercent").textContent = Math.round(pct) + "%";

  const budgetMsg = $("budgetMessage");
  if (pct > 100) {
    budgetMsg.textContent = "You've passed your monthly budget. Review your spending to get back on track.";
  } else if (pct > 80) {
    budgetMsg.textContent = "You're getting close to your budget limit. Keep an eye on upcoming expenses.";
  } else {
    budgetMsg.textContent = "You're doing well. Keep tracking your spending consistently.";
  }

  renderDonut(month);
  renderRows("recentRows", expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5));
  $("recentEmpty").classList.toggle("show", expenses.length === 0);
  renderFilters();
  renderAnalytics(month);
}

function renderDonut(items) {
  const canvas = $("donutChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 236;
  
  // Set buffer resolution multiplied by DPR for ultra-sharp Retina rendering
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  // Explicitly constrain element style dimensions in CSS pixels to prevent DPR expansion
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const center = size / 2;
  const radius = 82;
  const lineWidth = 24;

  // 1. Always draw the full 360-degree background ring track
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#23263b";
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  const sums = {};
  items.forEach(e => { sums[e.category] = (sums[e.category] || 0) + Number(e.amount); });
  const entries = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  const sum = total(items);

  const emptyHint = $("chartEmptyHint");
  const legend = $("categoryLegend");

  if (!sum) {
    if (emptyHint) emptyHint.style.display = "block";
    if (legend) {
      legend.style.display = "none";
      legend.innerHTML = "";
    }
  } else {
    // Fill the donut according to recorded expenses relative to monthly budget!
    const targetBudget = budget > 0 ? budget : sum;
    const fillFraction = Math.min(1, sum / targetBudget);
    const totalFilledAngle = fillFraction * Math.PI * 2;

    let start = -Math.PI / 2;
    entries.forEach(([cat, val]) => {
      const catAngle = (val / sum) * totalFilledAngle;
      const end = start + catAngle;

      ctx.beginPath();
      ctx.arc(center, center, radius, start, end);
      ctx.strokeStyle = (CATEGORIES[cat] && CATEGORIES[cat].color) || "#8c7af1";
      ctx.lineWidth = lineWidth;
      ctx.lineCap = entries.length === 1 ? "round" : "butt";
      ctx.stroke();

      start = end;
    });

    if (emptyHint) emptyHint.style.display = "none";
    if (legend) {
      legend.style.display = "flex";
      legend.innerHTML = entries.slice(0, 5).map(([c, v]) => {
        const col = (CATEGORIES[c] && CATEGORIES[c].color) || "#8c7af1";
        return `<span class="legend-item"><i class="legend-dot" style="background:${col}"></i>${safe(c)} · ${money(v)}</span>`;
      }).join("");
    }
  }
}

function renderRows(target, items) {
  const body = $(target);
  if (!body) return;
  body.innerHTML = items.map(e => {
    const c = CATEGORIES[e.category] || CATEGORIES.Other;
    return `<tr>
      <td>
        <div class="desc-cell">
          <span class="category-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</span>
          <span>
            ${safe(e.title)}
            ${e.note ? `<small style="display:block;color:var(--muted);font-weight:400;margin-top:3px">${safe(e.note)}</small>` : ""}
          </span>
        </div>
      </td>
      <td>
        <span class="category-tag" style="color:${c.color};border-color:${c.color}35;background:${c.color}18" title="Category: ${safe(e.category)}">
          ${c.icon} ${safe(e.category)}
        </span>
      </td>
      <td>${prettyDate(e.date)}</td>
      <td class="amount-cell">${money(e.amount)}</td>
      <td class="actions-cell">
        <button class="mini-action" title="Edit" data-edit="${e.id}">✎</button>
        <button class="mini-action" title="Delete" data-delete="${e.id}">×</button>
      </td>
    </tr>`;
  }).join("");
}

function renderFilters() {
  const months = [...new Set(expenses.map(e => monthKey(e.date)))].sort().reverse();
  const selected = $("monthFilter").value;
  $("monthFilter").innerHTML = '<option value="">All dates</option>' + months.map(m => {
    return `<option value="${m}">${new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</option>`;
  }).join("");
  $("monthFilter").value = months.includes(selected) ? selected : "";
  filterRows();
}

function filterRows() {
  const q = $("searchInput").value.trim().toLowerCase();
  const cat = ($("categoryFilter").value || "").trim().toLowerCase();
  const month = $("monthFilter").value;
  const filtered = expenses.filter(e => {
    const eCat = (e.category || "").trim().toLowerCase();
    const matchCat = !cat || eCat === cat;
    const matchMonth = !month || monthKey(e.date) === month;
    const matchQ = !q || (e.title + " " + (e.note || "") + " " + e.category).toLowerCase().includes(q);
    return matchCat && matchMonth && matchQ;
  }).sort((a, b) => b.date.localeCompare(a.date));

  renderRows("allRows", filtered);
  $("allEmpty").classList.toggle("show", filtered.length === 0);
}

function renderAnalytics(month) {
  const sums = {};
  month.forEach(e => { sums[e.category] = (sums[e.category] || 0) + Number(e.amount); });
  const top = Object.entries(sums).sort((a, b) => b[1] - a[1])[0];
  const largest = expenses.slice().sort((a, b) => b.amount - a.amount)[0];

  $("topCategory").textContent = top ? top[0] : "—";
  $("largestExpense").textContent = largest ? money(largest.amount) : money(0);
  $("largestTitle").textContent = largest ? largest.title : "No expenses yet";
  $("averageExpense").textContent = expenses.length ? money(total(expenses) / expenses.length) : money(0);
  $("categoriesUsed").textContent = new Set(expenses.map(e => e.category)).size;

  $("breakdownList").innerHTML = top ? Object.entries(sums).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
    const col = (CATEGORIES[cat] && CATEGORIES[cat].color) || "#8c7af1";
    const pct = Math.round((val / total(month)) * 100);
    return `<div>
      <div class="breakdown-head">
        <span>${CATEGORIES[cat].icon} &nbsp;${safe(cat)}</span>
        <span>${money(val)} · ${pct}%</span>
      </div>
      <div class="breakdown-track">
        <div class="breakdown-fill" style="width:${(val / total(month)) * 100}%;background:${col}"></div>
      </div>
    </div>`;
  }).join("") : '<p class="muted">Add expenses this month to see your category analytics.</p>';
}

function openModal(id) { $(id).classList.add("open"); }
function closeModal(id) { $(id).classList.remove("open"); }

let userSelectedCategory = false;

function resetExpenseForm() {
  editingId = null;
  userSelectedCategory = false;
  $("expenseForm").reset();
  $("expenseCategory").value = "Food";
  $("expenseDate").value = dateISO(today);
  $("modalTitle").textContent = "Add an expense";
  $("saveExpense").textContent = "Save expense";
}

$("expenseCategory").addEventListener("change", () => {
  userSelectedCategory = true;
});
$("expenseCategory").addEventListener("input", () => {
  userSelectedCategory = true;
});

$("expenseTitle").addEventListener("input", e => {
  if (!userSelectedCategory) {
    const detected = detectCategory(e.target.value);
    if (detected && CATEGORIES[detected]) {
      $("expenseCategory").value = detected;
    }
  }
});

$("openAdd").addEventListener("click", () => { resetExpenseForm(); openModal("expenseModal"); });
$("emptyAdd").addEventListener("click", () => { resetExpenseForm(); openModal("expenseModal"); });

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => closeModal(b.dataset.close)));
document.querySelectorAll(".modal-backdrop").forEach(b => b.addEventListener("click", e => { if (e.target === b) closeModal(b.id); }));

$("expenseForm").addEventListener("submit", e => {
  e.preventDefault();
  const amount = Number($("expenseAmount").value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter an amount greater than zero.");
    return;
  }
  const item = {
    id: editingId || String(Date.now()),
    title: $("expenseTitle").value.trim(),
    amount,
    category: $("expenseCategory").value,
    date: $("expenseDate").value,
    note: $("expenseNote").value.trim()
  };
  if (!item.title || !item.date) {
    showToast("Please complete all required fields.");
    return;
  }
  if (editingId) {
    expenses = expenses.map(x => x.id === editingId ? item : x);
    showToast("Expense updated successfully.");
  } else {
    expenses.push(item);
    showToast("Expense added successfully.");
  }
  save();
  closeModal("expenseModal");
  resetExpenseForm();
  render();
});

document.addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  if (edit) {
    const item = expenses.find(x => x.id === edit.dataset.edit);
    if (!item) return;
    editingId = item.id;
    userSelectedCategory = true;
    $("expenseTitle").value = item.title;
    $("expenseAmount").value = item.amount;
    $("expenseCategory").value = CATEGORIES[item.category] ? item.category : "Other";
    $("expenseDate").value = item.date;
    $("expenseNote").value = item.note || "";
    $("modalTitle").textContent = "Edit expense";
    $("saveExpense").textContent = "Update expense";
    openModal("expenseModal");
  }
  if (del) {
    const item = expenses.find(x => x.id === del.dataset.delete);
    if (item && confirm(`Delete "${item.title}"?`)) {
      expenses = expenses.filter(x => x.id !== item.id);
      save();
      render();
      showToast("Expense deleted.");
    }
  }
});

["searchInput", "categoryFilter", "monthFilter"].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener("input", filterRows);
    el.addEventListener("change", filterRows);
  }
});

$("editBudget").addEventListener("click", () => openModal("budgetModal"));
$("budgetNav").addEventListener("click", () => openModal("budgetModal"));

$("budgetForm").addEventListener("submit", e => {
  e.preventDefault();
  const v = Number($("budgetInput").value);
  if (v <= 0) {
    showToast("Enter a budget greater than zero.");
    return;
  }
  budget = v;
  save();
  render();
  closeModal("budgetModal");
  showToast("Monthly budget updated.");
});

$("exportCsv").addEventListener("click", () => {
  if (!expenses.length) {
    showToast("There are no expenses to export yet.");
    return;
  }
  const rows = [
    ["Title", "Amount (INR)", "Category", "Date", "Note"],
    ...expenses.map(e => [e.title, e.amount, e.category, e.date, e.note || ""])
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "pennywise-expenses.csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV file exported.");
});

function switchPage(view) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  const targetPage = $(view + "Page");
  if (targetPage) targetPage.classList.add("active-page");

  document.querySelectorAll(".nav-item[data-view]").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });

  $("pageName").textContent = view[0].toUpperCase() + view.slice(1);
  $("sidebar").classList.remove("open");
}

document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => switchPage(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => switchPage(b.dataset.go)));
$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("pennywise_dark", isDark ? "1" : "0");
  renderDonut(currentMonthItems());
});

window.addEventListener("resize", () => renderDonut(currentMonthItems()));

// Login & Account Profile
function loginUser(user) {
  localStorage.setItem("pennywise_user", JSON.stringify(user));
  updateProfileUI(user);
  showToast(`Welcome back, ${user.name}!`);
  switchPage("dashboard");
}

function updateProfileUI(user) {
  if (!user) return;
  const avatarEl = $("userAvatar");
  const nameEl = $("userName");
  const subEl = $("userSubtext");
  if (avatarEl) avatarEl.textContent = user.avatar || "Y";
  if (nameEl) nameEl.textContent = user.name || "Your account";
  if (subEl) subEl.textContent = user.email || "Personal workspace";
}

const savedUser = JSON.parse(localStorage.getItem("pennywise_user") || "null");
if (savedUser) updateProfileUI(savedUser);

const profileEl = $("profileAccount");
if (profileEl) profileEl.addEventListener("click", () => switchPage("login"));

// Login Form & Animation
const portal = $("flooPortal");
if (portal) {
  let px = 0, py = 0, targetX = 0, targetY = 0;
  window.addEventListener("pointermove", e => {
    targetX = (e.clientX / window.innerWidth) * 2 - 1;
    targetY = (e.clientY / window.innerHeight) * 2 - 1;
  });
  function animPortal() {
    px += (targetX - px) * 0.05;
    py += (targetY - py) * 0.05;
    portal.style.setProperty("--tx", `${px * -14}px`);
    portal.style.setProperty("--ty", `${py * -10}px`);
    requestAnimationFrame(animPortal);
  }
  requestAnimationFrame(animPortal);

  const submitBtn = $("flooSubmitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("pointerenter", () => portal.classList.add("is-hovering"));
    submitBtn.addEventListener("pointerleave", () => portal.classList.remove("is-hovering"));
  }
}

const loginForm = $("flooLoginForm");
if (loginForm) {
  loginForm.addEventListener("submit", e => {
    e.preventDefault();
    const email = $("loginEmail").value.trim() || "aditya@pennywise.app";
    const rawName = email.split("@")[0].replace(/[^a-zA-Z]/g, " ").trim();
    const displayName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "Aditya";
    loginUser({ name: displayName, email, avatar: displayName.charAt(0) });
  });
}

const googleBtn = $("googleLoginBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", () => {
    loginUser({ name: "Aditya Thakur", email: "aditya.thakur@google.com", avatar: "A" });
  });
}

const fbBtn = $("facebookLoginBtn");
if (fbBtn) {
  fbBtn.addEventListener("click", () => {
    loginUser({ name: "Aditya Thakur", email: "aditya.thakur@facebook.com", avatar: "A" });
  });
}

const togglePass = $("togglePasswordBtn");
if (togglePass) {
  togglePass.addEventListener("click", () => {
    const passInput = $("loginPassword");
    passInput.type = passInput.type === "password" ? "text" : "password";
  });
}

const forgotBtn = $("forgotPasswordBtn");
if (forgotBtn) {
  forgotBtn.addEventListener("click", () => {
    showToast("Password reset link sent to your email.");
  });
}

init();
