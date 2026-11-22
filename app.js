const CATEGORIES = {
  Food:{icon:"🍜",color:"#8b78ed"}, Travel:{icon:"🚕",color:"#f0a36c"},
  Shopping:{icon:"🛍️",color:"#e67fa5"}, Bills:{icon:"💡",color:"#e7bd59"},
  Education:{icon:"📚",color:"#62b7a0"}, Health:{icon:"💊",color:"#68a6df"},
  Entertainment:{icon:"🎬",color:"#aa88d9"}, Other:{icon:"✦",color:"#9ba1b5"}
};
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
const today = new Date();
const dateISO = d => {const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`};
const monthKey = d => {const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`};
const prettyDate = d => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
let expenses = JSON.parse(localStorage.getItem("pennywise_expenses") || "[]");
let budget = Number(localStorage.getItem("pennywise_budget") || 10000);
let editingId = null;
let toastTimer;

function save(){localStorage.setItem("pennywise_expenses",JSON.stringify(expenses));localStorage.setItem("pennywise_budget",String(budget));}
function showToast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2400)}
function currentMonthItems(){return expenses.filter(e=>monthKey(e.date)===monthKey(today))}
function total(items){return items.reduce((s,e)=>s+Number(e.amount),0)}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function init(){
  $("todayLabel").textContent=today.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
  $("monthLabel").textContent=today.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  $("expenseDate").value=dateISO(today);
  $("expenseCategory").innerHTML=Object.keys(CATEGORIES).map(c=>`<option>${c}</option>`).join("");
  $("categoryFilter").innerHTML='<option value="">All categories</option>'+Object.keys(CATEGORIES).map(c=>`<option>${c}</option>`).join("");
  $("budgetInput").value=budget;
  render();
}
function render(){
  const month=currentMonthItems(), spent=total(month), all=total(expenses);
  $("totalSpent").textContent=money(all);$("monthSpent").textContent=money(spent);
  $("transactionCount").textContent=expenses.length;
  $("dailyAverage").textContent=money(spent/Math.max(1,today.getDate()));
  $("chartTotal").textContent=money(spent);
  $("budgetSpent").textContent=money(spent);$("budgetLimit").textContent=money(budget);
  const pct=budget?spent/budget*100:0;
  $("budgetProgress").style.width=Math.min(100,pct)+"%";
  $("budgetProgress").style.background=pct>100?"#e47e83":"linear-gradient(90deg,#7a69e8,#ad9df8)";
  $("budgetRemaining").textContent=spent>budget?`${money(spent-budget)} over budget`:`${money(budget-spent)} remaining`;
  $("budgetPercent").textContent=Math.round(pct)+"%";
  $("budgetMessage").textContent=pct>100?"You've passed your monthly budget. Review your spending to get back on track.":pct>80?"You're getting close to your budget limit. Keep an eye on upcoming expenses.":"You're doing well. Keep tracking your spending consistently.";
  renderDonut(month);renderRows("recentRows",expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5));
  $("recentEmpty").classList.toggle("show",expenses.length===0);
  renderFilters();renderAnalytics(month);
}
function renderDonut(items){
  const canvas=$("donutChart"),ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,size=240;
  canvas.width=size*dpr;canvas.height=size*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,size,size);
  const sums={};items.forEach(e=>sums[e.category]=(sums[e.category]||0)+Number(e.amount));
  const entries=Object.entries(sums).sort((a,b)=>b[1]-a[1]);const sum=total(items);
  if(!sum){ctx.beginPath();ctx.arc(120,120,82,0,Math.PI*2);ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--line");ctx.lineWidth=22;ctx.stroke();}
  else{let start=-Math.PI/2;entries.forEach(([cat,val])=>{const end=start+val/sum*Math.PI*2;ctx.beginPath();ctx.arc(120,120,82,start,end);ctx.strokeStyle=CATEGORIES[cat].color;ctx.lineWidth=22;ctx.lineCap="round";ctx.stroke();start=end;});}
  $("categoryLegend").innerHTML=entries.length?entries.slice(0,5).map(([c,v])=>`<span class="legend-item"><i class="legend-dot" style="background:${CATEGORIES[c].color}"></i>${safe(c)} · ${Math.round(v/sum*100)}%</span>`).join(""):'<span class="legend-item">Add expenses to see your breakdown</span>';
}
function renderRows(target,items){
  const body=$(target);
  body.innerHTML=items.map(e=>{const c=CATEGORIES[e.category]||CATEGORIES.Other;return `<tr><td><div class="desc-cell"><span class="category-icon">${c.icon}</span><span>${safe(e.title)}${e.note?`<small style="display:block;color:var(--muted);font-weight:400;margin-top:3px">${safe(e.note)}</small>`:""}</span></div></td><td><span class="category-tag">${safe(e.category)}</span></td><td>${prettyDate(e.date)}</td><td class="amount-cell">${money(e.amount)}</td><td class="actions-cell"><button class="mini-action" title="Edit" data-edit="${e.id}">✎</button><button class="mini-action" title="Delete" data-delete="${e.id}">×</button></td></tr>`}).join("");
}
function renderFilters(){
  const months=[...new Set(expenses.map(e=>monthKey(e.date)))].sort().reverse();
  const selected=$("monthFilter").value;
  $("monthFilter").innerHTML='<option value="">All dates</option>'+months.map(m=>`<option value="${m}">${new Date(m+"-01T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</option>`).join("");
  $("monthFilter").value=months.includes(selected)?selected:"";
  filterRows();
}
function filterRows(){
  const q=$("searchInput").value.trim().toLowerCase(),cat=$("categoryFilter").value,month=$("monthFilter").value;
  const filtered=expenses.filter(e=>(!q||(e.title+" "+e.note+" "+e.category).toLowerCase().includes(q))&&(!cat||e.category===cat)&&(!month||monthKey(e.date)===month)).sort((a,b)=>b.date.localeCompare(a.date));
  renderRows("allRows",filtered);$("allEmpty").classList.toggle("show",filtered.length===0);
}
function renderAnalytics(month){
  const sums={};month.forEach(e=>sums[e.category]=(sums[e.category]||0)+Number(e.amount));
  const top=Object.entries(sums).sort((a,b)=>b[1]-a[1])[0];
  const largest=expenses.slice().sort((a,b)=>b.amount-a.amount)[0];
  $("topCategory").textContent=top?top[0]:"—";$("largestExpense").textContent=largest?money(largest.amount):money(0);
  $("largestTitle").textContent=largest?largest.title:"No expenses yet";
  $("averageExpense").textContent=expenses.length?money(total(expenses)/expenses.length):money(0);
  $("categoriesUsed").textContent=new Set(expenses.map(e=>e.category)).size;
  $("breakdownList").innerHTML=top?Object.entries(sums).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>`<div><div class="breakdown-head"><span>${CATEGORIES[cat].icon} &nbsp;${safe(cat)}</span><span>${money(val)} · ${Math.round(val/total(month)*100)}%</span></div><div class="breakdown-track"><div class="breakdown-fill" style="width:${val/total(month)*100}%;background:${CATEGORIES[cat].color}"></div></div></div>`).join(""): '<p class="muted">Add expenses this month to see your category analytics.</p>';
}
function openModal(id){$(id).classList.add("open")}
function closeModal(id){$(id).classList.remove("open")}
function resetExpenseForm(){editingId=null;$("expenseForm").reset();$("expenseDate").value=dateISO(today);$("modalTitle").textContent="Add an expense";$("saveExpense").textContent="Save expense"}
$("openAdd").addEventListener("click",()=>{resetExpenseForm();openModal("expenseModal")});
$("emptyAdd").addEventListener("click",()=>{resetExpenseForm();openModal("expenseModal")});
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
document.querySelectorAll(".modal-backdrop").forEach(b=>b.addEventListener("click",e=>{if(e.target===b)closeModal(b.id)}));
$("expenseForm").addEventListener("submit",e=>{
  e.preventDefault();const amount=Number($("expenseAmount").value);
  if(!Number.isFinite(amount)||amount<=0){showToast("Enter an amount greater than zero.");return}
  const item={id:editingId||String(Date.now()),title:$("expenseTitle").value.trim(),amount,category:$("expenseCategory").value,date:$("expenseDate").value,note:$("expenseNote").value.trim()};
  if(!item.title||!item.date){showToast("Please complete all required fields.");return}
  if(editingId){expenses=expenses.map(x=>x.id===editingId?item:x);showToast("Expense updated successfully.");}
  else{expenses.push(item);showToast("Expense added successfully.");}
  save();closeModal("expenseModal");resetExpenseForm();render();
});
document.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");
  if(edit){const item=expenses.find(x=>x.id===edit.dataset.edit);if(!item)return;editingId=item.id;$("expenseTitle").value=item.title;$("expenseAmount").value=item.amount;$("expenseCategory").value=item.category;$("expenseDate").value=item.date;$("expenseNote").value=item.note||"";$("modalTitle").textContent="Edit expense";$("saveExpense").textContent="Update expense";openModal("expenseModal")}
  if(del){const item=expenses.find(x=>x.id===del.dataset.delete);if(item&&confirm(`Delete "${item.title}"?`)){expenses=expenses.filter(x=>x.id!==item.id);save();render();showToast("Expense deleted.");}}
});
["searchInput","categoryFilter","monthFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",filterRows));
$("editBudget").addEventListener("click",()=>openModal("budgetModal"));$("budgetNav").addEventListener("click",()=>openModal("budgetModal"));
$("budgetForm").addEventListener("submit",e=>{e.preventDefault();const v=Number($("budgetInput").value);if(v<=0){showToast("Enter a budget greater than zero.");return}budget=v;save();render();closeModal("budgetModal");showToast("Monthly budget updated.");});
$("exportCsv").addEventListener("click",()=>{
  if(!expenses.length){showToast("There are no expenses to export yet.");return}
  const rows=[["Title","Amount (INR)","Category","Date","Note"],...expenses.map(e=>[e.title,e.amount,e.category,e.date,e.note||""])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download="pennywise-expenses.csv";a.click();URL.revokeObjectURL(url);showToast("CSV file exported.");
});
function switchPage(view){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page"));
  const targetPage = $(view+"Page");
  if (targetPage) targetPage.classList.add("active-page");
  document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("pageName").textContent=view[0].toUpperCase()+view.slice(1);
  $("sidebar").classList.remove("open");
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>switchPage(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchPage(b.dataset.go)));
$("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("themeToggle").addEventListener("click",()=>{document.body.classList.toggle("dark");localStorage.setItem("pennywise_dark",document.body.classList.contains("dark")?"1":"0");renderDonut(currentMonthItems())});
if(localStorage.getItem("pennywise_dark")==="1")document.body.classList.add("dark");
window.addEventListener("resize",()=>renderDonut(currentMonthItems()));

// Login & Account Profile
function loginUser(user){
  localStorage.setItem("pennywise_user",JSON.stringify(user));
  updateProfileUI(user);
  showToast(`Welcome back, ${user.name}!`);
  switchPage("dashboard");
}
function updateProfileUI(user){
  if(!user) return;
  const avatarEl=$("userAvatar"), nameEl=$("userName"), subEl=$("userSubtext");
  if(avatarEl) avatarEl.textContent = user.avatar || "Y";
  if(nameEl) nameEl.textContent = user.name || "Your account";
  if(subEl) subEl.textContent = user.email || "Personal workspace";
}
const savedUser = JSON.parse(localStorage.getItem("pennywise_user") || "null");
if(savedUser) updateProfileUI(savedUser);

const profileEl = $("profileAccount");
if(profileEl) profileEl.addEventListener("click", ()=>switchPage("login"));

// Login Form & Animation
const portal = $("flooPortal");
if(portal){
  let px = 0, py = 0, targetX = 0, targetY = 0;
  window.addEventListener("pointermove", (e)=>{
    targetX = (e.clientX / window.innerWidth) * 2 - 1;
    targetY = (e.clientY / window.innerHeight) * 2 - 1;
  });
  function animPortal(){
    px += (targetX - px) * 0.05;
    py += (targetY - py) * 0.05;
    portal.style.setProperty("--tx", `${px * -14}px`);
    portal.style.setProperty("--ty", `${py * -10}px`);
    requestAnimationFrame(animPortal);
  }
  requestAnimationFrame(animPortal);

  const submitBtn = $("flooSubmitBtn");
  if(submitBtn){
    submitBtn.addEventListener("pointerenter", ()=>portal.classList.add("is-hovering"));
    submitBtn.addEventListener("pointerleave", ()=>portal.classList.remove("is-hovering"));
  }
}

const loginForm = $("flooLoginForm");
if(loginForm){
  loginForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const email = $("loginEmail").value.trim() || "aditya@pennywise.app";
    const rawName = email.split("@")[0].replace(/[^a-zA-Z]/g, " ").trim();
    const displayName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "Aditya";
    loginUser({ name: displayName, email, avatar: displayName.charAt(0) });
  });
}

const googleBtn = $("googleLoginBtn");
if(googleBtn){
  googleBtn.addEventListener("click", ()=>{
    loginUser({ name: "Aditya Thakur", email: "aditya.thakur@google.com", avatar: "A" });
  });
}

const fbBtn = $("facebookLoginBtn");
if(fbBtn){
  fbBtn.addEventListener("click", ()=>{
    loginUser({ name: "Aditya Thakur", email: "aditya.thakur@facebook.com", avatar: "A" });
  });
}

const togglePass = $("togglePasswordBtn");
if(togglePass){
  togglePass.addEventListener("click", ()=>{
    const passInput = $("loginPassword");
    passInput.type = passInput.type === "password" ? "text" : "password";
  });
}

const forgotBtn = $("forgotPasswordBtn");
if(forgotBtn){
  forgotBtn.addEventListener("click", ()=>{
    showToast("Password reset link sent to your email.");
  });
}

init();