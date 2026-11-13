import {RELAY_URL} from './config.js';
export function normalizeRelay(value){
 if(!value)return '';
 const u=new URL(value);
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Use um endereço HTTPS de sincronização');
 if(u.username||u.password||u.search||u.hash)throw Error('Endereço de sincronização inválido');
 return u.origin;
}
export function settingsFromURL(){
 const q=new URLSearchParams(location.search);let relay='';
 try{relay=normalizeRelay(q.get('relay')||RELAY_URL||localStorage.getItem('thegrid.relay')||'');}catch{}
 const room=q.get('sala')||localStorage.getItem('thegrid.room')||'palco';
 return {relay,room:/^[a-zA-Z0-9_-]{1,64}$/.test(room)?room:'palco',demo:q.get('demo')==='1'};
}
export function spectatorURL({relay,room,demo=false}){
 const u=new URL('./',location.href);u.search='';u.hash='';u.searchParams.set('sala',room);
 if(relay)u.searchParams.set('relay',relay);if(demo)u.searchParams.set('demo','1');return u.href;
}
export class SyncClient{
 constructor({relay,room,demo=false,role,onState,onStatus}){
  Object.assign(this,{relay,room,demo,role,onState,onStatus});this.stopped=false;this.revision=-1;this.inflight=false;this.publishing=false;this.failures=0;this.generation=0;
  if(demo){this.channel=new BroadcastChannel(`thegrid.demo.${room}`);this.channel.onmessage=e=>{if(e.data.type==='request'){this.onRequest?.();return;}this.onState(e.data);};this.onStatus('demo');if(role==='spectator')this.channel.postMessage({type:'request'});return;}
  if(!relay){this.onStatus('unconfigured');return;}
  this.onStatus('connecting');this.onVisibility=()=>{if(document.visibilityState==='visible'){clearTimeout(this.timer);this.poll();}};document.addEventListener('visibilitychange',this.onVisibility);this.poll();
 }
 url(){return new URL(`/api/show/${this.room}`,this.relay);}
 apply(packet){if(packet.type!=='state'||!Number.isSafeInteger(packet.revision)||packet.revision<this.revision)return;this.revision=packet.revision;this.onState(packet);}
 schedule(delay=1000){clearTimeout(this.timer);if(!this.stopped)this.timer=setTimeout(()=>this.poll(),delay+Math.random()*80);}
 async poll(){
  if(this.stopped)return;if(this.inflight||this.publishing){this.schedule();return;}
  this.inflight=true;const generation=this.generation;const abort=this.abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),7000);
  try{
   const url=this.url();if(this.revision>=0)url.searchParams.set('since',String(this.revision));
   const response=await fetch(url,{cache:'no-store',signal:abort.signal});if(!response.ok)throw Error('Conexão indisponível');
   const packet=response.status===204?null:await response.json();if(this.stopped||generation!==this.generation)return;
   if(packet)this.apply(packet);this.failures=0;this.onStatus('connected');
  }catch{if(!this.stopped&&generation===this.generation){this.failures++;this.onStatus(this.revision<0?'offline':'reconnecting');}}
  finally{clearTimeout(timeout);this.inflight=false;this.schedule(this.failures?Math.min(5000,1000*this.failures):1000);}
 }
 async send(value){
  if(this.demo){const revision=Date.now();this.channel.postMessage({type:'state',frame:value,revision});return {type:'ack',revision};}
  if(this.stopped||this.revision<0)throw Error('Aguarde a conexão antes de avançar');
  this.publishing=true;this.generation++;this.abort?.abort();clearTimeout(this.timer);
  const packet={id:crypto.randomUUID(),frame:value,baseRevision:this.revision};const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),10000);
  try{
   const response=await fetch(this.url(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(packet),cache:'no-store',signal:abort.signal});
   const result=await response.json();
   if(!response.ok){if(result.state)this.apply(result.state);throw Error(result.error||'O comando não foi confirmado');}
   this.apply(result);this.failures=0;this.onStatus('connected');return {type:'ack',revision:result.revision};
  }catch(error){this.revision=-1;this.onStatus('reconnecting');throw Error(error.name==='AbortError'?'Sem confirmação, aguarde a reconexão antes de continuar':error.message);}
  finally{clearTimeout(timeout);this.publishing=false;this.schedule(50);}
 }
 close(){this.stopped=true;clearTimeout(this.timer);this.abort?.abort();this.channel?.close();if(this.onVisibility)document.removeEventListener('visibilitychange',this.onVisibility);}
}
