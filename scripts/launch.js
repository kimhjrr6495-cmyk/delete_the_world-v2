import { spawn, execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
async function isGame(port){try{const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(800)});return response.ok&&(await response.text()).includes('<title>DELETE THE WORLD');}catch{return false;}}
function available(port){return new Promise(resolve=>{const probe=createServer();probe.once('error',()=>resolve(false));probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve(true)));});}

let port;
for(let candidate=4173;candidate<=4193;candidate++){
  if(await isGame(candidate)){port=candidate;break;}
  if(await available(candidate)){port=candidate;const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port)},detached:true,stdio:'ignore',windowsHide:true});server.unref();break;}
}
if(!port){console.error('게임 포트를 열지 못했습니다. 4173–4193 포트 사용을 확인하세요.');process.exit(1);}
let ready=false;
for(let attempt=0;attempt<40;attempt++){if(await isGame(port)){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,150));}
if(!ready){console.error('게임 서버가 시작되지 않았습니다. node server.js로 오류를 확인하세요.');process.exit(1);}
const url=`http://127.0.0.1:${port}/`;
console.log(`DELETE THE WORLD 실행: ${url}`);
if(!process.argv.includes('--no-open')){
  const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
  execFile(command,args,{windowsHide:true},error=>{if(error){console.error(`브라우저에서 ${url}을 여세요.`);process.exitCode=1;}});
}
