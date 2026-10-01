import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { blankSave, settleRun } from '../src/storage.js';

test('instant empty abandonment cannot farm research currency',()=>{
  const game=new Game();game.start('bomb','standard',1);const settled=settleRun(blankSave(),game.end(false,'abandon'));
  assert.equal(settled.awarded,0);assert.equal(settled.save.memory,0);assert.equal(settled.save.runs,1);
});
test('a meaningful short attempt still earns one memory and settles only once',()=>{
  const game=new Game();game.start('bomb','standard',1);game.time=20;const result=game.end(false,'attempt'),settled=settleRun(blankSave(),result);
  assert.equal(settled.awarded,1);assert.equal(settleRun(settled.save,result).awarded,0);
});
test('typing the displayed numeric seed recreates the same opening world',()=>{
  const first=new Game(),second=new Game();first.start('seed','standard',4167383937);second.start('seed','standard',String(first.seed));
  assert.equal(first.seed,second.seed);assert.deepEqual(first.enemies.map(e=>[e.type,e.x,e.y,e.anchorIndex]),second.enemies.map(e=>[e.type,e.x,e.y,e.anchorIndex]));
});
