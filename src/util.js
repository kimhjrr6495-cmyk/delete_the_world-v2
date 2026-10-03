export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const dist=(x,y,x2,y2)=>Math.hypot(x-x2,y-y2);
export function seededRandom(seed=1) { let n=seed>>>0; return ()=>{ n+=0x6D2B79F5; let t=n; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
export function hashSeed(value) { let h=2166136261; for(const c of String(value)) {h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0; }
export function lineDistance(x,y,x1,y1,x2,y2) { const dx=x2-x1,dy=y2-y1; const t=clamp(((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy||1),0,1); return Math.hypot(x-x1-t*dx,y-y1-t*dy); }
export const formatTime=(t)=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
export const sourceTag={DIRECT:'IMPACT',AUTO:'CASTER',SKILL:'CASTER',SUMMON:'SWARM',STATUS:'INFECTION'};
export function weightedPick(items,rng) { let total=items.reduce((n,i)=>n+i.weight,0),roll=rng()*total; for(const item of items) {roll-=item.weight;if(roll<=0)return item;}return items.at(-1); }

// Fit the whole arena with one scale so planets and attack ranges stay circular.
export function arenaViewport(pixelWidth,pixelHeight,worldWidth=1280,worldHeight=760) {
  const scale=Math.max(0,Math.min(pixelWidth/worldWidth,pixelHeight/worldHeight));
  return {scale,offsetX:(pixelWidth-worldWidth*scale)/2,offsetY:(pixelHeight-worldHeight*scale)/2};
}
export function arenaPoint(rect,clientX,clientY,worldWidth=1280,worldHeight=760) {
  const view=arenaViewport(rect.width,rect.height,worldWidth,worldHeight);
  if(!view.scale)return {x:worldWidth/2,y:worldHeight/2,inside:false};
  const x=(clientX-rect.left-view.offsetX)/view.scale,y=(clientY-rect.top-view.offsetY)/view.scale;
  return {x,y,inside:x>=0&&x<=worldWidth&&y>=0&&y<=worldHeight};
}
