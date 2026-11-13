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
 constructor({relay,room,demo=false,role,onState,onStatus}){Object.assign(this,{relay,room,demo,role,onState,onStatus});this.pending=new Map();this.stopped=false;this.tries=0;this.lastReceived=0;
 if(demo){this.channel=new BroadcastChannel(`thegrid.demo.${room}`);this.channel.onmessage=e=>{if(e.data.type==='request'){this.onRequest?.();return;}this.onState(e.data);};this.onStatus('demo');if(role==='spectator')this.channel.postMessage({type:'request'});return;}
 if(!relay){this.onStatus('unconfigured');return;}this.connect();
 }
 connect(){if(this.stopped)return;this.onStatus('connecting');const url=new URL(`/ws/${this.room}`,this.relay);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('role',this.role);
 const ws=this.ws=new WebSocket(url);let opened=false;
 const timeout=setTimeout(()=>{if(ws.readyState!==WebSocket.OPEN)ws.close();},12000);
 ws.onopen=()=>{opened=true;clearTimeout(timeout);this.tries=0;this.lastReceived=Date.now();this.onStatus('connected');this.heartbeat=setInterval(()=>{if(Date.now()-this.lastReceived>65000){ws.close();return;}if(ws.readyState===WebSocket.OPEN)ws.send('ping');},25000);};
 ws.onmessage=e=>{this.lastReceived=Date.now();if(e.data==='pong')return;try{const packet=JSON.parse(e.data);if(packet.type==='ack'||packet.type==='error'){const pending=this.pending.get(packet.id);if(pending){clearTimeout(pending.timer);this.pending.delete(packet.id);packet.type==='ack'?pending.resolve(packet):pending.reject(Error(packet.message||'O comando não foi confirmado'));}return;}if(packet.type==='state')this.onState(packet);}catch{}};
 ws.onerror=()=>ws.close();ws.onclose=()=>{clearTimeout(timeout);clearInterval(this.heartbeat);for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Conexão interrompida, aguarde reconectar'));}this.pending.clear();if(this.stopped)return;this.onStatus(opened?'reconnecting':'offline');this.retry=setTimeout(()=>this.connect(),Math.min(12000,700*2**Math.min(this.tries++,4))+Math.random()*600);};
 }
 send(frame){
 if(this.demo){this.channel.postMessage({type:'state',frame,revision:Date.now()});return Promise.resolve({type:'ack',revision:Date.now()});}
 if(this.ws?.readyState!==WebSocket.OPEN)return Promise.reject(Error('Aguarde a conexão antes de avançar'));
 const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Sem confirmação, confira a conexão antes de continuar'));},10000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({type:'publish',id,frame}));});
 }
 close(){this.stopped=true;clearTimeout(this.retry);clearInterval(this.heartbeat);this.ws?.close();this.channel?.close();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Conexão encerrada'));}this.pending.clear();}
}
