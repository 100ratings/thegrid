import {ANIMALS,CATEGORIES,STAGES,createLayout,frame,validateFrame} from './engine.js';
import {createRenderer,requestWakeLock} from './render.js';
import {SyncClient,settingsFromURL,spectatorURL,normalizeRelay} from './sync.js';
const $=s=>document.querySelector(s);const render=createRenderer($('#stage'));
let options=settingsFromURL(),client,online=false,busy=false,stage=0,layout=[],category=2,force='girafa',timeline=[],commandTimer,lastTap=0,wake;
let confirmed=frame(0,[]),awaitingSnapshot=true,serverRevision=-1;
try{const saved=JSON.parse(localStorage.getItem(`thegrid.prep.${options.room}`)||'null');if(saved){if(ANIMALS.some(a=>a.id===saved.force))force=saved.force;if(Number.isInteger(saved.category)&&saved.category>=0&&saved.category<4)category=saved.category;}}catch{}
for(const animal of ANIMALS){const opt=document.createElement('option');opt.value=animal.id;opt.textContent=animal.name;$('#force').append(opt);}
CATEGORIES.forEach((name,index)=>{const opt=document.createElement('option');opt.value=index;opt.textContent=name;$('#category').append(opt);});
function notice(text){$('#notice').textContent=text;}
function cache(){localStorage.setItem(`thegrid.prep.${options.room}`,JSON.stringify({category,force}));}
function draw(){
 render(confirmed);$('#preview-wait').hidden=stage!==0;$('#phase').textContent=STAGES[stage].name;$('#step-count').textContent=`${stage} / 7`;$('#hint').textContent=STAGES[stage].hint;$('#next-label').textContent=stage===7?'Force revelado':STAGES[stage].next;
 $('#advance').textContent=STAGES[stage].next;$('#advance').disabled=busy||!online||awaitingSnapshot||stage===7;$('#back').disabled=busy||!online||awaitingSnapshot||stage===0;$('#surface').disabled=busy||!online||awaitingSnapshot;
}
function connect(){
 client?.close();online=false;awaitingSnapshot=true;serverRevision=-1;draw();
 client=new SyncClient({...options,role:'controller',onStatus:status=>{
 online=status==='connected'||status==='demo';if(status==='connected')awaitingSnapshot=true;
 const labels={connected:'Conectado',demo:'Teste local',connecting:'Conectando',reconnecting:'Reconectando',offline:'Sem conexão',unconfigured:'Configurar sincronização'};
 $('#status').textContent=labels[status]||status;$('#status').className=`status ${online?'online':'error'}`;
 if(status==='unconfigured')notice('Configure a sincronização em Ajustes para controlar o público');draw();
 },onState:packet=>{
 if(!validateFrame(packet.frame)||packet.revision<serverRevision)return;serverRevision=packet.revision;
 // On every connection, the server is authoritative, including after a lost acknowledgment
 confirmed=packet.frame;stage=confirmed.stage;if(stage>=2){layout=[...confirmed.layout];force=layout[7];}
 if(awaitingSnapshot||!busy){timeline=Array.from({length:stage+1},(_,i)=>frame(i,layout));}
 awaitingSnapshot=false;draw();
 }});
 if(options.demo){awaitingSnapshot=false;client.onRequest=()=>client.send(confirmed);draw();}
}
async function publish(nextStage,nextLayout=layout){
 if(busy||!online||awaitingSnapshot)return;busy=true;clearTimeout(commandTimer);draw();
 const previous=confirmed;const next=frame(nextStage,nextLayout);
 try{await client.send(next);confirmed=next;stage=nextStage;layout=nextLayout;timeline=Array.from({length:stage+1},(_,i)=>frame(i,layout));notice('');}
 catch(error){notice(error.message);if(serverRevision<0)confirmed=previous;}
 finally{busy=false;draw();}
}
function advance(){if(stage>=7||busy)return;if(stage===1&&layout.length!==20){layout=createLayout(category,force);}publish(stage+1);}
function back(){if(stage>0)publish(stage-1);}
$('#advance').onclick=advance;$('#back').onclick=back;
$('#surface').addEventListener('click',()=>{const now=performance.now();if(lastTap&&now-lastTap<330){clearTimeout(commandTimer);lastTap=0;back();}else{lastTap=now;commandTimer=setTimeout(()=>{lastTap=0;advance();},330);}});
$('#surface').addEventListener('dblclick',e=>e.preventDefault());
function openSettings(){clearTimeout(commandTimer);lastTap=0;$('#force').value=force;$('#category').value=String(category);$('#relay').value=options.relay;$('#room').value=options.room;$('#force').disabled=stage!==0;$('#category').disabled=stage>=2;$('#settings-notice').textContent='';$('#settings').showModal();}
$('#settings-open').onclick=openSettings;
$('#save').onclick=()=>{try{
 const relay=normalizeRelay($('#relay').value.trim());const room=$('#room').value.trim();if(!/^[a-zA-Z0-9_-]{1,64}$/.test(room))throw Error('A sala aceita letras, números, _ e hífen');
 const changed=relay!==options.relay||room!==options.room;
 if(changed&&stage!==0)throw Error('Volte à espera antes de mudar a conexão ou a sala');
 if(stage===0){const nextForce=$('#force').value;if(nextForce!==force)layout=[];force=nextForce;}if(stage<2){const nextCategory=Number($('#category').value);if(nextCategory!==category)layout=[];category=nextCategory;}
 options={...options,relay,room};localStorage.setItem('thegrid.relay',relay);localStorage.setItem('thegrid.room',room);cache();
 if(changed){confirmed=frame(0,[]);stage=0;layout=[];timeline=[];connect();}$('#settings').close();notice('Preparação salva');
 }catch(error){$('#settings-notice').textContent=error.message;}};
$('#reset').onclick=()=>{if(busy)return;$('#settings').close();$('#reset-dialog').showModal();};$('#reset-cancel').onclick=()=>$('#reset-dialog').close();$('#reset-confirm').onclick=async()=>{await publish(0,[]);if(stage===0)$('#reset-dialog').close();};
$('#share').onclick=async()=>{if(!options.relay&&!options.demo){openSettings();$('#settings-notice').textContent='Configure o endereço de sincronização antes de compartilhar';return;}const url=spectatorURL(options);try{await navigator.clipboard.writeText(url);notice('Link do público copiado');}catch{notice(url);}};
$('#wake').onclick=async()=>{wake=await requestWakeLock();$('#wake').textContent=wake?'Tela ativa':'Não disponível neste navegador';};
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&wake)wake=await requestWakeLock();});
draw();connect();
