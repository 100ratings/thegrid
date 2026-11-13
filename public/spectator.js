import {frame,validateFrame} from './engine.js';
import {createRenderer,requestWakeLock} from './render.js';
import {SyncClient,settingsFromURL} from './sync.js';
const render=createRenderer(document.querySelector('#stage'));const waiting=document.querySelector('#waiting');const connection=document.querySelector('#connection');let revision=-1;let wake;
render(frame(0,[]));
function showState(packet){if(!validateFrame(packet.frame))return;if(packet.revision<revision)return;revision=packet.revision;render(packet.frame);waiting.hidden=packet.frame.stage!==0;}
const client=new SyncClient({...settingsFromURL(),role:'spectator',onState:showState,onStatus:status=>{
 if(['connecting','reconnecting','offline'].includes(status)){connection.textContent=status==='connecting'?'Conectando à apresentação':'Reconectando…';connection.hidden=false;}else if(status==='unconfigured'){connection.textContent='Aguardando configuração da apresentação';connection.hidden=false;}else{connection.hidden=true;}
}});
document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('dragstart',e=>e.preventDefault());
async function wakeScreen(){wake=await requestWakeLock();}
wakeScreen();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){wakeScreen();if(client.demo)client.channel.postMessage({type:'request'});}});
// A touch can only request the browser's screen wake lock, never change the show
window.addEventListener('pointerdown',wakeScreen,{passive:true});
