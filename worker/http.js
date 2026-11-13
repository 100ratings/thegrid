import {frame,validateFrame} from '../public/engine.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export async function handleAPI(request,env){
 const url=new URL(request.url);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(url.pathname==='/health')return json({ok:true,service:'thegrid',transport:'http',pollIntervalMs:500});
 const match=url.pathname.match(/^\/api\/show\/([a-zA-Z0-9_-]{1,64})$/);if(!match)return json({error:'Endereço inválido'},404);
 if(!env.BUCKET)return json({error:'Sincronização indisponível'},503);
 const key=`thegrid/shows/${match[1]}.json`;
 try{
  const object=await env.BUCKET.get(key);const current=object?await object.json():{type:'state',frame:frame(0,[]),revision:0};
  if(request.method==='GET'){
   if(url.searchParams.get('since')===String(current.revision))return new Response(null,{status:204,headers});
   return json(current);
  }
  if(request.method!=='POST')return json({error:'Método inválido'},405);
  if(Number(request.headers.get('content-length'))>6500)return json({error:'Comando grande demais'},413);
  const text=await request.text();if(text.length>6500)return json({error:'Comando grande demais'},413);
  let packet;try{packet=JSON.parse(text);}catch{return json({error:'Comando inválido'},400);}
  if(!validateFrame(packet.frame)||typeof packet.id!=='string'||packet.id.length>64||!Number.isSafeInteger(packet.baseRevision))return json({error:'Comando inválido'},400);
  // Idempotence: a retry after an uncertain response cannot advance twice
  if(current.commandId===packet.id)return json(current);
  if(packet.baseRevision!==current.revision)return json({error:'A apresentação mudou, confira a etapa e tente novamente',state:current},409);
  const publishedFrame={...packet.frame};if(!publishedFrame.appearance&&current.frame.appearance)publishedFrame.appearance=current.frame.appearance;
  const next={type:'state',frame:publishedFrame,revision:current.revision+1,commandId:packet.id};
  const conditional=new Headers(object?{'If-Match':object.httpEtag}:{'If-None-Match':'*'});
  const saved=await env.BUCKET.put(key,JSON.stringify(next),{onlyIf:conditional,httpMetadata:{contentType:'application/json',cacheControl:'no-store'}});
  if(!saved)return json({error:'Outro comando chegou primeiro, reconectando'},409);
  return json(next);
 }catch{return json({error:'Não foi possível sincronizar agora'},503);}
}
