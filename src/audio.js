export class AudioBus {
  constructor(settings){this.settings=settings;this.context=null;this.last=new Map();}
  unlock(){if(!this.context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(C)this.context=new C();}this.context?.resume();}
  play(name){if(!this.context||!this.settings.sound||(this.settings.volume??.5)<=0)return;const now=this.context.currentTime;if(now-(this.last.get(name)||-10)<(['chain','direct'].includes(name)?.07:.14))return;this.last.set(name,now);
    const sounds={direct:[420,150,.07,'triangle'],heavy:[110,48,.18,'sawtooth'],chain:[1000,540,.055,'triangle'],arm:[260,620,.16,'sine'],bomb:[90,40,.2,'sawtooth'],hole:[85,55,.3,'sine'],cut:[850,160,.07,'triangle'],orbital:[180,70,.12,'square'],seed:[180,310,.1,'sine'],danger:[620,480,.26,'square'],interrupt:[700,1050,.12,'sine'],level:[420,840,.22,'sine'],evolve:[260,1040,.35,'triangle'],win:[390,1200,.7,'sine'],lose:[170,42,.65,'sine']};
    const [f,end,duration,type]=sounds[name]||sounds.direct;
    const quiet=['direct','chain','arm'].includes(name),scale=name==='danger'?.1:quiet?.028:.065;
    const volume=(this.settings.volume??.5)*scale;
    this.tone(f,end,duration,type,now,volume);
    // Ordinary contact is quiet; each world phenomenon has a distinct texture.
    if(name==='bomb'||name==='heavy'){
      this.tone(42,25,.42,'sine',now+.04,volume*.7);
      this.air(now+.035,.3,180,volume*.55);
    }else if(name==='cut'){
      this.air(now,.16,2600,volume*.6);
      this.tone(65,38,.24,'sine',now+.055,volume*.35);
    }else if(name==='hole'){
      this.tone(123,57,.62,'sine',now,volume*.45);
    }else if(name==='orbital'){
      this.air(now,.22,700,volume*.35);
      this.tone(55,31,.28,'sine',now+.08,volume*.5);
    }else if(name==='seed'){
      this.tone(235,470,.18,'sine',now+.07,volume*.4);
    }
  }
  tone(start,end,duration,type,at,volume){
    const osc=this.context.createOscillator(),gain=this.context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(start,at);osc.frequency.exponentialRampToValueAtTime(end,at+duration);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(gain);gain.connect(this.context.destination);osc.start(at);osc.stop(at+duration+.02);
  }
  air(at,duration,frequency,volume){
    const count=Math.ceil(this.context.sampleRate*duration),buffer=this.context.createBuffer(1,count,this.context.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<count;i++)data[i]=(Math.random()*2-1)*(1-i/count);
    const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(frequency,at);filter.frequency.exponentialRampToValueAtTime(60,at+duration);
    gain.gain.setValueAtTime(Math.max(.0001,volume),at);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.context.destination);source.start(at);source.stop(at+duration+.01);
  }
}
