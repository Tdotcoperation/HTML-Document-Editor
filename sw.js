const SW_BUILD="4.0.3";
const OFFLINE_CACHE_PREFIX="imdoc-offline-v";
const SHELL_CACHE=`imdoc-shell-v${SW_BUILD}`;
const SHELL_FILES=[
  "./",
  "./index.html",
  "./style.css",
  "./editor.js",
  "./offline-fix.js?v=4.0.2",
  "./version.json",
  "./manifest.webmanifest"
];

async function warmShell(){
  const cache=await caches.open(SHELL_CACHE);
  for(const item of SHELL_FILES){
    try{
      const url=new URL(item,self.registration.scope).href;
      const response=await fetch(url,{cache:"reload"});
      if(response.ok||response.type==="opaque") await cache.put(url,response.clone());
    }catch(err){
      console.warn("shell cache skipped",item,err);
    }
  }
}

async function installedCacheNames(){
  const keys=await caches.keys();
  return keys.filter(k=>k.startsWith(OFFLINE_CACHE_PREFIX)).sort().reverse();
}

async function matchInstalled(request,options={}){
  for(const name of await installedCacheNames()){
    const cache=await caches.open(name);
    const hit=await cache.match(request,options);
    if(hit)return hit;
  }
  return null;
}

async function matchShell(request,options={}){
  const cache=await caches.open(SHELL_CACHE);
  return await cache.match(request,options);
}

async function navigationFallback(request){
  let hit=await matchInstalled(request,{ignoreSearch:true});
  if(hit)return hit;
  hit=await matchShell(request,{ignoreSearch:true});
  if(hit)return hit;

  const scope=self.registration.scope;
  for(const url of [new URL("./",scope).href,new URL("./index.html",scope).href]){
    hit=await matchInstalled(url,{ignoreSearch:true});
    if(hit)return hit;
    hit=await matchShell(url,{ignoreSearch:true});
    if(hit)return hit;
  }
  return null;
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    await warmShell();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("imdoc-shell-v")&&k!==SHELL_CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING") self.skipWaiting();
  if(event.data?.type==="CLAIM_NOW") event.waitUntil(self.clients.claim());
  if(event.data?.type==="WARM_SHELL") event.waitUntil(warmShell());
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;

  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const network=await fetch(request);
        if(network)return network;
      }catch(_){}

      const fallback=await navigationFallback(request);
      if(fallback)return fallback;

      return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:32px;background:#f5f6f8;color:#222}main{max-width:640px;margin:80px auto;background:white;padding:28px;border-radius:14px}h1{font-size:22px}</style><main><h1>오프라인 편집기를 찾지 못했습니다.</h1><p>인터넷에 다시 연결한 뒤 HTML 문서 편집기를 한 번 열고, 검토 → 오프라인 설치를 다시 실행해 주세요.</p></main>`,{
        status:200,
        headers:{"Content-Type":"text/html; charset=utf-8"}
      });
    })());
    return;
  }

  event.respondWith((async()=>{
    try{
      return await fetch(request);
    }catch(_){
      let cached=await matchInstalled(request,{ignoreSearch:true});
      if(cached)return cached;
      cached=await matchShell(request,{ignoreSearch:true});
      if(cached)return cached;
      return new Response("오프라인 상태이며 이 리소스는 설치된 캐시에 없습니다.",{
        status:503,
        headers:{"Content-Type":"text/plain; charset=utf-8"}
      });
    }
  })());
});