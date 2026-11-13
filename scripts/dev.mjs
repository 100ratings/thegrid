import {spawn} from 'node:child_process';
const argValue=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--ip',argValue('--host')||'127.0.0.1','--port',argValue('--port')||process.env.PORT||'5173'],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code||0));
