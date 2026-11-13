export const ANIMALS = [
 ['elefante','Elefante'],['leao','Leão'],['girafa','Girafa'],['zebra','Zebra'],['rinoceronte','Rinoceronte'],
 ['tigre','Tigre'],['macaco','Macaco'],['panda','Panda'],['lobo','Lobo'],['urso','Urso'],
 ['golfinho','Golfinho'],['tubarao','Tubarão'],['baleia','Baleia'],['polvo','Polvo'],['tartaruga','Tartaruga'],
 ['aguia','Águia'],['coruja','Coruja'],['pinguim','Pinguim'],['flamingo','Flamingo'],['tucano','Tucano']
].map(([id,name],index)=>({id,name,category:Math.floor(index/5),src:`assets/${String(index+1).padStart(2,'0')}.png`}));
export const CATEGORIES = ['Savana','Selva','Aquáticos','Aves'];
export const TARGET = 7;
export const ALL = Array.from({length:20},(_,i)=>i);
export const MASKS = [[],ALL,ALL,
 ALL.filter(i=>![0,2,10,18].includes(i)),
 [3,4,6,7,8,12,13,14,16,17],
 [3,7,8,12,13,17],
 [7,8,12],[7]];
export const parity = i=>(Math.floor(i/5)+i%5)%2;
function shuffled(items,rng){
 const result=[...items];
 for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 return result;
}
export function createLayout(category,force,rng=Math.random){
 if(!Number.isInteger(category)||category<0||category>3||!ANIMALS.some(a=>a.id===force))throw Error('Preparação inválida');
 const layout=Array(20).fill(null);layout[TARGET]=force;
 const blue=shuffled(ALL.filter(i=>parity(i)===1&&i!==TARGET),rng);
 const chosen=shuffled(ANIMALS.filter(a=>a.category===category&&a.id!==force).map(a=>a.id),rng);
 for(const id of chosen)layout[blue.pop()]=id;
 const rest=shuffled(ANIMALS.map(a=>a.id).filter(id=>!layout.includes(id)),rng);
 for(const i of shuffled(ALL.filter(i=>layout[i]===null),rng))layout[i]=rest.pop();
 return layout;
}
export const DEFAULT_APPEARANCE = Object.freeze({portrait:Object.freeze({image:100,font:100}),landscape:Object.freeze({image:100,font:100})});
export function normalizeAppearance(value){
 const result={};
 for(const direction of ['portrait','landscape']){const v=value?.[direction];result[direction]={image:Number.isFinite(v?.image)?Math.min(240,Math.max(100,v.image)):100,font:Number.isFinite(v?.font)?Math.min(200,Math.max(80,v.font)):100};}
 return result;
}
export function validateAppearance(value){
 return !!value&&['portrait','landscape'].every(k=>value[k]&&Number.isFinite(value[k].image)&&value[k].image>=100&&value[k].image<=240&&Number.isFinite(value[k].font)&&value[k].font>=80&&value[k].font<=200);
}
export function frame(stage,layout,appearance){
 if(!Number.isInteger(stage)||stage<0||stage>7)throw Error('Etapa inválida');
 return {stage,layout:stage<2?ANIMALS.map(a=>a.id):[...layout],visible:[...MASKS[stage]],...(appearance===undefined?{}:{appearance:normalizeAppearance(appearance)})};
}
export const STAGES = [
 {name:'Em espera',next:'Mostrar animais',hint:'Prepare o force e compartilhe o link'},
 {name:'Escolha inicial',next:'Misturar animais',hint:'Peça uma categoria e um animal dessa categoria'},
 {name:'Grade misturada',next:'Primeira eliminação',hint:'Peça um número PAR de movimentos'},
 {name:'16 animais',next:'Segunda eliminação',hint:'Peça um número ÍMPAR de movimentos'},
 {name:'10 animais',next:'Terceira eliminação',hint:'Peça um número ÍMPAR de movimentos'},
 {name:'6 animais',next:'Quarta eliminação',hint:'Peça um número ÍMPAR de movimentos'},
 {name:'3 animais',next:'Revelar o force',hint:'Peça um número ÍMPAR de movimentos'},
 {name:'Revelação',next:'Finalizado',hint:'O público chegou ao force'}
];
export function validateFrame(value){
 if(value?.appearance!==undefined&&!validateAppearance(value.appearance))return false;
 if(!value||!Number.isInteger(value.stage)||value.stage<0||value.stage>7)return false;
 if(!Array.isArray(value.layout)||value.layout.length!==20||new Set(value.layout).size!==20||value.layout.some(id=>!ANIMALS.some(a=>a.id===id)))return false;
 return Array.isArray(value.visible)&&JSON.stringify(value.visible)===JSON.stringify(MASKS[value.stage]);
}
