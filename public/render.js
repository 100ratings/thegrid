import {ANIMALS,CATEGORIES,normalizeAppearance} from './engine.js';
const byId=new Map(ANIMALS.map(a=>[a.id,a]));
export function createRenderer(root){
 const cells=Array.from({length:20},(_,i)=>{const cell=document.createElement('div');cell.className='animal absent';cell.style.gridColumn=String(i%5+1);cell.style.gridRow=String(Math.floor(i/5)+1);const img=document.createElement('img');img.draggable=false;img.decoding='async';const art=document.createElement('div');art.className='animal-art';art.append(img);cell.append(art);root.append(cell);return cell;});
 // Decode all twenty local images before they are needed on stage
 for(const animal of ANIMALS){const img=new Image();img.src=animal.src;img.decode?.().catch(()=>{});}
 return state=>{
 const appearance=normalizeAppearance(state.appearance);
 for(const [direction,values] of Object.entries(appearance)){root.style.setProperty(`--image-${direction}`,String(values.image/100));root.style.setProperty(`--font-${direction}`,String(values.font/100));}
 root.classList.toggle('initial',state.stage===1);
 const visible=new Set(state.visible);
 cells.forEach((cell,i)=>{const animal=byId.get(state.layout[i]);const img=cell.querySelector('img');
 if(img.dataset.id!==animal.id){img.src=animal.src;img.alt=animal.name;img.dataset.id=animal.id;}
 cell.classList.toggle('absent',!visible.has(i));cell.setAttribute('aria-hidden',String(!visible.has(i)));
 let label=cell.querySelector('.category-label');
 if(state.stage===1&&i%5===0){if(!label){label=document.createElement('span');label.className='category-label';cell.append(label);}label.textContent=CATEGORIES[Math.floor(i/5)];}else label?.remove();
 });
 };
}
export async function requestWakeLock(){if(document.visibilityState!=='visible'||!navigator.wakeLock)return null;try{return await navigator.wakeLock.request('screen');}catch{return null;}}
