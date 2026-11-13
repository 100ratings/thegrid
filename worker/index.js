import {handleAPI} from './http.js';
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')||url.pathname==='/health'||request.method==='OPTIONS')return handleAPI(request,env);
  return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
 }
};
