export const SAVE_KEY='dtw-v2-archive';
export function blankSave() {return {version:2,memory:0,runs:0,wins:0,best:0,discoveries:[],history:[],settled:[],settings:{sound:true,reducedMotion:false,lowEffects:false,highContrast:false,volume:.5},research:{recovery:0,insight:0}};}
export function readSave(storage) {
  try {
    const s=JSON.parse(storage?.getItem(SAVE_KEY)||'null');if(s?.version!==2)return blankSave();
    const base=blankSave(),number=(value,fallback=0,max=Number.MAX_SAFE_INTEGER)=>Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):fallback;
    const strings=value=>Array.isArray(value)?value.filter(v=>typeof v==='string').slice(-100):[];
    const settings={...base.settings};for(const key of ['sound','reducedMotion','lowEffects','highContrast'])if(typeof s.settings?.[key]==='boolean')settings[key]=s.settings[key];
    if(Number.isFinite(s.settings?.volume))settings.volume=Math.max(0,Math.min(1,s.settings.volume));
    if(s.settings?.keys&&typeof s.settings.keys==='object'){settings.keys={};for(const key of ['skill0','skill1','network','pause'])if(/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Escape|Space|Arrow(Up|Down|Left|Right)|F([1-9]|1[0-2]))$/.test(s.settings.keys[key]))settings.keys[key]=s.settings.keys[key];}
    return {...base,memory:number(s.memory),runs:number(s.runs),wins:number(s.wins),best:number(s.best),settled:strings(s.settled),discoveries:strings(s.discoveries),history:Array.isArray(s.history)?s.history.filter(r=>r&&typeof r==='object'&&Number.isFinite(r.kills)&&Number.isFinite(r.duration)&&Number.isFinite(r.memory)).slice(0,15):[],settings,research:{recovery:number(s.research?.recovery,0,5),insight:number(s.research?.insight,0,5)}};
  }catch{return blankSave();}
}
export function writeSave(storage,save) {try {if(typeof storage?.setItem!=='function')return false;storage.setItem(SAVE_KEY,JSON.stringify(save));return true;}catch{return false;}}
export function settleRun(save,result) {
  if(result.mode==='training')return {save,awarded:0,duplicate:false,skipped:true};
  if(save.settled.includes(result.runId))return {save,awarded:0,duplicate:true};
  const earned=Math.floor(result.kills/35)+(result.won?12:0)+Math.floor(result.duration/90);
  const award=result.won||result.kills>=5||result.duration>=20?Math.max(1,earned):0;
  const next={...save,memory:save.memory+award,runs:save.runs+1,wins:save.wins+(result.won?1:0),best:Math.max(save.best,result.score),settled:[...save.settled,result.runId].slice(-100),history:[{...result,memory:award},...save.history].slice(0,15),discoveries:[...new Set([...save.discoveries,...(result.discoveries||[])])]};
  return {save:next,awarded:award,duplicate:false};
}
