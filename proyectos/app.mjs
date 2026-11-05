import { schedule, previewMove, comparePlans, dayNumber } from './domain.mjs';
import { makeBlink } from './blink.mjs';
import { toProjectXml } from './xml.mjs';
import { planForRecipient } from './disclosure.mjs';
import { createCloud } from './cloud.mjs';
import { cloudConfig } from './cloud-config.mjs';

const $ = id => document.getElementById(id);
const clone = value => structuredClone(value);
const id = () => crypto.randomUUID();
const iso = time => new Date(time).toISOString().slice(0, 10);
const day = 86400000;
const money = amount => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'USD' }).format(amount);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const message = value => { $('status').textContent = value; };
const storeKey = 'dm-planner-v1';
const selectionKey = 'dm-planner-selected';
const shareToken = new URLSearchParams(location.hash.slice(1)).get('share');
const readonly = shareToken !== null;
const cloud = cloudConfig.url && cloudConfig.key ? createCloud(cloudConfig) : null;
const empty = () => ({ name: 'Proyecto nuevo', start: iso(Date.now()), budget: 0, reserve: 0, tasks: [] });
const record = (working = empty()) => ({ id: id(), working, baseline: null, variant: null, report: {} });
let projects = [];
let savedSelection;
if (!readonly) {
  try {
    projects = JSON.parse(localStorage.getItem(storeKey)) || [];
    savedSelection = localStorage.getItem(selectionKey);
  } catch { projects = []; }
  if (!projects.length) projects.push(record());
}
let selected = (projects.find(project => project.id === savedSelection) ?? projects[0])?.id;
let view = 'working';
let editingId;
let pendingMove;
let history = [];
const current = () => projects.find(project => project.id === selected);
const plan = () => current()?.[view];
const editable = () => !readonly && view !== 'baseline';
const financeVisible = () => !readonly || current()?.financeVisible !== false;

function save() {
  try {
    localStorage.setItem(storeKey, JSON.stringify(projects));
    localStorage.setItem(selectionKey, selected);
  }
  catch { message('El navegador no pudo guardar los cambios en este equipo.'); }
}

function change(action) {
  history.push({ projects: clone(projects), selected, view });
  action();
  save();
  render();
}

function setFields(form, values) {
  for (const control of form.elements) {
    if (control.name && control.type !== 'checkbox') control.value = values[control.name] ?? '';
  }
}

function render() {
  const project = current();
  const data = plan();
  if (!data) return;
  const result = schedule(data);
  document.body.classList.toggle('readonly', readonly);
  $('mode').textContent = readonly ? 'Vista compartida · solo lectura' : 'Planificación';
  $('title').textContent = data.name;
  $('scope').innerHTML = [
    ['Alcance', data.scope], ['Exclusiones', data.exclusions],
  ].filter(([, value]) => value).map(([label, value]) => `<p><b>${label}</b> ${escape(value)}</p>`).join('');
  $('projects').replaceChildren(...projects.map(item => new Option(item.working.name, item.id)));
  $('projects').value = selected;
  $('plan').replaceChildren(...[['working', 'Plan de trabajo'], ['baseline', 'Línea base'], ['variant', 'Variante']]
    .filter(([key]) => project[key]).map(([key, label]) => new Option(label, key)));
  $('plan').value = view;
  $('settings').hidden = !editable();
  setFields($('settings'), data);
  setFields($('report'), project.report);
  $('add').disabled = !editable();
  $('undo').disabled = !history.length;
  $('variant').disabled = !project.baseline || Boolean(project.variant);
  $('baseline').disabled = Boolean(project.baseline) || !data.tasks.length || Boolean(result.errors.length || result.warnings.length);
  const metrics = [
    ['Cierre estimado', result.finish || '—'],
    ['Duración', `${result.duration} días`],
  ];
  if (financeVisible()) {
    metrics.push(['Total con reserva', money(result.total)]);
    if (data.budget) metrics.push(['Disponible', money(data.budget - result.total)]);
  }
  $('metrics').innerHTML = metrics.map(([label, value]) =>
    `<div class="metric">${label}<b>${escape(value)}</b></div>`).join('');
  $('issues').textContent = [...result.errors, ...result.warnings].join(' · ');
  renderComparison(project);
  $('cashflow-section').hidden = !financeVisible();
  if (financeVisible()) renderCashflow(project, result);
  renderCalendar(data, result);
  const names = new Map(result.tasks.map(task => [task.id, task.code || task.name]));
  $('critical').innerHTML = result.criticalPaths.length
    ? `<ul>${result.criticalPaths.map(path => `<li>${path.map(key => escape(names.get(key))).join(' → ')}</li>`).join('')}</ul>`
    : '<p>Vinculá las tareas para ver las ramas críticas.</p>';
}

let editingPayment = null;
const cents = amount => Math.round(amount * 100);
const amountText = amount => money(amount / 100);
const taskLabel = task => [task.code, task.name].filter(Boolean).join(' · ');

function taskMap(...plans) {
  return new Map(plans.flatMap(data => (data?.tasks ?? []).filter(task => task.kind !== 'group')
    .map(task => [task.id, task])));
}

function paymentTotals(payments, group) {
  const totals = new Map();
  for (const payment of payments) {
    const key = group(payment);
    totals.set(key, (totals.get(key) ?? 0) + cents(payment.amount));
  }
  return totals;
}

function costTable(label, columns, rows, totals, empty) {
  const amounts = values => values.map(value => `<td>${amountText(value)}</td>`).join('');
  return `<h3>${label}</h3>${rows.length ? `<table aria-label="${label}"><thead><tr>
    ${columns.map(column => `<th scope="col">${column}</th>`).join('')}</tr></thead><tbody>${
    rows.map(([name, ...values]) => `<tr><th scope="row">${escape(name)}</th>${amounts(values)}</tr>`).join('')
  }</tbody><tfoot><tr><th scope="row">Total</th>${amounts(totals)}</tr></tfoot></table>` : `<p>${empty}</p>`}`;
}

function setPaymentTasks() {
  const form = $('payment-form');
  const { kind, taskId } = form.elements;
  const project = current();
  const tasks = kind.value === 'actual'
    ? taskMap(project.baseline, project.working, project.variant, plan())
    : taskMap(plan());
  const selectedTask = taskId.value;
  taskId.replaceChildren(new Option('Elegí una tarea', ''), ...Array.from(tasks.values(),
    task => new Option(taskLabel(task), task.id)));
  taskId.value = tasks.has(selectedTask) ? selectedTask : '';
  $('save-payment').disabled = tasks.size === 0;
  return tasks;
}

function renderCashflow(project, result) {
  const form = $('payment-form');
  const showDetails = $('cashflow').querySelector('details')?.open;
  editingPayment = null;
  form.reset();
  form.elements.kind.disabled = false;
  $('save-payment').textContent = 'Agregar pago';
  $('cancel-payment').hidden = true;
  form.hidden = !editable();
  setPaymentTasks();

  const tasks = new Map(result.tasks.filter(task => task.kind !== 'group').map(task => [task.id, task]));
  const allTasks = taskMap(project.baseline, project.working, project.variant, plan());
  const nameFor = key => allTasks.has(key) ? taskLabel(allTasks.get(key)) : 'Tarea no disponible';
  const planned = plan().payments ?? [];
  const actual = readonly ? [] : (project.actualPayments ?? []);
  const monthOf = payment => payment.date.slice(0, 7);
  const plannedMonths = paymentTotals(planned, monthOf);
  const actualMonths = paymentTotals(actual, monthOf);
  const plannedTasks = paymentTotals(planned, payment => payment.taskId);
  const actualTasks = paymentTotals(actual, payment => payment.taskId);
  const sum = totals => [...totals.values()].reduce((total, amount) => total + amount, 0);
  const plannedTotal = sum(plannedMonths);
  const actualTotal = sum(actualMonths);
  const months = [...new Set([...plannedMonths.keys(), ...actualMonths.keys()])].sort();

  const monthly = costTable('Pagos por mes', readonly ? ['Mes', 'Planificado'] : ['Mes', 'Planificado', 'Real', 'Real − plan'],
    months.map(month => {
      const expected = plannedMonths.get(month) ?? 0;
      const paid = actualMonths.get(month) ?? 0;
      return readonly ? [month, expected] : [month, expected, paid, paid - expected];
    }), readonly ? [plannedTotal] : [plannedTotal, actualTotal, actualTotal - plannedTotal],
    'Todavía no hay pagos registrados.');

  let pending = 0;
  let excess = 0;
  let estimatedTotal = 0;
  const taskRows = [...new Set([...tasks.keys(), ...plannedTasks.keys(), ...actualTasks.keys()])].map(key => {
    const estimated = cents(tasks.get(key)?.totalCost ?? 0);
    const scheduled = plannedTasks.get(key) ?? 0;
    const paid = actualTasks.get(key) ?? 0;
    estimatedTotal += estimated;
    pending += Math.max(0, estimated - scheduled);
    excess += Math.max(0, scheduled - estimated);
    return readonly ? [nameFor(key), estimated, scheduled] : [nameFor(key), estimated, scheduled, paid, paid - estimated];
  });
  const byTask = costTable('Costos por tarea', readonly ? ['Tarea', 'Costo previsto', 'Pago planificado'] :
    ['Tarea', 'Costo previsto', 'Pago planificado', 'Pago real', 'Real − costo previsto'],
    taskRows, readonly ? [estimatedTotal, plannedTotal] : [estimatedTotal, plannedTotal, actualTotal, actualTotal - estimatedTotal],
    'Agregá tareas para ver su costo previsto.');

  const entries = [...planned.map(payment => ({ payment, kind: 'planned' })),
    ...actual.map(payment => ({ payment, kind: 'actual' }))].sort((a, b) => a.payment.date.localeCompare(b.payment.date));
  const detail = entries.length ? `<details ${showDetails ? 'open' : ''}><summary>Ver pagos registrados</summary>
    <table><thead><tr><th>Fecha</th><th>Tarea</th><th>Tipo</th><th>Importe</th>${editable() ? '<th>Acciones</th>' : ''}</tr></thead><tbody>${
    entries.map(({ payment, kind }) => `<tr><td>${escape(payment.date)}</td><td>${escape(nameFor(payment.taskId))}</td>
      <td>${kind === 'actual' ? 'Real' : 'Planificado'}</td><td>${money(payment.amount)}</td>${editable() ? `<td>
      <button data-kind="${kind}" data-edit-payment="${escape(payment.id)}">Editar</button>
      <button data-kind="${kind}" data-delete-payment="${escape(payment.id)}">Eliminar</button></td>` : ''}</tr>`).join('')
  }</tbody></table></details>` : '';
  $('cashflow').innerHTML = `<p>Pagos programados <b>${amountText(plannedTotal)}</b> · Costo por programar <b>${amountText(pending)}</b> · Reserva <b>${money(plan().reserve ?? 0)}</b></p>
    ${excess ? `<p>Los pagos planificados superan el costo previsto de una o más tareas en ${amountText(excess)}.</p>` : ''}
    ${monthly}${byTask}${detail}`;
}

$('payment-form').elements.kind.onchange = setPaymentTasks;
$('payment-form').onsubmit = event => {
  event.preventDefault();
  if (!editable()) return;
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  const kind = editingPayment?.kind ?? fields.kind;
  const amount = Number(fields.amount);
  if (!Number.isFinite(dayNumber(fields.date)) || !Number.isSafeInteger(cents(amount)) || amount < 0.01 ||
      !setPaymentTasks().has(fields.taskId)) return;
  const payment = { taskId: fields.taskId, date: fields.date, amount: cents(amount) / 100, id: editingPayment?.id ?? id() };
  const owner = kind === 'actual' ? current() : plan();
  const key = kind === 'actual' ? 'actualPayments' : 'payments';
  change(() => {
    owner[key] = [...(owner[key] ?? []).filter(item => item.id !== payment.id), payment];
  });
};

$('cancel-payment').onclick = () => renderCashflow(current(), schedule(plan()));
$('cashflow').onclick = event => {
  if (!editable()) return;
  const { editPayment, deletePayment, kind } = event.target.dataset;
  const owner = kind === 'actual' ? current() : plan();
  const key = kind === 'actual' ? 'actualPayments' : 'payments';
  if (editPayment) {
    const payment = owner[key]?.find(item => item.id === editPayment);
    if (!payment) return;
    editingPayment = { id: payment.id, kind };
    const form = $('payment-form');
    form.elements.kind.value = kind;
    form.elements.kind.disabled = true;
    setPaymentTasks();
    setFields(form, { ...payment, kind });
    $('save-payment').textContent = 'Guardar pago';
    $('cancel-payment').hidden = false;
    form.elements.date.focus();
  }
  if (deletePayment) change(() => {
    owner[key] = owner[key].filter(item => item.id !== deletePayment);
  });
};

function renderComparison(project) {
  const target = $('comparison');
  target.replaceChildren();
  if (!project.variant) return;
  const baseline = schedule(project.baseline);
  const variant = schedule(project.variant);
  const difference = (before, after) => {
    const delta = (after ?? 0) - (before ?? 0);
    return delta === 0 ? 'Sin cambio' : `${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}`;
  };
  const rows = [['Cierre del proyecto', baseline.finish, variant.finish, '—'],
    ['Total con reserva', money(baseline.total), money(variant.total), difference(baseline.total, variant.total)]];
  const variantTasks = new Map(variant.tasks.map(task => [task.id, task]));
  for (const milestone of baseline.tasks.filter(task => task.kind === 'milestone')) {
    rows.push([milestone.name, milestone.start, variantTasks.get(milestone.id)?.start || 'Eliminado', '—']);
  }
  for (const { name, from, to } of comparePlans(baseline, variant)) {
    const task = to ?? from;
    rows.push([[task.code, name].filter(Boolean).join(' · '), from ? summary(from) : 'Sin tarea',
      to ? summary(to) : 'Eliminada', difference(from?.totalCost, to?.totalCost)]);
  }
  target.innerHTML = '<h2>Línea base y variante</h2><div class="comparison-scroll"><table><thead><tr><th>Concepto</th><th>Original</th><th>Variante</th><th>Variación de costo</th></tr></thead><tbody>' +
    rows.map(([label, ...values]) => `<tr><th scope="row">${escape(label)}</th>${values.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
}

const summary = task => `${task.start || '—'} a ${task.finish || '—'} · ${task.duration} d · ${task.float ?? '—'} d de holgura${financeVisible() ? ` · ${money(task.totalCost)}` : ''}`;

function renderCalendar(data, result) {
  const calendar = $('calendar');
  const scroll = calendar.scrollLeft;
  const days = Math.min(730, Math.max(21, result.duration + 7));
  calendar.style.setProperty('--days', days);
  calendar.replaceChildren();
  const start = Date.parse(data.start);
  const dates = document.createElement('div');
  dates.className = 'calendar-row head';
  dates.innerHTML = '<span class="task-label">Tarea / hito</span>';
  for (let index = 0; index < days; index++) {
    const date = iso(start + index * day);
    const button = document.createElement('button');
    button.className = 'date-cell';
    button.style.gridColumn = index + 2;
    button.textContent = index === 0 || date.endsWith('-01') ? date.slice(5).split('-').reverse().join('/') : date.slice(8);
    button.setAttribute('aria-label', date);
    button.title = date;
    button.disabled = !editable();
    button.onclick = () => openTask(null, date);
    dates.append(button);
  }
  calendar.append(dates);
  for (const task of result.tasks) {
    const row = document.createElement('div');
    row.className = 'calendar-row';
    const label = document.createElement(editable() ? 'button' : 'span');
    label.className = 'task-label';
    label.textContent = [task.code, task.name].filter(Boolean).join(' · ');
    label.title = label.textContent;
    if (editable()) label.onclick = () => openTask(task.id);
    row.append(label);
    const offset = (Date.parse(task.start) - start) / day;
    const span = (Date.parse(task.finish) - Date.parse(task.start)) / day + 1;
    if (Number.isInteger(offset) && offset >= 0 && offset < days) {
      const bar = document.createElement('span');
      bar.className = `bar ${task.kind} ${task.critical ? 'critical' : ''}`;
      bar.style.gridColumn = `${offset + 2} / span ${Math.min(days - offset, Math.max(1, span))}`;
      bar.textContent = task.kind === 'milestone' ? '◆' : task.code || task.name;
      bar.title = [task.name, task.responsible, task.notes, summary(task)].filter(Boolean).join(' · ');
      if (editable() && task.kind !== 'group') bindDrag(bar, task);
      row.append(bar);
    }
    calendar.append(row);
  }
  calendar.scrollLeft = scroll;
}

function bindDrag(bar, task) {
  let start;
  bar.onpointerdown = event => {
    if (event.button !== 0) return;
    start = event.clientX;
    bar.setPointerCapture(event.pointerId);
  };
  bar.onpointermove = event => {
    if (start !== undefined) bar.style.transform = `translateX(${event.clientX - start}px)`;
  };
  bar.onpointercancel = () => { start = undefined; bar.style.transform = ''; };
  bar.onpointerup = event => {
    if (start === undefined) return;
    const shift = Math.round((event.clientX - start) / 30);
    start = undefined;
    bar.style.transform = '';
    if (shift) showMove(task.id, iso(Date.parse(task.start) + shift * day));
    else openTask(task.id);
  };
}

function showMove(taskId, date) {
  try {
    const next = previewMove(plan(), taskId, date);
    if (next.after.errors.length) throw new Error(next.after.errors.join(' · '));
    pendingMove = next.project;
    const before = new Map(next.before.tasks.map(task => [task.id, task]));
    const moved = next.after.tasks.filter(task => before.get(task.id)?.start !== task.start);
    $('impact').innerHTML = `<p>Cierre estimado <b>${escape(next.before.finish)} → ${escape(next.after.finish)}</b></p>
      <p>Total <b>${money(next.before.total)} → ${money(next.after.total)}</b></p>
      ${moved.length ? `<ul>${moved.map(task => `<li>${escape(task.name)} · ${escape(before.get(task.id)?.start)} → ${escape(task.start)}</li>`).join('')}</ul>`
        : '<p>Las dependencias conservan las fechas calculadas.</p>'}`;
    $('move-dialog').showModal();
  } catch (error) { message(error.message); }
}

function openTask(taskId, date) {
  editingId = taskId;
  const task = plan().tasks.find(item => item.id === taskId);
  const form = $('task');
  form.elements.parentId.replaceChildren(new Option('Sin grupo', ''), ...plan().tasks
    .filter(item => item.kind === 'group' && item.id !== taskId).map(item => new Option(item.name, item.id)));
  setFields(form, task || { kind: 'task', duration: 1, costMode: 'fixed', cost: 0, quantity: 1, rate: 0, notBefore: date });
  form.elements.timing.value = task?.atEnd ? 'end' : 'start';
  updateMilestoneTiming();
  const predecessors = new Map((task?.predecessors || []).map(link => [link.id, link.lag]));
  $('dependencies').innerHTML = plan().tasks.filter(item => item.kind !== 'group' && item.id !== taskId).map(item =>
    `<label class="dep"><input type="checkbox" value="${escape(item.id)}" ${predecessors.has(item.id) ? 'checked' : ''}>${escape(item.name)}
      <input type="number" min="0" step="1" value="${predecessors.get(item.id) ?? 0}" aria-label="Días de espera después de ${escape(item.name)}"></label>`).join('');
  $('delete').hidden = !task;
  $('task-error').textContent = '';
  $('task-dialog').showModal();
}

function updateMilestoneTiming() {
  $('milestone-timing').hidden = $('task').elements.kind.value !== 'milestone';
}

$('task').elements.kind.onchange = updateMilestoneTiming;
$('task').onsubmit = event => {
  event.preventDefault();
  const form = event.currentTarget;
  const { timing, ...fields } = Object.fromEntries(new FormData(form));
  const predecessors = [...$('dependencies').querySelectorAll('input:checked')].map(input =>
    ({ id: input.value, lag: Number(input.parentElement.querySelector('input[type=number]').value) }));
  const next = clone(plan());
  const task = {
    ...fields, id: editingId || id(), name: fields.name.trim(),
    sourceCodes: fields.sourceCodes.split(',').map(code => code.trim()).filter(Boolean),
    duration: fields.kind === 'task' ? Number(fields.duration) : 0,
    atEnd: fields.kind === 'milestone' && timing === 'end',
    predecessors: fields.kind === 'group' ? [] : predecessors,
    cost: Number(fields.cost), quantity: Number(fields.quantity), rate: Number(fields.rate),
  };
  if (!task.name) return;
  if (task.kind === 'group' && [...(next.payments ?? []), ...(current().actualPayments ?? [])].some(payment => payment.taskId === task.id)) {
    $('task-error').textContent = 'Reasigná o eliminá los pagos de esta tarea antes de convertirla en grupo.';
    return;
  }
  if (editingId) next.tasks = next.tasks.map(item => item.id === editingId ? task : item);
  else next.tasks.push(task);
  const result = schedule(next);
  if (result.errors.length) { $('task-error').textContent = result.errors.join(' · '); return; }
  $('task-dialog').close();
  change(() => { current()[view] = next; });
};

$('delete').onclick = () => {
  if ([...(plan().payments ?? []), ...(current().actualPayments ?? [])].some(payment => payment.taskId === editingId)) {
    $('task-error').textContent = 'Reasigná o eliminá los pagos de esta tarea antes de borrarla.';
    return;
  }
  if (!confirm('¿Eliminar la tarea y sus vínculos?')) return;
  $('task-dialog').close();
  change(() => {
    plan().tasks = plan().tasks.filter(task => task.id !== editingId).map(task => ({
      ...task, parentId: task.parentId === editingId ? '' : task.parentId,
      predecessors: task.predecessors.filter(link => link.id !== editingId),
    }));
  });
};
$('apply-move').onclick = () => {
  $('move-dialog').close();
  change(() => { current()[view] = pendingMove; });
};
document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => button.closest('dialog').close(); });
$('settings').onsubmit = event => {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  const updated = { ...plan(), ...fields, budget: Number(fields.budget), reserve: Number(fields.reserve) };
  const result = schedule(updated);
  if (result.errors.length) { message(result.errors.join(' · ')); return; }
  change(() => { current()[view] = updated; });
};
$('report').onsubmit = event => {
  event.preventDefault();
  change(() => { current().report = Object.fromEntries(new FormData(event.currentTarget)); });
};
$('new').onclick = () => change(() => {
  const project = record();
  projects.push(project); selected = project.id; view = 'working';
});
$('example').onclick = () => change(() => {
  const original = makeBlink();
  const project = record(original);
  project.baseline = clone(original);
  project.variant = makeBlink(true);
  projects.push(project); selected = project.id; view = 'variant';
});
$('projects').onchange = event => { selected = event.target.value; view = 'working'; save(); render(); };
$('plan').onchange = event => { view = event.target.value; render(); };
$('add').onclick = () => openTask();
$('undo').onclick = () => {
  const previous = history.pop();
  if (!previous) return;
  ({ projects, selected, view } = previous);
  save(); render();
};
$('baseline').onclick = () => change(() => { current().baseline = clone(plan()); view = 'baseline'; });
$('variant').onclick = () => change(() => { current().variant = clone(current().baseline); view = 'variant'; });

function download(contents, suffix, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = (plan().name.replace(/[^\p{L}\p{N}_ -]/gu, '') || 'Proyecto') + suffix;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function downloadMpp(snapshot) {
  const session = await requireCloudSession();
  if (!session) return;
  const response = await fetch('/api/mpp', { method: 'POST', headers: {
    'Content-Type': 'application/xml', Authorization: `Bearer ${session.access_token}`,
  }, body: toProjectXml(snapshot) });
  if (!response.ok) throw new Error(response.status === 503 ? 'El servicio de Microsoft Project todavía requiere configuración.' : 'No se pudo generar el archivo de Microsoft Project.');
  download(await response.blob(), '.mpp', 'application/octet-stream');
}
function downloadReport(options) {
  const { baseline, variant, working, report } = current();
  const lines = [working.name];
  if (options.notes) lines.push('Alcance', working.scope, 'Exclusiones', working.exclusions,
    'Evento', report.event, 'Decisión', report.response, 'Seguimiento', report.monitoring);
  for (const [label, data] of [['Plan de trabajo', working], ['Original', baseline], ['Adaptado', variant]]) {
    if (!data) continue;
    const result = schedule(data);
    lines.push(label, `Cierre ${result.finish}${options.finance ? ` · ${money(result.total)}` : ''}`);
  }
  download(lines.join('\n\n'), '_informe.txt', 'text/plain;charset=utf-8');
}

async function run(work) {
  try { await work(); }
  catch (error) { message(error.message); }
}

async function requireCloudSession() {
  if (!cloud) throw new Error('La publicación requiere configurar el servicio de proyectos.');
  const session = await cloud.session();
  if (session) {
    if (!(await cloud.canEdit())) throw new Error('Tu cuenta todavía no tiene acceso al editor en línea.');
    return session;
  }
  const email = prompt('Ingresá tu correo para recibir un enlace de acceso');
  if (!email) return null;
  await cloud.requestSignIn(email, location.origin + location.pathname);
  message('Revisá el correo y abrí el enlace de acceso.');
  return null;
}

async function saveRemote(project = current()) {
  const saved = await cloud.saveProject({
    id: project.cloudId, revision: project.cloudRevision, name: project.working.name, data: project,
  });
  project.cloudId = saved.id;
  project.cloudRevision = saved.revision;
  save();
  return saved;
}

$('cloud-save').onclick = () => run(async () => {
  if (!(await requireCloudSession())) return;
  await saveRemote();
  message('Proyecto guardado en línea.');
});
$('cloud-open').onclick = () => run(async () => {
  if (!(await requireCloudSession())) return;
  const saved = await cloud.listProjects();
  if (!saved.length) { message('No hay proyectos guardados en línea.'); return; }
  const choice = Number(prompt(saved.map((item, index) => `${index + 1}. ${item.name}`).join('\n')));
  const row = saved[choice - 1];
  if (!row) return;
  change(() => {
    const existing = projects.find(item => item.cloudId === row.id);
    const project = { ...row.data, id: existing?.id || id(), cloudId: row.id, cloudRevision: row.revision };
    projects = projects.filter(item => item.id !== project.id).concat(project);
    selected = project.id;
    view = 'working';
  });
});

async function sharePlan(snapshot, options) {
  const project = current();
  if (!(await requireCloudSession())) return;
  const saved = await saveRemote(project);
  const token = await cloud.publishShare({ projectId: saved.id, data: { working: snapshot, financeVisible: options.finance } });
  const url = new URL(location.href);
  url.search = '';
  url.hash = new URLSearchParams({ share: token }).toString();
  const link = document.createElement('a');
  link.href = url;
  link.textContent = 'Abrir enlace de solo lectura';
  const copy = document.createElement('button');
  copy.textContent = 'Copiar enlace';
  copy.onclick = () => run(async () => {
    await navigator.clipboard.writeText(url.href);
    copy.textContent = 'Enlace copiado';
  });
  $('status').replaceChildren(link, ' ', copy);
}

const disclosureActions = {
  share: ['Crear enlace de solo lectura', sharePlan],
  xml: ['Descargar XML', snapshot => download(toProjectXml(snapshot), '.xml', 'application/xml')],
  mpp: ['Descargar .mpp', downloadMpp],
  'report-download': ['Descargar informe', (_snapshot, options) => downloadReport(options)],
};
for (const [button, [label, action]] of Object.entries(disclosureActions)) {
  $(button).onclick = () => {
    const form = $('disclosure-form');
    form.reset();
    form.elements.resources.closest('label').hidden = button === 'report-download';
    $('disclosure-finance').textContent = button === 'share' ? 'Costos, presupuesto, reserva y pagos programados'
      : button === 'report-download' ? 'Totales de costo de los planes' : 'Costos de las tareas y reserva';
    $('disclosure-title').textContent = label;
    $('disclosure-plan').textContent = button === 'report-download'
      ? 'El informe resume las fechas de los planes guardados.'
      : `Plan que vas a entregar: ${$('plan').selectedOptions[0].textContent}`;
    $('disclosure-confirm').textContent = label;
    form.onsubmit = event => {
      event.preventDefault();
      const options = Object.fromEntries(['finance', 'resources', 'notes'].map(key => [key, form.elements[key].checked]));
      const snapshot = planForRecipient(plan(), options);
      $('disclosure-dialog').close();
      run(() => action(snapshot, options));
    };
    $('disclosure-dialog').showModal();
  };
}

async function showShares(projectId) {
  const links = await cloud.listShares(projectId);
  const list = $('share-list');
  list.replaceChildren();
  if (!links.length) {
    list.textContent = 'Este proyecto no tiene enlaces activos.';
    return;
  }
  const formatter = new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeStyle: 'short' });
  for (const link of links) {
    const row = document.createElement('div');
    row.className = 'toolbar';
    const label = document.createElement('span');
    label.textContent = `Creado el ${formatter.format(new Date(link.created_at))}`;
    const revoke = document.createElement('button');
    revoke.textContent = 'Retirar acceso';
    revoke.onclick = async () => {
      if (!confirm('¿Retirar el acceso a este enlace?')) return;
      revoke.disabled = true;
      $('share-error').textContent = '';
      try {
        await cloud.revokeShareDigest(link.token_digest);
        await showShares(projectId);
      } catch (error) {
        $('share-error').textContent = error.message;
        revoke.disabled = false;
      }
    };
    row.append(label, revoke);
    list.append(row);
  }
}

$('manage-shares').onclick = () => run(async () => {
  const projectId = current().cloudId;
  if (!projectId) { message('Este proyecto todavía no tiene enlaces compartidos.'); return; }
  if (!(await requireCloudSession())) return;
  $('share-error').textContent = '';
  await showShares(projectId);
  $('share-dialog').showModal();
});

if (readonly) {
  document.body.classList.add('readonly');
  run(async () => {
    if (!cloud) throw new Error('El servicio de enlaces compartidos todavía requiere configuración.');
    const shared = await cloud.loadShare(shareToken);
    if (!shared?.working) throw new Error('El enlace no está disponible.');
    projects = [record(shared.working)];
    projects[0].financeVisible = shared.financeVisible;
    selected = projects[0].id;
    render();
  });
} else {
  render();
}
