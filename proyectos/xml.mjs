import { schedule } from './domain.mjs';

const MINUTES_PER_DAY = 480;
// MSPDI stores currency values in hundredths of a currency unit.
const currencyValue = amount => Math.round(amount * 100);
const escapeXml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/[<>&'"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
const tag = (name, value) => value === undefined || value === null ? '' : `<${name}>${escapeXml(value)}</${name}>`;
const section = (name, content) => `<${name}>${content}</${name}>`;
const fields = values => Object.entries(values).map(([name, value]) => tag(name, value)).join('');
const stamp = (date, end = false) => date ? `${date}T${end ? '16' : '08'}:00:00` : undefined;
const durationValue = days => `PT${days * MINUTES_PER_DAY / 60}H0M0S`;

export function toProjectXml(project, { baseline } = {}) {
  const plan = schedule(project);
  if (plan.errors.length) throw new Error(plan.errors.join(' '));
  const baselinePlan = baseline ? schedule(baseline) : plan;
  if (baselinePlan.errors.length) throw new Error(baselinePlan.errors.join(' '));
  const baselineTasks = new Map(baselinePlan.tasks.map(row => [row.id, row]));

  const children = new Map();
  for (const row of plan.tasks) {
    const siblings = children.get(row.parentId || null) ?? [];
    siblings.push(row);
    children.set(row.parentId || null, siblings);
  }
  const order = [];
  const visit = (parent, prefix, level) => {
    (children.get(parent) ?? []).forEach((row, index) => {
      const outline = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      order.push({ row, uid: order.length + 1, outline, level });
      visit(row.id, outline, level + 1);
    });
  };
  visit(null, '', 1);
  const taskUids = new Map(order.map(({ row, uid }) => [row.id, uid]));
  const resourceUids = new Map();
  const assignments = [];
  const taskXml = order.map(({ row, uid, outline, level }) => {
    const summary = row.kind === 'group';
    const milestone = row.kind === 'milestone';
    const resource = row.responsible?.trim();
    if (!summary && resource) {
      if (!resourceUids.has(resource)) resourceUids.set(resource, resourceUids.size + 1);
      assignments.push(section('Assignment', fields({
        UID: assignments.length + 1, TaskUID: uid, ResourceUID: resourceUids.get(resource),
        Cost: 0, Finish: stamp(row.finish, !milestone || row.atEnd),
        Start: stamp(row.start, row.atEnd), Units: 0, Work: durationValue(0),
      })));
    }
    const start = stamp(row.start, row.atEnd);
    const finish = stamp(row.finish, !milestone || row.atEnd);
    const predecessors = row.predecessors.map(edge => section('PredecessorLink', fields({
      PredecessorUID: taskUids.get(edge.id), Type: 1, CrossProject: 0,
      LinkLag: (edge.lag ?? 0) * MINUTES_PER_DAY * 10, LagFormat: 7,
    }))).join('');
    const original = baselineTasks.get(row.id);
    const taskBaseline = original?.start ? section('Baseline', fields({
      Number: 0,
      Start: stamp(original.start, original.atEnd),
      Finish: stamp(original.finish, original.kind !== 'milestone' || original.atEnd),
      Duration: durationValue(original.duration),
      DurationFormat: 7, Cost: currencyValue(original.totalCost),
    })) : '';
    return section('Task', fields({
      UID: uid, ID: uid, Name: row.code ? `${row.code} · ${row.name}` : row.name, Type: 1,
      WBS: row.code || outline, OutlineNumber: outline, OutlineLevel: level,
      Start: start, Finish: finish, Duration: durationValue(row.duration), DurationFormat: 7,
      Work: durationValue(0), EffortDriven: 0, Milestone: Number(milestone), Summary: Number(summary),
      Critical: Number(Boolean(row.critical)),
      TotalSlack: summary ? undefined : row.float * MINUTES_PER_DAY * 10,
      FixedCost: summary ? 0 : currencyValue(row.totalCost), FixedCostAccrual: 3, Cost: currencyValue(row.totalCost),
      ConstraintType: row.notBefore && !summary ? 4 : 0, CalendarUID: 1,
      ConstraintDate: row.notBefore && !summary ? stamp(row.notBefore) : undefined,
      LevelingCanSplit: 0, IgnoreResourceCalendar: 1,
      Notes: [row.notes, row.sourceCodes?.length ? `Trazabilidad: ${row.sourceCodes.join(', ')}` : ''].filter(Boolean).join('\n') || undefined,
    }) + predecessors + taskBaseline);
  }).join('');
  const workdays = Array.from({ length: 7 }, (_, index) => section('WeekDay',
    fields({ DayType: index + 1, DayWorking: 1 }) + section('WorkingTimes', section('WorkingTime',
      fields({ FromTime: '08:00:00', ToTime: '16:00:00' }))))).join('');
  const calendar = section('Calendar', fields({
    UID: 1, Name: 'Calendario corrido (8 horas por día)', IsBaseCalendar: 1, BaseCalendarUID: -1,
  }) + section('WeekDays', workdays));
  const resources = [...resourceUids].map(([name, uid]) => section('Resource', fields({
    UID: uid, ID: uid, Name: name, Type: 1, MaxUnits: 1, StandardRate: 0, CalendarUID: 1,
  }))).join('');
  const notes = [
    project.scope && `Alcance: ${project.scope}`,
    project.exclusions && `Exclusiones: ${project.exclusions}`,
    `Reserva fuera de los costos de las tareas: ${project.currency || 'USD'} ${plan.reserve}`,
  ].filter(Boolean).join('\n');
  const summaryTask = section('Task', fields({
    UID: 0, ID: 0, Name: project.name || 'Proyecto', Type: 1, WBS: 0, OutlineNumber: 0, OutlineLevel: 0,
    Start: stamp(project.start), Finish: stamp(plan.finish, plan.duration > 0),
    Duration: durationValue(plan.duration), DurationFormat: 7, Work: durationValue(0),
    Milestone: 0, Summary: 1, Cost: currencyValue(plan.subtotal), CalendarUID: 1, Notes: notes,
  }));
  const lastWorkEnds = plan.tasks.some(row => row.finish === plan.finish && (row.kind === 'task' || row.atEnd));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<Project xmlns="http://schemas.microsoft.com/project">'
    + fields({
      SaveVersion: 14, Name: project.name || 'Proyecto', Title: project.name || 'Proyecto', ScheduleFromStart: 1,
      StartDate: stamp(project.start), FinishDate: stamp(plan.finish, lastWorkEnds),
      CriticalSlackLimit: 0, CurrencyDigits: 2, CurrencySymbol: project.currency || 'USD',
      CurrencyCode: project.currency || 'USD', CalendarUID: 1, DefaultStartTime: '08:00:00',
      DefaultFinishTime: '16:00:00', MinutesPerDay: MINUTES_PER_DAY, MinutesPerWeek: MINUTES_PER_DAY * 7,
      DaysPerMonth: 30, DefaultTaskType: 1, DefaultFixedCostAccrual: 3,
    }) + section('Calendars', calendar) + section('Tasks', summaryTask + taskXml)
    + section('Resources', resources) + section('Assignments', assignments.join('')) + '</Project>';
}
