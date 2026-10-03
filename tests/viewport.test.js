import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { arenaViewport, arenaPoint } from '../src/util.js';

test('screen clicks select the same world target in tall, wide and high density arenas', () => {
  for (const [width,height] of [[1254,1004],[1280,720],[2560,1440],[390,844]]) {
    const game=new Game();game.start('bomb','standard',42);game.enemies=[];
    const enemy=game.spawnEnemy('drifter',{x:920,y:400,speed:0});
    const view=arenaViewport(width,height),rect={left:17,top:29,width,height};
    const point=arenaPoint(rect,rect.left+view.offsetX+enemy.x*view.scale,rect.top+view.offsetY+enemy.y*view.scale);
    assert.equal(point.inside,true);
    game.cursor.x=point.x;game.cursor.y=point.y;
    assert.equal(game.directTargets().target.id,enemy.id);
    assert.equal(game.skills.beginTarget(0),true);
    const preview=game.skills.targetingPreview;
    assert.ok(Math.abs(preview.x-enemy.x)<1e-9&&Math.abs(preview.y-enemy.y)<1e-9);
    assert.equal(game.skills.confirmTarget(),true);
    const bomb=game.fields.find(f=>f.type==='bomb');
    assert.ok(Math.abs(bomb.x-enemy.x)<1e-9&&Math.abs(bomb.y-enemy.y)<1e-9);
  }
});

test('space outside the fitted arena and a hidden canvas cannot count as field clicks', () => {
  assert.equal(arenaPoint({left:0,top:0,width:1254,height:1004},627,30).inside,false);
  assert.equal(arenaPoint({left:0,top:0,width:1280,height:720},10,360).inside,false);
  assert.equal(arenaPoint({left:0,top:0,width:0,height:0},0,0).inside,false);
});
