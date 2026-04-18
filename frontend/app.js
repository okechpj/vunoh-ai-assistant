// Base backend URL (adjust if backend runs on different host/port)
const BASE = (window.__API_BASE__ || 'http://localhost:3000/api');
const API = {
  create: `${BASE}/request`,
  tasks: `${BASE}/tasks`,
  task: (id) => `${BASE}/tasks/${id}`,
  status: (id) => `${BASE}/tasks/${id}/status`
};

// Elements
const userInput = document.getElementById('userInput');
const submitBtn = document.getElementById('submitBtn');
const formFeedback = document.getElementById('formFeedback');
const tasksContainer = document.getElementById('tasksContainer');
const emptyState = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');

// Modal
const taskModal = document.getElementById('taskModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModal = document.getElementById('closeModal');
const detailTaskCode = document.getElementById('detailTaskCode');
const detailIntent = document.getElementById('detailIntent');
const detailRisk = document.getElementById('detailRisk');
const detailAssigned = document.getElementById('detailAssigned');
const detailTimestamp = document.getElementById('detailTimestamp');
const entitiesList = document.getElementById('entitiesList');
const stepsList = document.getElementById('stepsList');
const tabButtons = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const statusSelect = document.getElementById('statusSelect');
const updateStatusBtn = document.getElementById('updateStatusBtn');
const statusFeedback = document.getElementById('statusFeedback');

let currentTaskId = null;

// Utilities
function showFeedback(el, message, success = true) {
  el.textContent = message;
  el.style.color = success ? '' : 'var(--danger)';
  setTimeout(() => { el.textContent = '' }, 4000);
}

function formatTimestamp(ts){
  if(!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString();
}

function riskClass(score){
  if(score == null) return 'medium';
  // score is 0-100
  if (score < 30) return 'low';
  if (score < 70) return 'medium';
  return 'high';
}

// Fetch wrapper
async function fetchJson(url, opts = {}){
  const headers = { 'Content-Type': 'application/json' };
  // CORS-friendly: fetch to backend running on a different origin
  const cfg = Object.assign({ headers, mode: 'cors', credentials: 'omit' }, opts);
  const res = await fetch(url, cfg);
  if(!res.ok){
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// API functions
async function createTask(input){
  return fetchJson(API.create, { method: 'POST', body: JSON.stringify({ userInput: input }) });
}
async function fetchTasks(){
  return fetchJson(API.tasks);
}
async function fetchTask(id){
  return fetchJson(API.task(id));
}
async function patchStatus(id, status){
  return fetchJson(API.status(id), { method: 'PATCH', body: JSON.stringify({ status }) });
}

// Renderers
function renderTasks(tasks){
  tasksContainer.innerHTML = '';
  if(!tasks || tasks.length === 0){
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  tasks.forEach(t => {
    const card = document.createElement('article');
    card.className = 'task-card';
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="task-top">
        <div class="task-code">${t.task_code}</div>
        <div class="intent-badge">${t.intent || 'unknown'}</div>
      </div>
      <div class="task-meta">
        <div class="risk ${riskClass(t.risk_score)}">${(t.risk_score!=null?Math.round(t.risk_score):'—')}%</div>
        <div class="status">${t.status || 'Pending'}</div>
        <div>${t.assigned_team || 'Unassigned'}</div>
        <div>${formatTimestamp(t.timestamp)}</div>
      </div>
    `;

    card.addEventListener('click', ()=> openTask(t.id));
    card.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') openTask(t.id) });
    tasksContainer.appendChild(card);
  });
}

async function renderTaskDetail(task){
  currentTaskId = task.id;
  detailTaskCode.textContent = task.task_code || '-';
  detailIntent.textContent = task.intent || '-';
  detailIntent.className = 'badge';
  detailRisk.textContent = task.risk_score!=null?Math.round(task.risk_score)+'%':'-';
  detailRisk.className = 'risk '+riskClass(task.risk_score);
  detailAssigned.textContent = task.assigned_team || 'Unassigned';
  detailTimestamp.textContent = formatTimestamp(task.timestamp);

  // Entities
  entitiesList.innerHTML = '';
  const entities = task.entities || {};
  Object.keys(entities).forEach(k => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = entities[k] === null ? '-' : String(entities[k]);
    entitiesList.appendChild(dt); entitiesList.appendChild(dd);
  });

  // Steps
  stepsList.innerHTML = '';
  const steps = task.steps || [];
  if(steps.length === 0){
    const li = document.createElement('li'); li.textContent = 'No steps available'; stepsList.appendChild(li);
  } else {
    steps.forEach(s => { const li = document.createElement('li'); li.textContent = s; stepsList.appendChild(li); });
  }

  // Messages
  const whatsappPanel = document.querySelector('[data-panel="whatsapp"]');
  const emailPanel = document.querySelector('[data-panel="email"]');
  const smsPanel = document.querySelector('[data-panel="sms"]');
  whatsappPanel.innerHTML = ''; emailPanel.innerHTML=''; smsPanel.innerHTML='';
  const messages = task.messages || {};
  whatsappPanel.innerHTML = messages.whatsapp ? renderChatBubble(messages.whatsapp) : '<div class="bubble">-</div>';
  emailPanel.textContent = messages.email || '-';
  smsPanel.textContent = messages.sms || '-';

  // status select
  statusSelect.value = task.status || 'Pending';

  // show modal
  openModal();
}

function renderChatBubble(text){
  // simple split by line
  const lines = String(text).split('\n');
  return lines.map(l => `<div class="bubble">${escapeHtml(l)}</div>`).join('');
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }

// Interactions
async function loadAndRender(){
  tasksContainer.innerHTML = '<div class="feedback">Loading…</div>';
  try{
    const tasks = await fetchTasks();
    renderTasks(tasks);
  }catch(err){
    tasksContainer.innerHTML = `<div class="empty">Error loading tasks: ${escapeHtml(String(err.message))}</div>`;
  }
}

async function handleSubmit(e){
  e.preventDefault();
  const input = userInput.value.trim();
  if(!input){ showFeedback(formFeedback, 'Please enter a request', false); return; }
  submitBtn.disabled = true; submitBtn.textContent = 'Processing…';
  try{
    await createTask(input);
    showFeedback(formFeedback, 'Request submitted', true);
    userInput.value = '';
    await loadAndRender();
  }catch(err){
    showFeedback(formFeedback, 'Failed to submit: '+err.message, false);
  }finally{ submitBtn.disabled = false; submitBtn.textContent = 'Submit Request' }
}

async function openTask(id){
  try{
    const task = await fetchTask(id);
    await renderTaskDetail(task);
  }catch(err){ alert('Failed to load task: '+err.message) }
}

function openModal(){ taskModal.setAttribute('aria-hidden','false'); taskModal.style.display='flex' }
function closeModalFn(){ taskModal.setAttribute('aria-hidden','true'); taskModal.style.display='none' }

// Tab behavior
tabButtons.forEach(btn => btn.addEventListener('click', ()=>{
  tabButtons.forEach(b=>b.classList.remove('active'));
  panels.forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.getAttribute('data-tab');
  document.querySelector(`[data-panel="${tab}"]`).classList.add('active');
}));

// status update
async function handleStatusUpdate(){
  if(!currentTaskId) return;
  updateStatusBtn.disabled = true; statusFeedback.textContent = 'Updating…';
  try{
    await patchStatus(currentTaskId, statusSelect.value);
    statusFeedback.textContent = 'Updated';
    // optimistic UI refresh
    await loadAndRender();
    setTimeout(()=>{ statusFeedback.textContent = '' }, 2000);
  }catch(err){ statusFeedback.textContent = 'Failed: '+err.message }
  finally{ updateStatusBtn.disabled = false }
}

// Events
document.getElementById('requestForm').addEventListener('submit', handleSubmit);
refreshBtn.addEventListener('click', loadAndRender);
modalBackdrop.addEventListener('click', closeModalFn);
closeModal.addEventListener('click', closeModalFn);
updateStatusBtn.addEventListener('click', handleStatusUpdate);

// Init
loadAndRender();
