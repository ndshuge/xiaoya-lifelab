// Local preview for 小芽 · 铅笔与墨水 (Opus Original). Binds to 127.0.0.1 only.
// Serves the repository root so the experiment can import the shared business modules unchanged.
// Usage: node preview-server.mjs [--personal] [--no-open] [--port 4417]
// localhost is a different browser origin from the live GitHub Pages site, so this preview never touches
// the browser data stored by the published 小芽.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(here,'../../..');
const args=process.argv.slice(2);
const want=Number(args[args.indexOf('--port')+1])||4417;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json',
 '.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 let rel;try{rel=decodeURIComponent(new URL(req.url,'http://x').pathname)}catch{res.writeHead(400);return res.end()}
 let file=path.normalize(path.join(ROOT,rel));
 if(!file.startsWith(ROOT)){res.writeHead(403);return res.end()}
 if(rel==='/'){res.writeHead(302,{location:'/little-works/xiaoya-apple/opus-original/'});return res.end()}
 fs.stat(file,(err,st)=>{
  if(!err&&st.isDirectory())file=path.join(file,'index.html');
  fs.readFile(file,(e,buf)=>{
   if(e){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});return res.end('未找到')}
   res.writeHead(200,{'content-type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(buf);
  });
 });
});
function listen(port,tries=0){
 server.once('error',e=>{if(e.code==='EADDRINUSE'&&tries<10)listen(port+1,tries+1);else{console.error(e.message);process.exit(1)}});
 server.listen(port,'127.0.0.1',()=>{
  const url='http://127.0.0.1:'+port+'/little-works/xiaoya-apple/opus-original/'+(args.includes('--personal')?'':'?judge=1');
  console.log('小芽 · 铅笔与墨水 预览已启动');
  console.log('  演示档案：http://127.0.0.1:'+port+'/little-works/xiaoya-apple/opus-original/?judge=1');
  console.log('  私人档案：http://127.0.0.1:'+port+'/little-works/xiaoya-apple/opus-original/');
  console.log('  正式版对照：http://127.0.0.1:'+port+'/little-works/xiaoya-apple/native-v4/?judge=1');
  console.log('关闭这个窗口即可停止预览。');
  if(!args.includes('--no-open')){
   const cmd=process.platform==='win32'?['cmd',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
   spawn(cmd[0],cmd[1],{detached:true,stdio:'ignore'}).unref();
  }
 });
}
listen(want);
