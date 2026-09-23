const K = "cashly_final_v1";
const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.round(Number(n) || 0)) + " ₽";
const moneyPrecise = n => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0) + " ₽";
const esc = x => String(x ?? "").replace(/[&<>\"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

const defaults = () => ({
  setup: false,
  start: { amount: 0, alloc: {} },
  plans: [
    { id: 1, name: "Инвестиции", percent: 50, icon: "↗" },
    { id: 2, name: "Вклады", percent: 20, icon: "▣" },
    { id: 3, name: "Повседневные расходы", percent: 20, icon: "◌" },
    { id: 4, name: "Мечта", percent: 10, icon: "★" }
  ],
  goals: [],
  income: [],
  theme: "purple",
  goalTopups: []
});

let s = JSON.parse(localStorage.getItem(K) || "null") || defaults();
s.start ||= { amount: 0, alloc: {} };
s.start.alloc ||= {};
s.plans ||= [];
s.income ||= [];
s.goals ||= [];
s.goalTopups ||= [];
s.theme ||= "purple";
s.income.forEach(x => { x.alloc ||= {}; x.goals ||= {}; });

function save() { localStorage.setItem(K, JSON.stringify(s)); }
function total() { return s.plans.reduce((a, p) => a + Number(p.percent || 0), 0); }
function incomeTotal() { return s.income.reduce((a, x) => a + Number(x.amount || 0), 0); }
function capitalTotal() { return Number(s.start.amount || 0) + incomeTotal(); }
function goalTotal() { return s.goals.reduce((a, g) => a + Number(g.saved || 0), 0); }
function currentAllocated(id) {
  return (s.start.alloc?.[id] || 0) + s.income.reduce((a, x) => a + (x.alloc?.[id] || 0), 0);
}
function currentGoalSaved(id) { return Number(s.goals.find(g => g.id === id)?.saved || 0); }
function applyTheme() {
  document.body.className = s.theme === "light" ? "light" : "";
  document.body.style.setProperty("--accent", { purple: "#9b6cff", blue: "#38bdf8", green: "#34d399", pink: "#f472b6" }[s.theme] || "#9b6cff");
}
function toast(t) {
  const e = document.createElement("div");
  e.className = "toast"; e.textContent = t; document.body.append(e);
  setTimeout(() => e.remove(), 1800);
}
function openModal(t, b) { $("#modalTitle").textContent = t; $("#modalBody").innerHTML = b; $("#modal").classList.remove("hidden"); }
function closeModal() { $("#modal").classList.add("hidden"); }
$("#modalClose").onclick = closeModal;
$(".backdrop").onclick = closeModal;

function render() {
  applyTheme();
  $("#capital").textContent = money(capitalTotal());
  const now = new Date();
  $("#month").textContent = money(s.income.filter(x => {
    const q = new Date(x.date); return q.getMonth() === now.getMonth() && q.getFullYear() === now.getFullYear();
  }).reduce((a, x) => a + x.amount, 0));
  $("#summary").innerHTML = `Распределено <b>${total()}%</b> · Не распределено <b>${Math.max(0, 100 - total())}%</b>`;

  $("#plans").innerHTML = s.plans.map(p => `
    <div class="plan">
      <div class="row"><div class="icon">${esc(p.icon)}</div><div class="grow"><div class="name">${esc(p.name)}</div><div class="muted">${p.percent}% от каждого нового дохода</div></div><b>${money(currentAllocated(p.id))}</b></div>
      <div class="bar"><i style="width:${Math.min(p.percent,100)}%"></i></div>
      <div class="actions"><button class="mini" onclick="editPlan(${p.id})">Изменить</button><button class="mini" onclick="delPlan(${p.id})">Удалить</button></div>
    </div>`).join("");

  $("#goals").innerHTML = s.goals.length ? s.goals.map(g => {
    const pr = Math.min(100, g.target ? g.saved / g.target * 100 : 0);
    return `<div class="goal">
      <div class="row"><div class="icon">🎯</div><div class="grow"><div class="name">${esc(g.name)}</div><div class="muted">${money(g.saved)} из ${money(g.target)}</div></div><b>${Math.round(pr)}%</b></div>
      <div class="bar"><i style="width:${pr}%"></i></div>
      <div class="goal-actions"><button class="goal-fund" onclick="fundGoal(${g.id})">＋ Пополнить</button><button class="mini" onclick="editGoal(${g.id})">Изменить</button><button class="mini" onclick="delGoal(${g.id})">Удалить</button></div>
    </div>`;
  }).join("") : `<div class="goal"><div class="muted">Создай первую цель.</div></div>`;

  const x = s.income[0];
  $("#last").innerHTML = x ? `
    <div class="muted">Последний доход · ${money(x.amount)}</div>
    ${s.plans.map(p => `<div class="alloc"><span>${esc(p.name)} · ${p.percent}%</span><b>${money(x.alloc?.[p.id] || 0)}</b></div>`).join("")}
    ${Object.entries(x.goals || {}).map(([gid, amount]) => { const g=s.goals.find(g=>String(g.id)===String(gid)); return g ? `<div class="alloc"><span>🎯 ${esc(g.name)}</span><b>${money(amount)}</b></div>` : ""; }).join("")}
    <div class="alloc"><span>Не распределено</span><b>${money(unallocatedForIncome(x))}</b></div>` : `<p>Пока нет новых доходов.</p>`;
}

function unallocatedForIncome(x) {
  const planUsed = Object.values(x.alloc || {}).reduce((a,b) => a + Number(b || 0), 0);
  const goalUsed = Object.values(x.goals || {}).reduce((a,b) => a + Number(b || 0), 0);
  return Math.max(0, x.amount - planUsed - goalUsed);
}

function incomeModal(prefill = 0) {
  const goalOptions = s.goals.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("");
  openModal("Новый доход", `
    <div class="field"><label>СУММА ДОХОДА</label><input id="incomeAmount" type="number" inputmode="decimal" placeholder="5000" value="${prefill || ""}"></div>
    <div id="incomePreview" class="preview">Введи сумму — Cashly покажет точное распределение.</div>
    <div class="goal-income-box">
      <div class="goal-income-title"><span>🎯 В цель</span><small>Можно оставить пустым</small></div>
      ${s.goals.length ? `<div class="goal-inline"><select id="incomeGoal">${goalOptions}</select><input id="incomeGoalAmount" type="number" inputmode="decimal" placeholder="0"></div>` : `<div class="muted">Сначала создай цель — тогда её можно будет пополнять прямо из нового дохода.</div>`}
    </div>
    <button class="primary" onclick="addIncome()">Добавить доход</button>`);
  updateIncomePreview();
}

$("#addIncome").onclick = () => incomeModal();
$("#heroAddIncome").onclick = () => incomeModal();
document.addEventListener("input", e => {
  if (["incomeAmount", "incomeGoalAmount"].includes(e.target.id)) updateIncomePreview();
});

document.addEventListener("change", e => {
  if (e.target.id === "incomeGoal") updateIncomePreview();
});

function updateIncomePreview() {
  const box = $("#incomePreview"); if (!box) return;
  const n = +$("#incomeAmount")?.value || 0;
  const goalAmount = +$("#incomeGoalAmount")?.value || 0;
  const planUsed = n * total() / 100;
  const left = n - planUsed - goalAmount;
  if (!n) { box.textContent = "Введи сумму — Cashly покажет точное распределение."; return; }
  box.innerHTML = s.plans.map(p => `${esc(p.name)} — <b>${money(n * p.percent / 100)}</b>`).join("<br>") +
    (goalAmount ? `<br><span class="preview-goal">🎯 В цель — <b>${money(goalAmount)}</b></span>` : "") +
    `<br><br>Останется не распределено — <b>${money(Math.max(0, left))}</b>` + (left < 0 ? `<br><span class="error">Сумма в цель слишком большая.</span>` : "");
}

function addIncome() {
  const n = +$("#incomeAmount").value;
  if (n <= 0) return toast("Введи сумму");
  const goalAmount = +$("#incomeGoalAmount")?.value || 0;
  const planUsed = n * total() / 100;
  if (goalAmount < 0 || planUsed + goalAmount > n + 0.001) return toast("В цель можно отправить только свободную сумму");
  const alloc = {};
  s.plans.forEach(p => alloc[p.id] = n * p.percent / 100);
  const goals = {};
  if (goalAmount && $("#incomeGoal")?.value) {
    const gid = Number($("#incomeGoal").value);
    const g = s.goals.find(x => x.id === gid);
    if (!g) return toast("Цель не найдена");
    g.saved = Number(g.saved || 0) + goalAmount;
    goals[gid] = goalAmount;
  }
  s.income.unshift({ id: Date.now(), amount: n, date: new Date().toISOString(), alloc, goals });
  save(); closeModal(); render(); toast("Доход добавлен");
}

function setupStart() {
  openModal("Твой стартовый капитал", `
    <div class="field"><label>СТАРТОВЫЙ КАПИТАЛ, ₽</label><input id="startAmount" type="number" inputmode="decimal" min="0" step="0.01" value="5000" placeholder="5000"></div>
    <div class="preview">Укажи общую сумму денег, с которой начинаешь пользоваться Cashly.</div>
    <button class="primary" onclick="setupAlloc()">Продолжить</button>`);
}
function setupAlloc() {
  const n = Number($("#startAmount").value);
  if (!Number.isFinite(n) || n < 0) return toast("Введи корректную сумму");
  openModal("Что уже есть и что распределить", "");
  const options = s.plans.map((p,i)=>`<option value="${p.id}" ${i===0?"selected":""}>${esc(p.name)}</option>`).join("");
  $("#modalBody").innerHTML = `
    <div class="preview"><b>Важно:</b> сумма «Уже распределено» уже находится в выбранной категории и не распределяется повторно. Cashly возьмёт только остаток и распределит его по твоим процентам.</div>
    <div class="field"><label>СТАРТОВЫЙ КАПИТАЛ, ₽</label><div class="preview"><b>${moneyPrecise(n)}</b></div></div>
    <div class="field"><label>УЖЕ РАСПРЕДЕЛЕНО, ₽</label><input id="startAllocated" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0"></div>
    <div class="field"><label>КУДА УЖЕ РАСПРЕДЕЛЕНО</label><select id="startAllocatedPlan">${options}</select></div>
    <div id="startPreview" class="preview">Введи уже распределённую сумму.</div>
    <button id="finishStartBtn" class="primary" onclick="finishStart(${JSON.stringify(n)})">Завершить настройку</button>`;
  const inp=$("#startAllocated");
  const select=$("#startAllocatedPlan");
  inp.addEventListener("input",()=>updateStartPreview(n));
  select.addEventListener("change",()=>updateStartPreview(n));
  updateStartPreview(n);
}
function calcStartAlloc(n, allocated, allocatedPlanId) {
  const remainder = Math.max(0,n-allocated);
  const alloc = {};
  const pct = total();
  s.plans.forEach(p => {
    const extra = remainder * Number(p.percent||0) / 100;
    alloc[p.id] = extra + (String(p.id) === String(allocatedPlanId) ? allocated : 0);
  });
  return {alloc,remainder,unallocated:Math.max(0,remainder * (1-pct/100))};
}
function updateStartPreview(n) {
  const box=$("#startPreview"); if(!box)return;
  const allocated=Number($("#startAllocated").value)||0;
  const planId=$("#startAllocatedPlan").value;
  if(allocated<0 || allocated>n) {
    box.innerHTML=`<span class="error">Уже распределённая сумма должна быть от 0 до ${moneyPrecise(n)}.</span>`;
    return;
  }
  const result=calcStartAlloc(n,allocated,planId);
  const selectedPlan=s.plans.find(p=>String(p.id)===String(planId));
  box.innerHTML=`<div><b>${allocated>0 ? `Уже в «${esc(selectedPlan?.name||"категории")}` : "Уже распределено"}:</b> ${moneyPrecise(allocated)}</div>`+
    `<div><b>Осталось распределить:</b> ${moneyPrecise(result.remainder)}</div>`+
    `<div style="margin-top:8px"><b>После настройки получится:</b></div>`+
    s.plans.map(p=>`${esc(p.name)} — <b>${moneyPrecise(result.alloc[p.id]||0)}</b>`).join("<br>")+
    (result.unallocated>0.005 ? `<br><br>Останется свободно — <b>${moneyPrecise(result.unallocated)}</b>` : "");
  const btn=$("#finishStartBtn");
  if(btn) btn.textContent=`Распределить ${moneyPrecise(result.remainder)} и завершить`;
}
function finishStart(n) {
  const allocated=Number($("#startAllocated").value)||0;
  const planId=$("#startAllocatedPlan").value;
  if(!Number.isFinite(allocated)||allocated<0||allocated>n) return toast("Проверь сумму");
  const result=calcStartAlloc(n,allocated,planId);
  s.start={amount:n,alloc:result.alloc}; s.setup=true; save(); closeModal(); render(); toast("Cashly настроен");
}

function editPlan(id) {
  const p = s.plans.find(x => x.id === id);
  openModal("Изменить категорию", `<div class="field"><label>НАЗВАНИЕ</label><input id="pn" value="${esc(p.name)}"></div><div class="field"><label>ПРОЦЕНТ</label><input id="pp" type="number" inputmode="decimal" value="${p.percent}"></div><div class="field"><label>ЗНАЧОК</label><input id="pi" value="${esc(p.icon)}"></div><button class="primary" onclick="savePlan(${id})">Сохранить</button>`);
}
function savePlan(id) {
  const p = s.plans.find(x => x.id === id), n = $("#pn").value.trim(), v = +$("#pp").value;
  if (!n || v < 0 || v > 100) return toast("Проверь название и процент");
  if (total() - p.percent + v > 100) return toast("Общий процент не может быть больше 100%");
  p.name=n; p.percent=v; p.icon=$("#pi").value || "•"; save(); closeModal(); render();
}
function delPlan(id) { if (s.plans.length < 2) return toast("Нужна хотя бы одна категория"); s.plans=s.plans.filter(p=>p.id!==id); save(); render(); }
function createPlan() {
  const n=$("#pn").value.trim(), v=+$("#pp").value;
  if(!n || v<0 || total()+v>100) return toast("Проверь название и общий процент");
  s.plans.push({id:Date.now(),name:n,percent:v,icon:$("#pi").value||"•"}); save(); closeModal(); render();
}
$("#addPlan").onclick=()=>openModal("Новая категория",`<div class="field"><label>НАЗВАНИЕ</label><input id="pn" placeholder="Отдых"></div><div class="field"><label>ПРОЦЕНТ</label><input id="pp" type="number" inputmode="decimal" value="10"></div><div class="field"><label>ЗНАЧОК</label><input id="pi" value="•"></div><button class="primary" onclick="createPlan()">Сохранить</button>`);

function goalForm(id) {
  const g=id?s.goals.find(x=>x.id===id):{name:"",target:0,saved:0};
  openModal(id?"Изменить цель":"Новая цель", `<div class="field"><label>ЦЕЛЬ</label><input id="gn" value="${esc(g.name)}" placeholder="Новый компьютер"></div><div class="field"><label>СУММА ЦЕЛИ</label><input id="gt" type="number" inputmode="decimal" value="${g.target||""}"></div><div class="field"><label>УЖЕ НАКОПЛЕНО</label><input id="gs" type="number" inputmode="decimal" value="${g.saved||""}"></div><button class="primary" onclick="saveGoal(${id||0})">Сохранить</button>`);
}
function saveGoal(id) {
  const n=$("#gn").value.trim(), t=+$("#gt").value, sv=+$("#gs").value||0;
  if(!n||t<=0||sv<0) return toast("Заполни цель");
  if(id){ const g=s.goals.find(x=>x.id===id); Object.assign(g,{name:n,target:t,saved:sv}); }
  else s.goals.push({id:Date.now(),name:n,target:t,saved:sv});
  save(); closeModal(); render();
}
function editGoal(id){goalForm(id)}
function delGoal(id){s.goals=s.goals.filter(g=>g.id!==id); s.income.forEach(x=>{ if(x.goals) delete x.goals[id]; }); save(); render(); }
function availableForGoals() {
  const allocatedPlans = s.plans.reduce((sum,p)=>sum+currentAllocated(p.id),0);
  const allocatedGoals = goalTotal();
  return Math.max(0, capitalTotal() - allocatedPlans - allocatedGoals);
}
function fundGoal(id) {
  const g=s.goals.find(x=>x.id===id); if(!g) return;
  const free = availableForGoals();
  openModal(`Пополнить «${esc(g.name)}»`, `<div class="goal-fund-big"><div class="muted">Сейчас накоплено</div><b>${money(g.saved)}</b><div class="preview">Свободно для новых пополнений: <b>${money(free)}</b></div><div class="field"><label>СКОЛЬКО ДОБАВИТЬ</label><input id="fundAmount" type="number" inputmode="decimal" placeholder="10000" max="${free}"></div></div><button class="primary" onclick="saveGoalFund(${id})">Пополнить цель</button>`);
}
function saveGoalFund(id) {
  const amount=+$("#fundAmount").value; if(amount<=0) return toast("Введи сумму");
  const g=s.goals.find(x=>x.id===id); if(!g) return;
  const free=availableForGoals();
  if(amount>free+0.001) return toast(`Свободно только ${money(free)}`);
  g.saved=Number(g.saved||0)+amount;
  s.goalTopups ||= []; s.goalTopups.unshift({id:Date.now(),goalId:id,amount,date:new Date().toISOString()});
  save(); closeModal(); render(); toast("Цель пополнена");
}
$("#addGoal").onclick=()=>goalForm();

function showScreen(name){
  if(name==="home"){location.reload();return;}
  $("#app").classList.add("hidden"); $("#screen").classList.remove("hidden");
  $("#screenTitle").textContent={history:"История",analytics:"Аналитика",settings:"Настройки"}[name];
  $("#screenKicker").textContent={history:"ДВИЖЕНИЕ ДЕНЕГ",analytics:"ОБЗОР",settings:"CASHLY"}[name];
  if(name==="history"){
    let rows=`<div class="card history-card"><div class="alloc"><span>Стартовый капитал</span><b>${money(s.start.amount)}</b></div>`;
    rows += s.income.length ? s.income.map(x=>`<div class="history-item"><div class="alloc"><span>Доход · ${new Date(x.date).toLocaleDateString("ru-RU")}</span><b>${money(x.amount)}</b></div><div class="history-details">${s.plans.map(p=>`<div><span>${esc(p.name)}</span><b>${money(x.alloc?.[p.id]||0)}</b></div>`).join("")}${Object.entries(x.goals||{}).map(([gid,a])=>{const g=s.goals.find(z=>String(z.id)===String(gid));return g?`<div><span>🎯 ${esc(g.name)}</span><b>${money(a)}</b></div>`:""}).join("")}<div><span>Не распределено</span><b>${money(unallocatedForIncome(x))}</b></div></div></div>`).join("") : `<p class="muted">Новых доходов пока нет.</p>`;
    if(s.goalTopups?.length){ rows += `<div class="card history-card"><div class="name">Пополнения целей</div>${s.goalTopups.map(t=>{const g=s.goals.find(z=>z.id===t.goalId);return g?`<div class="alloc"><span>🎯 ${esc(g.name)} · ${new Date(t.date).toLocaleDateString("ru-RU")}</span><b>${money(t.amount)}</b></div>`:""}).join("")}</div>`; }
    rows += `</div>`; $("#screenBody").innerHTML=rows;
  } else if(name==="analytics"){
    const inc=incomeTotal(), start=Number(s.start.amount||0);
    $("#screenBody").innerHTML=`<div class="card"><div class="name">Общий капитал</div><h1>${money(start+inc)}</h1><div class="muted">Стартовый капитал: ${money(start)}</div><div class="muted">Новые доходы: ${money(inc)}</div><div class="muted">Всего поступило: ${money(start+inc)}</div><div class="muted">В цели направлено: ${money(goalTotal())}</div><div class="muted">Текущий план: ${total()}% распределения</div></div>`;
  } else {
    $("#screenBody").innerHTML=`<div class="card" style="padding:18px"><div class="name">Тема интерфейса</div><div class="themegrid" style="margin-top:12px"><button onclick="setTheme('purple')">🟣 Violet</button><button onclick="setTheme('blue')">🔵 Ocean</button><button onclick="setTheme('green')">🟢 Emerald</button><button onclick="setTheme('pink')">🌸 Pink</button><button onclick="setTheme('light')">⚪ Light</button></div></div><div class="card danger-card"><div class="name">Сбросить Cashly</div><div class="muted">Удалит все категории, цели, доходы и стартовый капитал на этом устройстве.</div><button class="reset-btn" onclick="resetApp()">Сбросить всё</button></div>`;
  }
}
function setTheme(x){s.theme=x;save();applyTheme();showScreen("settings")}
function resetApp(){
  openModal("Сбросить всё?", `
    <div class="preview">Все категории, цели, доходы, настройки и стартовый капитал будут удалены. Это действие нельзя отменить.</div>
    <div class="actions">
      <button class="mini" onclick="closeModal()">Отмена</button>
      <button class="reset-btn" onclick="confirmResetApp()">Да, сбросить всё</button>
    </div>`);
}
function confirmResetApp(){
  localStorage.removeItem(K);
  closeModal();
  location.reload();
}
$("#back").onclick=()=>{$("#screen").classList.add("hidden");$("#app").classList.remove("hidden");document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));document.querySelector('nav button[data-screen="home"]').classList.add("active")};
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");showScreen(b.dataset.screen)});

render(); if(!s.setup) setTimeout(setupStart,300);
