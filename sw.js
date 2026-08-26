const SW_BUILD="4.0.4";
const OFFLINE_CACHE_PREFIX="imdoc-offline-v";
const SHELL_CACHE=`imdoc-shell-v${SW_BUILD}`;
const SHELL_FILES=[
  "./",
  "./index.html",
  "./style.css",
  "./editor.js",
  "./offline-fix.js?v=4.0.4",
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
  const req=event.request;
  if(req.method!=="GET")return;

  if(req.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        return await fetch(req);
      }catch(_){
        const fallback=await navigationFallback(req);
        if(fallback)return fallback;
        return new Response("오프라인 설치본을 찾을 수 없습니다.",{
          status:503,
          headers:{"Content-Type":"text/plain; charset=utf-8"}
        });
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    try{
      return await fetch(req);
    }catch(_){
      let hit=await matchInstalled(req,{ignoreSearch:true});
      if(hit)return hit;
      hit=await matchShell(req,{ignoreSearch:true});
      if(hit)return hit;
      return new Response("오프라인 상태이며 이 리소스는 오프라인 패키지에 없습니다.",{
        status:503,
        headers:{"Content-Type":"text/plain; charset=utf-8"}
      });
    }
  })());
});