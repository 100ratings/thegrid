import {ANIMALS,STAGES,createLayout,frame,validateFrame,normalizeAppearance} from './engine.js';
import {createRenderer,requestWakeLock} from './render.js';
import {SyncClient,settingsFromURL,spectatorURL,normalizeRelay} from './sync.js';
const $=s=>document.querySelector(s);const render=createRenderer($('#stage'));
let options=settingsFromURL(),client,online=false,busy=false,stage=0,layout=[],category=null,force='girafa',timeline=[],commandTimer,lastTap=0,wake,wakeWanted=false,backstageAfterFinal=false;
let confirmed=frame(0,[]),pendingFrame=null,awaitingSnapshot=true,serverRevision=-1;
let appearance=normalizeAppearance(),draftAppearance=normalizeAppearance(),previewOrientation='portrait',pendingVisual=null;
const settingsPreview=createRenderer($('#appearance-preview'));
try{const saved=JSON.parse(localStorage.getItem(`thegrid.prep.${options.room}`)||'null');if(saved){if(ANIMALS.some(a=>a.id===saved.force))force=saved.force;if(saved.appearance)appearance=normalizeAppearance(saved.appearance);}}catch{}
for(const animal of ANIMALS){const opt=document.createElement('option');opt.value=animal.id;opt.textContent=animal.name;$('#force').append(opt);}
function notice(text){$('#notice').textContent=text;}
function cache(){localStorage.setItem(`thegrid.prep.${options.room}`,JSON.stringify({force,appearance}));}
function draw(){
 if(stage!==7)backstageAfterFinal=false;
 const presenting=stage>0&&!backstageAfterFinal;
 document.body.classList.toggle('presenting',presenting);
 $('#quick-reset').hidden=stage!==7||presenting;
 $('#quick-reset').disabled=busy||!online||awaitingSnapshot;
 render(pendingFrame??{...confirmed,appearance});$('#save').disabled=busy||!online||awaitingSnapshot;$('#preview-wait').hidden=stage!==0;$('#phase').textContent=STAGES[stage].name;$('#step-count').textContent=`${stage} / 7`;$('#hint').textContent=STAGES[stage].hint;$('#next-label').textContent=stage===1?'Toque na categoria escolhida para misturar':stage===7?'Force revelado':STAGES[stage].next;
 $('#advance').textContent=stage===1?'Toque em uma categoria':STAGES[stage].next;$('#advance').disabled=busy||!online||awaitingSnapshot||stage===7||stage===1;$('#back').disabled=busy||!online||awaitingSnapshot||stage===0;$('#surface').disabled=busy||(stage!==7&&(!online||awaitingSnapshot));$('#surface').classList.toggle('choosing-category',stage===1);$('#surface').setAttribute('aria-label',stage===1?'Toque na linha da categoria escolhida para misturar, dois toques voltam':'Um toque avança, dois toques voltam');$('.gesture-note').textContent=stage===1?'Toque em qualquer ponto da linha da categoria · 2 toques voltam':'Na grade: 1 toque avança · 2 toques voltam';
}
function connect(){
 client?.close();online=false;awaitingSnapshot=true;serverRevision=-1;draw();
 client=new SyncClient({...options,role:'controller',onStatus:status=>{
 online=status==='connected'||status==='demo';
 const labels={connected:'Conectado',demo:'Teste local',connecting:'Conectando',reconnecting:'Reconectando',offline:'Sem conexão',unconfigured:'Configurar sincronização'};
 $('#status').textContent=labels[status]||status;$('#status').className=`status ${online?'online':'error'}`;
 if(status==='unconfigured')notice('Configure a sincronização em Ajustes para controlar o público');draw();
 },onState:packet=>{
 if(!validateFrame(packet.frame)||packet.revision<serverRevision)return;serverRevision=packet.revision;
 // On every connection, the server is authoritative, including after a lost acknowledgment
 confirmed=packet.frame;appearance=normalizeAppearance(confirmed.appearance??appearance);stage=confirmed.stage;if(stage>=2){layout=[...confirmed.layout];force=layout[7];}
 if(awaitingSnapshot||!busy){timeline=Array.from({length:stage+1},(_,i)=>frame(i,layout));}
 awaitingSnapshot=false;draw();
 if(pendingVisual){const visual=pendingVisual;pendingVisual=null;queueMicrotask(async()=>{const ok=await publish(stage,layout,visual);if(ok){cache();notice('Ajustes salvos para esta sala');}});}
 }});
 if(options.demo){awaitingSnapshot=false;client.onRequest=()=>client.send(confirmed);draw();}
}
async function publish(nextStage,nextLayout=layout,nextAppearance=appearance){
 if(busy||!online||awaitingSnapshot)return;
 const previous=confirmed;const next=frame(nextStage,nextLayout,nextAppearance);
 busy=true;clearTimeout(commandTimer);pendingFrame=stage>0&&nextStage>0?next:null;draw();
 try{await client.send(next);confirmed=next;appearance=normalizeAppearance(next.appearance);stage=nextStage;layout=nextLayout;if(stage===0)category=null;timeline=Array.from({length:stage+1},(_,i)=>frame(i,layout));notice('');return true;}
 catch(error){notice(error.message);if(!options.demo)awaitingSnapshot=true;if(serverRevision<0)confirmed=previous;return false;}
 finally{pendingFrame=null;busy=false;draw();}
}
function advance(){if(busy)return;if(stage===7){backstageAfterFinal=true;draw();return;}if(stage===0)keepScreenAwake();if(stage===1){notice('Toque na linha da categoria escolhida para misturar');return;}publish(stage+1);}
function chooseCategory(selected){if(stage!==1||busy||!online||awaitingSnapshot)return;if(category!==selected||layout.length!==20)layout=createLayout(selected,force);category=selected;publish(2,layout);}
function categoryAtY(y){const cells=[...$('#stage').children];let selected=0,distance=Infinity;for(let row=0;row<4;row++){const rect=cells[row*5].getBoundingClientRect();const delta=Math.abs(y-(rect.top+rect.height/2));if(delta<distance){distance=delta;selected=row;}}return selected;}
function back(){if(stage>0)publish(stage-1);}
$('#advance').onclick=advance;$('#back').onclick=back;
$('#surface').addEventListener('click',event=>{keepScreenAwake();const now=performance.now();if(lastTap&&now-lastTap<280){clearTimeout(commandTimer);lastTap=0;back();}else{lastTap=now;const tapStage=stage;const selected=stage===1?categoryAtY(event.clientY):null;commandTimer=setTimeout(()=>{lastTap=0;if(stage!==tapStage)return;if(tapStage===1)chooseCategory(selected);else advance();},280);}});
$('#surface').addEventListener('keydown',event=>{if(stage===1&&/^[1-4]$/.test(event.key)){event.preventDefault();chooseCategory(Number(event.key)-1);}});
$('#surface').addEventListener('dblclick',e=>e.preventDefault());
function openSettings(){clearTimeout(commandTimer);lastTap=0;$('#force').value=force;$('#relay').value=options.relay;$('#room').value=options.room;$('#force').disabled=stage!==0;$('#settings-notice').textContent='';draftAppearance=normalizeAppearance(appearance);$('#settings').showModal();drawAppearancePreview();}
$('#settings-open').onclick=openSettings;
$('#save').onclick=async()=>{if(busy)return;try{
 const relay=normalizeRelay($('#relay').value.trim());const room=$('#room').value.trim();if(!/^[a-zA-Z0-9_-]{1,64}$/.test(room))throw Error('A sala aceita letras, números, _ e hífen');
 const changed=relay!==options.relay||room!==options.room;
 if(changed&&stage!==0)throw Error('Volte à espera antes de mudar a conexão ou a sala');
 if(stage===0){const nextForce=$('#force').value;if(nextForce!==force)layout=[];force=nextForce;}
 const visual=normalizeAppearance(draftAppearance);
 if(changed){options={...options,relay,room};localStorage.setItem('thegrid.relay',relay);localStorage.setItem('thegrid.room',room);pendingVisual=visual;confirmed=frame(0,[]);stage=0;layout=[];timeline=[];connect();$('#settings').close();notice('Conectando para salvar os ajustes');return;}
 const ok=await publish(stage,layout,visual);
 if(ok){cache();$('#settings').close();notice('Ajustes salvos para o mágico e os espectadores');}
 else $('#settings-notice').textContent='Os ajustes não foram confirmados, aguarde reconectar e salve novamente';
 }catch(error){$('#settings-notice').textContent=error.message;}};
function drawAppearancePreview(){
 const root=$('#appearance-preview');root.dataset.previewOrientation=previewOrientation;
 $('#preview-portrait').setAttribute('aria-selected',String(previewOrientation==='portrait'));$('#preview-landscape').setAttribute('aria-selected',String(previewOrientation==='landscape'));
 const values=draftAppearance[previewOrientation];$('#image-size').value=values.image;$('#font-size').value=values.font;$('#image-value').textContent=`${values.image}%`;$('#font-value').textContent=`${values.font}%`;
 settingsPreview(frame(1,[],draftAppearance));updatePreviewScale();
}
function updatePreviewScale(){const width=$('#appearance-preview').getBoundingClientRect().width;if(width)$('#appearance-preview').style.setProperty('--preview-factor',String(width/(previewOrientation==='portrait'?390:844)));}
new ResizeObserver(updatePreviewScale).observe($('#appearance-preview'));
$('#preview-portrait').onclick=()=>{previewOrientation='portrait';drawAppearancePreview();};$('#preview-landscape').onclick=()=>{previewOrientation='landscape';drawAppearancePreview();};
$('#image-size').addEventListener('input',()=>{draftAppearance[previewOrientation].image=Number($('#image-size').value);drawAppearancePreview();});
$('#font-size').addEventListener('input',()=>{draftAppearance[previewOrientation].font=Number($('#font-size').value);drawAppearancePreview();});
$('#appearance-default').onclick=()=>{draftAppearance[previewOrientation]={image:100,font:100};drawAppearancePreview();};
async function resetToWaiting(){if(busy)return;await publish(0,[]);if(stage===0&&$('#settings').open)$('#settings').close();}
$('#reset').onclick=resetToWaiting;$('#quick-reset').onclick=resetToWaiting;
$('#share').onclick=async()=>{if(!options.relay&&!options.demo){openSettings();$('#settings-notice').textContent='Configure o endereço de sincronização antes de compartilhar';return;}const url=spectatorURL(options);try{await navigator.clipboard.writeText(url);notice('Link do público copiado');}catch{notice(url);}};
async function keepScreenAwake(){wakeWanted=true;if(!wake||wake.released)wake=await requestWakeLock();$('#wake').textContent=wake?'Tela ativa':'Manter tela ligada';}
$('#wake').onclick=keepScreenAwake;
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&wakeWanted)keepScreenAwake();});
draw();connect();
