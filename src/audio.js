export class AudioBus {
  constructor(settings){this.settings=settings;this.context=null;this.last=new Map();}
  unlock(){if(!this.context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(C)this.context=new C();}this.context?.resume();}
  play(name){if(!this.context||!this.settings.sound||(this.settings.volume??.5)<=0)return;const now=this.context.currentTime;if(now-(this.last.get(name)||-10)<(['chain','direct'].includes(name)?.07:.14))return;this.last.set(name,now);
    const sounds={direct:[420,150,.07,'triangle'],heavy:[110,48,.18,'sawtooth'],chain:[1000,540,.055,'triangle'],arm:[260,620,.16,'sine'],bomb:[90,40,.2,'sawtooth'],hole:[85,55,.3,'sine'],cut:[850,160,.07,'triangle'],orbital:[180,70,.12,'square'],seed:[180,310,.1,'sine'],danger:[620,480,.26,'square'],interrupt:[700,1050,.12,'sine'],level:[420,840,.22,'sine'],evolve:[260,1040,.35,'triangle'],win:[390,1200,.7,'sine'],lose:[170,42,.65,'sine']};
    const [f,end,duration,type]=sounds[name]||sounds.direct;const osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type;osc.frequency.setValueAtTime(f,now);osc.frequency.exponentialRampToValueAtTime(end,now+duration);const volume=(this.settings.volume??.5)*(name==='danger'?.11:.065);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(this.context.destination);osc.start(now);osc.stop(now+duration+.02);
  }
}
