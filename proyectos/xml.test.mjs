import test from 'node:test';
import assert from 'node:assert/strict';
import { toProjectXml } from './xml.mjs';
import { makeBlink } from './blink.mjs';

test('MSPDI currency fields use hundredths without changing the project budget', () => {
  const project = makeBlink();
  const xml = toProjectXml(project);
  assert.match(xml, /<Cost>8150000<\/Cost>/);
  assert.match(xml, /<FixedCost>1500000<\/FixedCost>/);
  assert.equal(project.budget, 85000);
  assert.equal(project.reserve, 3500);
});

test('MSPDI currency fields preserve cents', () => {
  const project = {
    name: 'Importe con centavos',
    start: '2026-11-05',
    tasks: [{
      id: 'task-1', name: 'Tarea', kind: 'task', duration: 1,
      costMode: 'fixed', cost: 12.34, predecessors: [],
    }],
  };
  const xml = toProjectXml(project);
  assert.match(xml, /<FixedCost>1234<\/FixedCost>/);
  assert.match(xml, /<Cost>1234<\/Cost>/);
});
