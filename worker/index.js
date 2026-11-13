import { DurableObject } from 'cloudflare:workers';
import {frame,validateFrame} from '../public/engine.js';

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health')return Response.json({service:'thegrid',ok:true});
  const match=url.pathname.match(/^\/ws\/([a-zA-Z0-9_-]{1,64})$/);
  if(!match)return env.ASSETS?env.ASSETS.fetch(request):new Response('The Grid synchronization service',{status:404});
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  // No passwords or login, as requested; role only separates presentation behavior
  return env.SHOWS.getByName(match[1]).fetch(request);
 }
};
export class GridShow extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);this.snapshot={type:'state',frame:frame(0,[]),revision:0};this.queue=Promise.resolve();
  this.ctx.blockConcurrencyWhile(async()=>{const saved=await this.ctx.storage.get('snapshot');if(saved)this.snapshot=saved;});
  this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
 }
 async fetch(request){
  const role=new URL(request.url).searchParams.get('role')==='controller'?'controller':'spectator';
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server,[role]);server.serializeAttachment({role,lastPublish:0});server.send(JSON.stringify(this.snapshot));
  return new Response(null,{status:101,webSocket:client});
 }
 webSocketMessage(ws,message){
  // Serialize storage and broadcasts so rapid commands never reorder or overwrite each other
  this.queue=this.queue.then(()=>this.handleMessage(ws,message)).catch(()=>{try{ws.send(JSON.stringify({type:'error',message:'Falha ao salvar a etapa'}));}catch{}});return this.queue;
 }
 async handleMessage(ws,message){
  const attachment=ws.deserializeAttachment();if(attachment?.role!=='controller')return;
  if(typeof message!=='string'||message.length>6000)return;
  let packet;try{packet=JSON.parse(message);}catch{return;}
  const error=message=>ws.send(JSON.stringify({type:'error',id:packet.id,message}));
  if(packet.type!=='publish'||typeof packet.id!=='string'||packet.id.length>64||!validateFrame(packet.frame)){error('Comando inválido');return;}
  if(Date.now()-attachment.lastPublish<120){error('Aguarde um instante entre comandos');return;}
  attachment.lastPublish=Date.now();ws.serializeAttachment(attachment);
  const next={type:'state',frame:packet.frame,revision:this.snapshot.revision+1};
  // Store before acknowledging; new/reconnecting spectators always get the committed frame
  try{await this.ctx.storage.put('snapshot',next);}catch{error('Não foi possível salvar a etapa, tente novamente');return;}this.snapshot=next;const text=JSON.stringify(next);
  for(const client of this.ctx.getWebSockets()){try{client.send(text);}catch{try{client.close(1011,'Reconnect');}catch{}}}
  ws.send(JSON.stringify({type:'ack',id:packet.id,revision:next.revision}));
 }
 webSocketClose(ws,code,reason){ws.close(code,reason);}
 webSocketError(ws){try{ws.close(1011,'Reconnect');}catch{}}
}
