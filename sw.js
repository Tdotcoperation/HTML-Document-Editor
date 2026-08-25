const OFFLINE_CACHE_PREFIX="imdoc-offline-v";

async function newestOfflineCacheName(){
  const keys=await caches.keys();
  const matches=keys.filter(k=>k.startsWith(OFFLINE_CACHE_PREFIX));
  return matches.sort().reverse()[0]||null;
}

self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;

  event.respondWith((async()=>{
    // Online: always prefer the current online version.
    try{
      return await fetch(req);
    }catch(_){
      // Offline: use explicitly installed resources.
      const cached=await caches.match(req);
      if(cached)return cached;

      if(req.mode==="navigate"){
        const cacheName=await newestOfflineCacheName();
        if(cacheName){
          const cache=await caches.open(cacheName);
          const indexUrl=new URL("./index.html",self.registration.scope).href;
          const fallback=await cache.match(indexUrl)||await cache.match("./index.html");
          if(fallback)return fallback;
        }
      }

      return new Response("오프라인 상태이며 이 리소스는 오프라인 패키지에 없습니다.",{
        status:503,
        headers:{"Content-Type":"text/plain; charset=utf-8"}
      });
    }
  })());
});
