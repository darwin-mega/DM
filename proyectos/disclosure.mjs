function pick(source, keys) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));
}

export function planForRecipient(plan, { finance, resources, notes }) {
  return {
    ...pick(plan, ['name', 'start', 'currency']),
    ...(finance ? pick(plan, ['budget', 'reserve']) : {}),
    ...(notes ? pick(plan, ['scope', 'exclusions']) : {}),
    ...(finance && plan.payments ? {
      payments: plan.payments.map(payment => pick(payment, ['id', 'taskId', 'date', 'amount'])),
    } : {}),
    tasks: plan.tasks.map(task => ({
      ...pick(task, ['id', 'name', 'code', 'kind', 'parentId', 'duration', 'notBefore', 'atEnd']),
      predecessors: (task.predecessors ?? []).map(edge => pick(edge, ['id', 'lag'])),
      ...(finance ? pick(task, ['cost', 'costMode', 'quantity', 'rate']) : {}),
      ...(resources ? pick(task, ['responsible']) : {}),
      ...(notes ? pick(task, ['notes', 'sourceCodes']) : {}),
    })),
  };
}
