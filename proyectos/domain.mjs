const DAY = 86_400_000;

export function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const millis = Date.parse(value);
  return Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === value
    ? millis / DAY : NaN;
}

export function dateAt(start, offset) {
  return new Date((dayNumber(start) + offset) * DAY).toISOString().slice(0, 10);
}

function taskCost(task, duration) {
  const rate = Number(task.rate ?? 0);
  const amount = task.costMode === 'per-unit' ? rate * Number(task.quantity ?? 0)
    : task.costMode === 'per-day' ? rate * duration
      : Number(task.cost ?? 0);
  return Math.round(amount * 100) / 100;
}

export function schedule(project) {
  const errors = [], warnings = [];
  const origin = dayNumber(project.start);
  const reserve = Number(project.reserve ?? 0);
  const rows = new Map();
  const tasks = project.tasks ?? [];
  if (!Number.isFinite(origin)) errors.push('La fecha de inicio del proyecto es inválida.');
  if (!Number.isFinite(reserve) || reserve < 0) errors.push('La reserva debe ser un importe válido.');
  for (const task of tasks) {
    const duration = task.kind === 'task' ? Number(task.duration) : 0;
    const totalCost = task.kind === 'group' ? 0 : taskCost(task, duration);
    const earliest = task.notBefore ? dayNumber(task.notBefore) - origin : 0;
    if (!task.id || rows.has(task.id)) errors.push('Hay una tarea con identificador vacío o duplicado.');
    if (!['task', 'milestone', 'group'].includes(task.kind)) errors.push(`Tipo inválido para ${task.name}.`);
    if (!Number.isSafeInteger(duration) || duration < 1 && task.kind === 'task') errors.push(`Duración inválida para ${task.name}.`);
    if (!Number.isFinite(totalCost) || totalCost < 0) errors.push(`Costo inválido para ${task.name}.`);
    if (!Number.isFinite(earliest)) errors.push(`Fecha inválida para ${task.name}.`);
    rows.set(task.id, { ...task, duration, totalCost, earliest, successors: [] });
  }
  const network = [...rows.values()].filter(row => row.kind !== 'group');
  for (const row of rows.values()) {
    if (row.parentId) {
      const parents = new Set([row.id]);
      let parent = rows.get(row.parentId);
      while (parent?.kind === 'group' && !parents.has(parent.id)) {
        parents.add(parent.id);
        if (!parent.parentId) { parent = null; break; }
        parent = rows.get(parent.parentId) ?? undefined;
      }
      if (parent !== null) errors.push(`Grupo inválido o circular para ${row.name}.`);
    }
    row.predecessors ??= [];
    if (!Array.isArray(row.predecessors) || row.kind === 'group' && row.predecessors.length) {
      errors.push(`Dependencias inválidas para ${row.name}.`);
      continue;
    }
    const linked = new Set();
    for (const { id, lag = 0 } of row.predecessors) {
      const previous = rows.get(id);
      if (!previous || previous.kind === 'group' || id === row.id || linked.has(id)
        || !Number.isSafeInteger(lag) || lag < 0) {
        errors.push(`Dependencia inválida en ${row.name}: ${id}.`);
        continue;
      }
      linked.add(id);
      previous.successors.push({ id: row.id, lag });
    }
  }
  const invalid = () => ({ tasks: [], errors, warnings, criticalPaths: [], duration: 0, total: null, finish: null });
  if (errors.length) return invalid();
  const order = [], visiting = new Set(), visited = new Set();
  const visit = row => {
    if (visited.has(row.id)) return;
    if (visiting.has(row.id)) { errors.push(`Dependencia circular en ${row.name}.`); return; }
    visiting.add(row.id);
    for (const predecessor of row.predecessors) visit(rows.get(predecessor.id));
    visiting.delete(row.id);
    visited.add(row.id);
    order.push(row);
  };
  network.forEach(visit);
  if (errors.length) return invalid();

  for (const row of order) {
    row.earlyStart = Math.max(0, row.earliest, ...row.predecessors.map(edge => rows.get(edge.id).earlyFinish + (edge.lag ?? 0)));
    row.earlyFinish = row.earlyStart + row.duration;
    if (network.length > 1 && !row.predecessors.length && !row.successors.length) {
      warnings.push(`Tarea sin vincular: ${row.name}.`);
    }
  }
  const duration = Math.max(0, ...order.map(row => row.earlyFinish));
  if (origin + duration > dayNumber('9999-12-31')) {
    errors.push('El cronograma supera el intervalo de fechas admitido.');
    return invalid();
  }
  for (const row of [...order].reverse()) {
    const lateFinish = row.successors.length
      ? Math.min(...row.successors.map(edge => rows.get(edge.id).lateStart - edge.lag)) : duration;
    row.lateStart = lateFinish - row.duration;
    row.float = row.lateStart - row.earlyStart;
    row.critical = row.float === 0;
    const displayedStart = row.kind === 'milestone' && row.atEnd ? Math.max(0, row.earlyStart - 1) : row.earlyStart;
    row.start = dateAt(project.start, displayedStart);
    row.finish = row.duration ? dateAt(project.start, row.earlyFinish - 1) : row.start;
  }

  const criticalPaths = [];
  const critical = order.filter(row => row.critical);
  const isDriving = (from, to, lag) => from.critical && to.critical && from.earlyFinish + lag === to.earlyStart;
  const trace = (row, path) => {
    if (criticalPaths.length === 100) return;
    const nextPath = [...path, row.id];
    const edges = row.successors.filter(edge => isDriving(row, rows.get(edge.id), edge.lag));
    if (edges.length) edges.forEach(edge => trace(rows.get(edge.id), nextPath));
    else if (row.earlyFinish === duration) criticalPaths.push(nextPath);
  };
  critical.filter(row => !row.predecessors.some(edge => isDriving(rows.get(edge.id), row, edge.lag ?? 0)))
    .forEach(row => trace(row, []));

  const rollup = row => {
    if (row.kind !== 'group') return;
    const children = [...rows.values()].filter(child => child.parentId === row.id);
    children.forEach(rollup);
    row.start = children.map(child => child.start).filter(Boolean).sort()[0] ?? null;
    row.finish = children.map(child => child.finish).filter(Boolean).sort().at(-1) ?? null;
    row.totalCost = Math.round(children.reduce((sum, child) => sum + child.totalCost, 0) * 100) / 100;
    if (row.start) row.duration = dayNumber(row.finish) - dayNumber(row.start) + 1;
  };
  [...rows.values()].filter(row => !row.parentId).forEach(rollup);
  const subtotal = Math.round(network.reduce((sum, row) => sum + row.totalCost, 0) * 100) / 100;
  const finish = order.map(row => row.finish).sort().at(-1) ?? project.start;
  return { tasks: [...rows.values()], errors, warnings, criticalPaths, duration, subtotal, reserve,
    total: Math.round((subtotal + reserve) * 100) / 100, finish };
}

export function comparePlans(before, after) {
  const original = new Map(before.tasks.map(task => [task.id, task]));
  const updated = new Map(after.tasks.map(task => [task.id, task]));
  return [...new Set([...original.keys(), ...updated.keys()])].flatMap(id => {
    const from = original.get(id), to = updated.get(id);
    if (from?.kind === 'group' || to?.kind === 'group') return [];
    return !from || !to || ['start', 'finish', 'duration', 'totalCost', 'float', 'name', 'responsible'].some(key => from[key] !== to[key])
      ? [{ id, name: (to ?? from).name, from, to }] : [];
  });
}

export function previewMove(project, id, date) {
  const before = schedule(project);
  const moved = {
    ...project,
    tasks: project.tasks.map(task => task.id !== id || task.kind === 'group' ? task : {
      ...task, notBefore: task.atEnd && Number.isFinite(dayNumber(date)) ? dateAt(date, 1) : date,
    }),
  };
  const after = schedule(moved);
  return { project: moved, before, after, changes: after.errors.length ? [] : comparePlans(before, after) };
}
