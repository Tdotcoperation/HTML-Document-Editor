(() => {
"use strict";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let editor=$("#editor"),paper=$("#paper");
const pageStack=$("#pageStack"),titleInput=$("#documentTitle"),mobileTitle=$("#mobileTitle");
const openFileInput=$("#openFileInput"),imageFileInput=$("#imageFileInput"),toastEl=$("#toast");
const desktopDropdown=$("#desktopDropdown"),sheetBackdrop=$("#sheetBackdrop"),sheetTitle=$("#sheetTitle"),sheetActions=$("#sheetActions");
const dialogBackdrop=$("#dialogBackdrop"),dialogTitle=$("#dialogTitle"),dialogBody=$("#dialogBody");
const fontFamily=$("#fontFamily"),mobileFontFamily=$("#mobileFontFamily"),fontSizeInput=$("#fontSizeInput"),fontSizeMenu=$("#fontSizeMenu");

let savedRange=null,dirty=false,zoom=100,selectedObject=null;
let dialogResolver=null,dropdownAnchor=null,objectCounter=0,spellcheckOn=true;
let page={name:"A4",width:210,height:297,orientation:"portrait",marginV:22,marginH:20};

const pageSizes={
  A2:[420,594],A3:[297,420],A4:[210,297],A5:[148,210],A6:[105,148],
  B4:[250,353],B5:[176,250]
};

const pinnedFonts=[
 ["Pretendard","Pretendard Variable"],["Wanted Sans [Variable]","Wanted Sans Variable"],
 ["G마켓 산스","Gmarket Sans"],["Paperlogy","Paperlogy"]
];
const googleFonts=[
"Noto Sans KR","Noto Serif KR","Nanum Gothic","Nanum Myeongjo","Nanum Gothic Coding","IBM Plex Sans KR","Gothic A1",
"Do Hyeon","Jua","Black Han Sans","Sunflower","Song Myung","Gaegu","Gamja Flower","Hi Melody","Cute Font","Poor Story",
"East Sea Dokdo","Dokdo","Yeon Sung","Single Day","Gugi","Kirang Haerang","Dongle","Bagel Fat One","Hahmlet","Gowun Dodum",
"Gowun Batang","Orbit","Grandiflora One","Diphylleia","Stylish","Black And White Picture","Moirai One","Roboto","Roboto Condensed",
"Roboto Slab","Open Sans","Lato","Montserrat","Poppins","Inter","Source Sans 3","Source Serif 4","Merriweather","Merriweather Sans",
"Nunito","Nunito Sans","Raleway","Oswald","Ubuntu","Rubik","Work Sans","Fira Sans","Fira Code","Inconsolata","PT Sans","PT Serif",
"Playfair Display","Libre Baskerville","Libre Franklin","Josefin Sans","Bitter","Arvo","Cabin","Quicksand","Karla","Manrope",
"DM Sans","DM Serif Display","Space Grotesk","Space Mono","Mulish","Archivo","Barlow","Barlow Condensed","Bebas Neue","Anton",
"Pacifico","Lobster","Caveat","Dancing Script","Comfortaa","Exo 2","Titillium Web","Assistant","Heebo","M PLUS 1p",
"M PLUS Rounded 1c","Noto Sans JP","Noto Serif JP","Noto Sans SC","Noto Serif SC","Noto Sans TC","Noto Serif TC",
"Zen Kaku Gothic New","Zen Old Mincho","Shippori Mincho","Kosugi","Kosugi Maru","Sawarabi Gothic","Sawarabi Mincho",
"Kaisei Decol","Kaisei Opti","Yusei Magic","Yuji Syuku","DotGothic16","Lexend","Atkinson Hyperlegible","Alegreya",
"Alegreya Sans","Cormorant Garamond","Crimson Text","Domine","EB Garamond","Spectral","Vollkorn","Zilla Slab","B612",
"B612 Mono","Urbanist","Outfit","Plus Jakarta Sans","Sora","Red Hat Display","Red Hat Text","Noto Sans","Noto Serif",
"Figtree","Onest","Albert Sans","Geologica","Jost","Prompt","Kanit","Sarabun","IBM Plex Sans","IBM Plex Serif","IBM Plex Mono",
"Source Code Pro","JetBrains Mono","Nanum Pen Script","Nanum Brush Script"
];
const systemFonts=["맑은 고딕","돋움","굴림","바탕","궁서","Apple SD Gothic Neo","AppleGothic","Arial","Arial Black","Calibri","Cambria",
"Candara","Century Gothic","Consolas","Courier New","Georgia","Helvetica","Palatino Linotype","Segoe UI","Tahoma","Times New Roman",
"Trebuchet MS","Verdana"];

const loadedGoogleFonts=new Set();

const APP_VERSION="4.0.0";
const OFFLINE_CACHE_PREFIX="imdoc-offline-v";
const OFFLINE_FONT_WEIGHT="400";
const OFFLINE_ESTIMATED_MIN_MB=80;
const OFFLINE_ESTIMATED_MAX_MB=250;
let offlineInstallRunning=false;

const OFFLINE_CORE_FILES=[
  "./index.html","./style.css","./editor.js","./sw.js","./version.json","./manifest.webmanifest"
];

const OFFLINE_FIXED_STYLESHEETS=[
  "https://cdn.jsdelivr.net/gh/toss/tossface/dist/tossface.css",
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css",
  "https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.1/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css",
  "https://cdn.jsdelivr.net/gh/fonts-archive/GmarketSans/subsets/GmarketSans-dynamic-subset.css",
  "https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css"
];

function isMobile(){return matchMedia("(max-width:760px)").matches}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function safeFilename(s){return (s||"새 문서").replace(/[\\/:*?"<>|]/g,"_").trim()||"새 문서"}
function showToast(msg){toastEl.textContent=msg;toastEl.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toastEl.classList.remove("show"),1400)}

function formatBytes(bytes){
 const n=Number(bytes)||0;
 if(n<1024)return `${n} B`;
 if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;
 if(n<1024*1024*1024)return `${(n/1024/1024).toFixed(1)} MB`;
 return `${(n/1024/1024/1024).toFixed(2)} GB`;
}
function offlineInstalledVersion(){return localStorage.getItem("imdocOfflineVersion")||"설치 안 됨"}
function offlineInstalledBytes(){return Number(localStorage.getItem("imdocOfflineBytes")||0)}
async function getOnlineVersion(){
 try{
  const r=await fetch(`./version.json?t=${Date.now()}`,{cache:"no-store"});
  if(!r.ok)throw new Error("version");
  const data=await r.json();
  return data.version||APP_VERSION;
 }catch(_){
  return navigator.onLine?"확인 실패":"확인 불가 (오프라인)";
 }
}
function updateNetworkModeUI(){
 const offline=!navigator.onLine;
 const badge=$("#networkModeBadge");
 const mobile=$("#mobileNetworkMode");
 if(badge){
  badge.textContent=offline?"오프라인 모드":"온라인";
  badge.classList.toggle("offline",offline);
  badge.classList.toggle("online",!offline);
 }
 if(mobile){
  mobile.textContent=offline?"오프라인 모드":"온라인";
  mobile.classList.toggle("offline",offline);
 }
}
async function registerOfflineServiceWorker(){
 if(!("serviceWorker" in navigator))return false;
 if(location.protocol!=="https:"&&location.hostname!=="localhost"&&location.hostname!=="127.0.0.1")return false;
 try{
  await navigator.serviceWorker.register("./sw.js",{scope:"./"});
  await navigator.serviceWorker.ready;
  return true;
 }catch(err){
  console.warn("Service Worker registration failed",err);
  return false;
 }
}
function googleOfflineStylesheetUrl(family){
 return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g,"+")}:wght@${OFFLINE_FONT_WEIGHT}&display=swap`;
}
function extractCssUrls(cssText,baseUrl){
 const urls=[];
 const re=/url\(([^)]+)\)/g;
 let m;
 while((m=re.exec(cssText))){
  const raw=m[1].trim().replace(/^['"]|['"]$/g,"");
  if(!raw||raw.startsWith("data:"))continue;
  try{urls.push(new URL(raw,baseUrl).href)}catch(_){}
 }
 return urls;
}
async function storageAvailableText(){
 if(!navigator.storage?.estimate)return "확인 불가";
 try{
  const e=await navigator.storage.estimate();
  const free=Math.max(0,(e.quota||0)-(e.usage||0));
  return formatBytes(free);
 }catch(_){return "확인 불가"}
}

function markDirty(){dirty=true;$("#saveStatus").textContent="저장 안 됨";$("#mobileSaveState").textContent="저장 안 됨"}
function markSaved(){dirty=false;$("#saveStatus").textContent="저장됨";$("#mobileSaveState").textContent="저장됨"}
function updateTitleUI(){const n=titleInput.value.trim()||"새 문서";mobileTitle.textContent=n+".html";document.title=n+" - HTML 문서 편집기"}
function getEditors(){return $$(".page-editor",pageStack)}
function getPapers(){return $$(".paper",pageStack)}
function flowChildren(ed){return [...ed.children].filter(n=>!n.classList.contains("floating-object")&&!n.classList.contains("hard-page-boundary"))}
function firstFlowChild(ed){return flowChildren(ed)[0]||null}
function lastFlowChild(ed){const a=flowChildren(ed);return a[a.length-1]||null}
function hasFlowContent(ed){return flowChildren(ed).some(n=>n.textContent.trim()||n.querySelector?.("br,table,img,video,audio,details,pre,hr"))}
function countChars(){const n=getEditors().reduce((sum,ed)=>sum+(ed.innerText||"").replace(/\s/g,"").length,0);$("#charCount").textContent=n+"자"}
function activateEditor(ed){
 if(!ed||!ed.classList.contains("page-editor"))return;
 editor=ed;paper=ed.closest(".paper")||paper;updatePageStatus();
}
function updatePageNumbers(){getPapers().forEach((p,i)=>p.dataset.page=String(i+1));updatePageStatus()}
function updatePageStatus(){
 const editors=getEditors();let idx=Math.max(0,editors.indexOf(editor));
 $("#pageStatus").textContent=`${idx+1} / ${editors.length} 쪽 · ${page.name} · ${page.orientation==="portrait"?"세로":"가로"}`;
}
function bindPageEditor(ed){
 if(ed.dataset.pageBound==="1")return;ed.dataset.pageBound="1";ed.spellcheck=spellcheckOn;
 ed.addEventListener("focus",()=>activateEditor(ed));
 ed.addEventListener("pointerdown",()=>activateEditor(ed));
 ed.addEventListener("input",(ev)=>{
  activateEditor(ed);normalizeMobileBlocks(ed);countChars();markDirty();
  const type=ev.inputType||"";
  const needsPush=isOverflow(ed)||!!ed.querySelector(":scope > .page-break");
  const needsPull=getEditors().length>1&&(
    type.startsWith("delete")||
    type==="historyUndo"||
    type==="historyRedo"||
    type==="deleteByCut"
  );
  if(needsPush||needsPull)queuePagination();
 });
 ed.addEventListener("paste",()=>setTimeout(()=>{
  activateEditor(ed);normalizeMobileBlocks(ed);countChars();markDirty();
  if(isOverflow(ed)||getEditors().length>1)queuePagination();
 },0));
}
function createPage(afterPaper=null){
 const section=document.createElement("section");section.className="paper";
 const ed=document.createElement("article");ed.className="page-editor imdoc-document";ed.contentEditable="true";ed.spellcheck=spellcheckOn;ed.setAttribute("aria-label","문서 편집 영역");
 ed.style.padding=`${page.marginV}mm ${page.marginH}mm`;section.appendChild(ed);
 if(afterPaper?.parentNode===pageStack)afterPaper.after(section);else pageStack.appendChild(section);
 bindPageEditor(ed);section.style.transform=`scale(${zoom/100})`;section.style.marginBottom=Math.max(0,(zoom-100)*12)+"px";updatePageNumbers();return ed;
}
function removePage(ed){const p=ed.closest(".paper");if(!p||getEditors().length<=1)return;if(editor===ed){const list=getEditors(),idx=list.indexOf(ed);activateEditor(list[Math.max(0,idx-1)])}p.remove();updatePageNumbers()}
function clearToSinglePage(html="<p><br></p>"){
 const papers=getPapers();papers.slice(1).forEach(p=>p.remove());
 const first=getEditors()[0];editor=first;paper=first.closest(".paper");first.innerHTML=html;first.style.padding=`${page.marginV}mm ${page.marginH}mm`;bindPageEditor(first);updatePageNumbers();
}
function normalizeTopLevelNodes(ed){
 [...ed.childNodes].forEach(n=>{if(n.nodeType===3){if(!n.nodeValue.trim()){n.remove();return}const p=document.createElement("p");n.replaceWith(p);p.appendChild(n)}else if(n.nodeType===1&&n.tagName==="BR"){const p=document.createElement("p");p.innerHTML="<br>";n.replaceWith(p)}})
}
function isOverflow(ed){
 const last=lastFlowChild(ed);if(!last)return false;
 const er=ed.getBoundingClientRect(),style=getComputedStyle(ed),limit=er.bottom-parseFloat(style.paddingBottom||0);
 const rect=last.getBoundingClientRect();return rect.bottom>limit+0.75;
}
function isSplittableBlock(el){return !!el&&/^(P|DIV|H1|H2|H3|H4|H5|H6|BLOCKQUOTE)$/.test(el.tagName)&&!el.classList.contains("page-break")&&!el.classList.contains("floating-object")}
function textBoundary(root,offset){
 if(offset<=0)return {node:root,offset:0};
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n,seen=0,last=null;
 while(n=walker.nextNode()){last=n;const len=n.nodeValue.length;if(seen+len>=offset)return {node:n,offset:Math.max(0,offset-seen)};seen+=len}
 return last?{node:last,offset:last.nodeValue.length}:{node:root,offset:root.childNodes.length};
}
function splitBlockAt(el,offset){
 const total=el.textContent.length;offset=Math.max(0,Math.min(total,offset));
 const point=textBoundary(el,offset),left=el.cloneNode(false),right=el.cloneNode(false);
 const a=document.createRange();a.selectNodeContents(el);a.setEnd(point.node,point.offset);left.appendChild(a.cloneContents());
 const b=document.createRange();b.selectNodeContents(el);b.setStart(point.node,point.offset);right.appendChild(b.cloneContents());
 return [left,right];
}
function bestPrefixThatFits(ed,el,mode="replace"){
 const total=el.textContent.length;if(total<2)return 0;let lo=1,hi=total-1,best=0,test=null,placeholder=null;
 if(mode==="replace"){placeholder=document.createComment("paginate");el.before(placeholder);el.remove()}
 const placeTest=node=>{if(test)test.remove();test=node;if(mode==="replace")placeholder.before(test);else ed.appendChild(test)};
 while(lo<=hi){const mid=Math.floor((lo+hi)/2),parts=splitBlockAt(el,mid);placeTest(parts[0]);if(!isOverflow(ed)){best=mid;lo=mid+1}else hi=mid-1}
 if(test)test.remove();if(mode==="replace"){placeholder.before(el);placeholder.remove()}
 return best;
}
function insertAtFlowStart(ed,node){const first=firstFlowChild(ed);if(first)ed.insertBefore(node,first);else ed.appendChild(node)}
function processForcedBreaks(){
 let changed=false;for(let i=0;i<getEditors().length;i++){
  const ed=getEditors()[i];let br=[...ed.children].find(n=>n.classList?.contains("page-break"));
  while(br){let next=getEditors()[i+1]||createPage(ed.closest(".paper"));const moving=[];let n=br.nextSibling;while(n){const nx=n.nextSibling;if(!n.classList?.contains("floating-object"))moving.push(n);n=nx}
   moving.reverse().forEach(node=>insertAtFlowStart(next,node));br.classList.remove("page-break");br.classList.add("hard-page-boundary");br.removeAttribute("contenteditable");br.innerHTML="";if(!moving.length&&!hasFlowContent(next))next.innerHTML="<p><br></p>";changed=true;br=[...ed.children].find(n=>n.classList?.contains("page-break"));
  }
 }
 return changed;
}
function pushOverflowForward(){
 let safety=0;
 for(let i=0;i<getEditors().length&&safety<1000;i++){
  let ed=getEditors()[i];while(isOverflow(ed)&&safety++<1000){
   const block=lastFlowChild(ed);if(!block)break;let next=getEditors()[i+1]||createPage(ed.closest(".paper"));
   const only=flowChildren(ed).length===1;
   if(isSplittableBlock(block)&&block.textContent.length>1){const best=bestPrefixThatFits(ed,block,"replace");if(best>0&&best<block.textContent.length){const [left,right]=splitBlockAt(block,best);block.replaceWith(left);insertAtFlowStart(next,right);continue}}
   if(only&&isOverflow(ed))break;
   block.remove();insertAtFlowStart(next,block);
  }
 }
}
function tryPullFromNext(cur,next){
 const block=firstFlowChild(next);if(!block)return false;
 const clone=block.cloneNode(true);cur.appendChild(clone);const wholeFits=!isOverflow(cur);clone.remove();
 if(wholeFits){cur.appendChild(block);return true}
 if(isSplittableBlock(block)&&block.textContent.length>1){const best=bestPrefixThatFits(cur,block,"append");if(best>0&&best<block.textContent.length){const [left,right]=splitBlockAt(block,best);cur.appendChild(left);block.replaceWith(right);return true}}
 return false;
}
function pullContentBackward(){
 let safety=0;for(let i=0;i<getEditors().length-1&&safety<1000;i++){
  const cur=getEditors()[i],next=getEditors()[i+1];if(cur.querySelector(":scope > .hard-page-boundary"))continue;while(safety++<1000&&tryPullFromNext(cur,next)){}
 }
 for(let i=getEditors().length-1;i>0;i--){const ed=getEditors()[i];if(!hasFlowContent(ed)&&!ed.querySelector(".floating-object"))removePage(ed)}
}
function captureCaretGlobal(){
 const sel=getSelection();if(!sel||!sel.rangeCount)return null;const range=sel.getRangeAt(0);const ed=getEditors().find(x=>x.contains(range.startContainer));if(!ed)return null;
 let count=0;for(const e of getEditors()){if(e===ed){const r=document.createRange();r.selectNodeContents(e);try{r.setEnd(range.startContainer,range.startOffset);count+=r.toString().length}catch(_){}break}count+=(e.textContent||"").length}
 return count;
}
function restoreCaretGlobal(offset){
 if(offset==null)return;let seen=0,lastEd=getEditors().at(-1);for(const ed of getEditors()){
  const walker=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const len=n.nodeValue.length;if(seen+len>=offset){const r=document.createRange();r.setStart(n,Math.max(0,offset-seen));r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);activateEditor(ed);return}seen+=len}lastEd=ed
 }
 const r=document.createRange();r.selectNodeContents(lastEd);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);activateEditor(lastEd);
}

/* Preserve an exact caret position, including empty paragraphs created by Enter.
   A text-offset alone cannot distinguish "end of previous paragraph" from
   "start of a new empty paragraph", so pagination temporarily inserts a
   zero-size marker at the caret and moves it together with the content. */
let caretMarkerSeq=0;
function captureCaretState(){
 const sel=getSelection();
 if(!sel||!sel.rangeCount)return null;
 const range=sel.getRangeAt(0);
 const owner=getEditors().find(ed=>ed.contains(range.startContainer));
 if(!owner)return null;

 if(!range.collapsed)return {kind:"offset",value:captureCaretGlobal()};

 const id="imdoc-caret-"+(++caretMarkerSeq);
 const marker=document.createElement("span");
 marker.dataset.caretMarker=id;
 marker.setAttribute("aria-hidden","true");
 marker.contentEditable="false";
 marker.style.cssText="display:inline-block;width:0;height:0;overflow:hidden;line-height:0;font-size:0;padding:0;margin:0;border:0;";

 const r=range.cloneRange();
 r.collapse(true);
 r.insertNode(marker);

 const after=document.createRange();
 after.setStartAfter(marker);
 after.collapse(true);
 sel.removeAllRanges();
 sel.addRange(after);

 return {kind:"marker",id,fallback:captureCaretGlobal()};
}
function restoreCaretState(state){
 if(!state)return;

 if(state.kind==="marker"){
  const markers=$$(`[data-caret-marker="${state.id}"]`,pageStack);
  const marker=markers[0];
  if(marker&&marker.parentNode){
   const parent=marker.parentNode;
   const index=[...parent.childNodes].indexOf(marker);
   markers.forEach(m=>m.remove());

   const range=document.createRange();
   range.setStart(parent,Math.max(0,Math.min(index,parent.childNodes.length)));
   range.collapse(true);
   const sel=getSelection();
   sel.removeAllRanges();
   sel.addRange(range);

   const owner=getEditors().find(ed=>ed.contains(parent));
   if(owner)activateEditor(owner);
   return;
  }
  restoreCaretGlobal(state.fallback);
  return;
 }

 restoreCaretGlobal(state.value);
}

let paginationQueued=false,paginating=false;
function paginateDocument(preserveCaret=true){
 if(paginating)return;
 paginating=true;
 const caret=preserveCaret?captureCaretState():null;
 try{
  getEditors().forEach(normalizeTopLevelNodes);
  processForcedBreaks();
  pushOverflowForward();
  pullContentBackward();
  pushOverflowForward();
  updatePageNumbers();
  bindAllFloatingObjects();
  countChars();
 }finally{
  paginating=false;
 }
 if(preserveCaret)restoreCaretState(caret);
}
function queuePagination(){if(paginationQueued)return;paginationQueued=true;requestAnimationFrame(()=>{paginationQueued=false;paginateDocument(true)})}

function saveSelection(){
 const sel=getSelection(); if(!sel||!sel.rangeCount)return;
 const r=sel.getRangeAt(0); if(editor.contains(r.commonAncestorContainer))savedRange=r.cloneRange();
}
function restoreSelection(){
 if(!savedRange)return false; const sel=getSelection();sel.removeAllRanges();sel.addRange(savedRange);return true;
}
function exec(cmd,val=null){restoreSelection();editor.focus();try{document.execCommand("styleWithCSS",false,true)}catch(_){}
 document.execCommand(cmd,false,val);saveSelection();markDirty();queuePagination();
}

function closeDropdown(){desktopDropdown.classList.remove("open");desktopDropdown.innerHTML="";dropdownAnchor=null}
function openDesktopDropdown(anchor,items){
 if(isMobile())return;
 closeDropdown();dropdownAnchor=anchor;
 items.forEach(item=>{
  if(item==="sep"){const s=document.createElement("div");s.className="dropdown-sep";desktopDropdown.appendChild(s);return}
  const b=document.createElement("button");b.className="dropdown-item";b.type="button";
  b.innerHTML=`<span class="drop-icon tossface">${item.icon||""}</span><span>${escapeHtml(item.label)}</span>${item.key?`<span class="drop-key">${escapeHtml(item.key)}</span>`:""}`;
  b.onclick=()=>{closeDropdown();item.action?.()};
  desktopDropdown.appendChild(b);
 });
 const r=anchor.getBoundingClientRect();
 desktopDropdown.style.left=Math.min(r.left,innerWidth-310)+"px";
 desktopDropdown.style.top=(r.bottom+2)+"px";
 desktopDropdown.classList.add("open");
}

function openSheet(title,items){
 if(!isMobile())return;
 sheetTitle.textContent=title;sheetActions.innerHTML="";
 items.forEach(item=>{
  const b=document.createElement("button");b.type="button";
  b.innerHTML=`<span class="sheet-icon tossface">${item.icon||""}</span><span>${escapeHtml(item.label)}</span>`;
  b.onclick=()=>{closeSheet();setTimeout(()=>item.action?.(),0)};
  sheetActions.appendChild(b);
 });
 sheetBackdrop.classList.add("open");
}
function closeSheet(){sheetBackdrop.classList.remove("open")}

function openDialog(title,html,afterOpen=null){
 closeDropdown();closeSheet();dialogTitle.textContent=title;dialogBody.innerHTML=html;dialogBackdrop.classList.add("open");
 afterOpen?.();
}
function closeDialog(result=null){
 dialogBackdrop.classList.remove("open");dialogBody.innerHTML="";
 const resolve=dialogResolver;dialogResolver=null;if(resolve)resolve(result);
}
function siteConfirm(title,message,okText="확인",cancelText="취소"){
 return new Promise(resolve=>{
  dialogResolver=resolve;
  openDialog(title,`<div class="dialog-message">${escapeHtml(message)}</div>
    <div class="dialog-actions"><button id="dlgCancel">${escapeHtml(cancelText)}</button><button id="dlgOk" class="primary">${escapeHtml(okText)}</button></div>`,()=>{
      $("#dlgCancel").onclick=()=>closeDialog(false);$("#dlgOk").onclick=()=>closeDialog(true);$("#dlgOk").focus();
    });
 });
}
function sitePrompt(title,label,initial="",okText="확인",type="text"){
 return new Promise(resolve=>{
  dialogResolver=resolve;
  openDialog(title,`<div class="dialog-row"><label for="dlgInput">${escapeHtml(label)}</label><input id="dlgInput" type="${type}" value="${escapeHtml(initial)}"></div>
   <div class="dialog-actions"><button id="dlgCancel">취소</button><button id="dlgOk" class="primary">${escapeHtml(okText)}</button></div>`,()=>{
    const input=$("#dlgInput");input.focus();input.select();
    $("#dlgCancel").onclick=()=>closeDialog(null);
    $("#dlgOk").onclick=()=>closeDialog(input.value);
    input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();closeDialog(input.value)}};
  });
 });
}

async function requestSaveName(){
 return new Promise(resolve=>{
  dialogResolver=resolve;
  const initial=titleInput.value.trim()||"새 문서";
  openDialog("문서 저장",`<div class="dialog-message">저장할 HTML 문서의 이름을 입력하세요.</div>
   <div class="dialog-row"><label for="saveNameInput">문서 이름</label><input id="saveNameInput" value="${escapeHtml(initial)}" autocomplete="off"></div>
   <div class="dialog-actions"><button id="saveCancel">취소</button><button id="saveOk" class="primary">OK</button></div>`,()=>{
    const inp=$("#saveNameInput");inp.focus();inp.select();
    $("#saveCancel").onclick=()=>closeDialog(null);
    const submit=()=>{let v=inp.value.trim();if(!v){inp.focus();showToast("문서 이름을 입력하세요.");return}closeDialog(v.replace(/\.html?$/i,""))};
    $("#saveOk").onclick=submit;inp.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();submit()}};
  });
 });
}

function cleanCloneForExport(ed){
 const clone=ed.cloneNode(true);clone.removeAttribute("id");clone.removeAttribute("contenteditable");clone.removeAttribute("data-page-bound");
 $$(".floating-object",clone).forEach(obj=>{obj.classList.remove("selected","interactive");$$(".object-toolbar,.resize-handle",obj).forEach(n=>n.remove());obj.removeAttribute("contenteditable");const iframe=$("iframe",obj);if(iframe)iframe.removeAttribute("tabindex")});
 $$(".page-break,.hard-page-boundary",clone).forEach(n=>n.remove());return clone;
}
function exportDocumentHtml(){
 const title=titleInput.value.trim()||"새 문서",w=page.orientation==="portrait"?page.width:page.height,h=page.orientation==="portrait"?page.height:page.width;
 const pages=getEditors().map((ed,i)=>{const clone=cleanCloneForExport(ed);return `<article class="imdoc-document imdoc-page" data-page="${i+1}">${clone.innerHTML}</article>`}).join("\n");
 return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="imdoc-version" content="3.0"><meta name="imdoc-page" content="${escapeHtml(page.name)}"><title>${escapeHtml(title)}</title><style>
@page{size:${w}mm ${h}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#eef0f2;color:#111}body{font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif}.imdoc-page{position:relative;width:${w}mm;height:${h}mm;margin:18px auto;background:#fff;padding:${page.marginV}mm ${page.marginH}mm;box-shadow:0 2px 12px rgba(0,0,0,.14);font-size:10pt;line-height:1.65;word-break:break-word;overflow:hidden;break-after:page}.imdoc-page p,.imdoc-page div:not(.floating-object){margin:0}.imdoc-page table{width:100%;border-collapse:collapse;margin:8pt 0}.imdoc-page td,.imdoc-page th{border:1px solid #222;padding:5pt}.imdoc-page pre{white-space:pre-wrap;background:#f5f6f8;border:1px solid #e0e3e7;border-radius:6px;padding:10pt}.imdoc-page details{margin:8pt 0;padding:7pt 9pt;border:1px solid #dfe2e6;border-radius:6px}.floating-object{position:absolute!important;z-index:30;margin:0!important;padding:0!important}.floating-object .object-content{width:100%;height:100%;display:block;overflow:hidden}.floating-object img,.floating-object iframe,.floating-object video{width:100%;height:100%;display:block;object-fit:contain;border:0}@media(max-width:760px){html,body{background:#eef0f2}.imdoc-page{width:100%;height:auto;min-height:141vw;margin:0 0 12px;padding:26px 19px;box-shadow:none;font-size:16px;overflow:visible}}@media print{html,body{background:#fff}.imdoc-page{width:${w}mm;height:${h}mm;margin:0;padding:${page.marginV}mm ${page.marginH}mm;box-shadow:none;overflow:hidden;break-after:page}.imdoc-page:last-child{break-after:auto}}
</style></head><body>${pages}</body></html>`;
}
async function saveDocument(){
 const name=await requestSaveName();if(!name)return;
 titleInput.value=name;updateTitleUI();
 const blob=new Blob([exportDocumentHtml()],{type:"text/html;charset=utf-8"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=safeFilename(name)+".html";document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);markSaved();showToast("문서를 다운로드했습니다.");
}

function sanitizeImportedPages(raw){
 const doc=new DOMParser().parseFromString(raw,"text/html");doc.querySelectorAll("script,object,embed,form,meta[http-equiv]").forEach(n=>n.remove());doc.querySelectorAll("*").forEach(el=>[...el.attributes].forEach(a=>{if(/^on/i.test(a.name))el.removeAttribute(a.name)}));
 let sources=[...doc.querySelectorAll(".imdoc-page")];if(!sources.length){const one=doc.querySelector(".imdoc-document")||doc.querySelector("article")||doc.body;sources=[one]}
 return sources.map(src=>src.innerHTML);
}
function loadPageHtmlList(htmlList){
 clearToSinglePage(htmlList[0]||"<p><br></p>");for(let i=1;i<htmlList.length;i++){const ed=createPage(getPapers().at(-1));ed.innerHTML=htmlList[i]||"<p><br></p>"}
 getEditors().forEach(ed=>{bindPageEditor(ed);bindAllFloatingObjects()});activateEditor(getEditors()[0]);updatePageNumbers();
}
async function loadHtmlFile(file){
 const raw=await file.text();loadPageHtmlList(sanitizeImportedPages(raw));titleInput.value=file.name.replace(/\.html?$/i,"");updateTitleUI();paginateDocument(false);countChars();markSaved();showToast("문서를 열었습니다.");
}
async function openDocument(){
 if(dirty){const ok=await siteConfirm("문서 열기","저장하지 않은 내용이 있습니다. 그래도 다른 문서를 열까요?","열기");if(!ok)return}
 openFileInput.click();
}
async function newDocument(){
 if(dirty){const ok=await siteConfirm("새 문서","저장하지 않은 내용이 있습니다. 새 문서를 만들까요?","새 문서");if(!ok)return}
 titleInput.value="새 문서 1";updateTitleUI();clearToSinglePage("<p><br></p>");selectedObject=null;countChars();markSaved();editor.focus();
}

function fillFonts(){
 const add=(sel,label,items)=>{const g=document.createElement("optgroup");g.label=label;items.forEach(it=>{const [n,f]=Array.isArray(it)?it:[it,it];const o=document.createElement("option");o.textContent=n;o.value=f;g.appendChild(o)});sel.appendChild(g)};
 add(fontFamily,"추천 글꼴",pinnedFonts);add(fontFamily,"웹 글꼴",googleFonts);add(fontFamily,"시스템 글꼴",systemFonts);fontFamily.value="Pretendard Variable";
 [...pinnedFonts,["Noto Sans KR","Noto Sans KR"],["Nanum Gothic","Nanum Gothic"],["Nanum Myeongjo","Nanum Myeongjo"],["Gowun Dodum","Gowun Dodum"],["Gowun Batang","Gowun Batang"],["IBM Plex Sans KR","IBM Plex Sans KR"]].forEach(([n,f])=>{const o=document.createElement("option");o.textContent=n;o.value=f;mobileFontFamily.appendChild(o)});
 $("#fontCount").textContent=(pinnedFonts.length+googleFonts.length+systemFonts.length)+"개";
}
async function loadGoogleFont(family){
 if(!googleFonts.includes(family)||loadedGoogleFonts.has(family))return;loadedGoogleFonts.add(family);
 const link=document.createElement("link");link.rel="stylesheet";link.href=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g,"+")}:wght@400&display=swap`;document.head.appendChild(link);
}
async function applyFont(f){await loadGoogleFont(f);restoreSelection();editor.focus();document.execCommand("fontName",false,f);fontFamily.value=f;if([...mobileFontFamily.options].some(o=>o.value===f))mobileFontFamily.value=f;$$(".font-chip").forEach(b=>b.classList.toggle("active",b.dataset.font===f));markDirty();queuePagination()}
function applyFontSize(pt){
 pt=Math.max(1,Math.min(300,Number(pt)||10));fontSizeInput.value=pt;restoreSelection();editor.focus();document.execCommand("fontSize",false,"7");
 editor.querySelectorAll('font[size="7"]').forEach(n=>{n.removeAttribute("size");n.style.fontSize=pt+"pt"});markDirty();saveSelection();queuePagination();
}
function applyBlockStyle(tag){
 restoreSelection();editor.focus();document.execCommand("formatBlock",false,tag==="body"?"p":tag);markDirty();queuePagination();
}

function updatePage(){
 const [baseW,baseH]=pageSizes[page.name]||pageSizes.A4;page.width=baseW;page.height=baseH;
 const w=page.orientation==="portrait"?baseW:baseH,h=page.orientation==="portrait"?baseH:baseW;
 document.documentElement.style.setProperty("--page-width",w+"mm");document.documentElement.style.setProperty("--page-height",h+"mm");document.documentElement.style.setProperty("--page-ratio",String(h/w));
 getEditors().forEach(ed=>ed.style.padding=`${page.marginV}mm ${page.marginH}mm`);
 $("#dynamicPrintStyle").textContent=`@page{size:${w}mm ${h}mm;margin:0}`;rebuildRulers();paginateDocument(false);updatePageStatus();markDirty();
}
function rebuildRulers(){
 const hr=$("#horizontalRuler"),vr=$("#verticalRuler");hr.innerHTML="";vr.innerHTML="";
 if(isMobile())return;
 const wmm=page.orientation==="portrait"?page.width:page.height,hmm=page.orientation==="portrait"?page.height:page.width;
 const widthPx=wmm*96/25.4;hr.style.width=widthPx+"px";
 for(let mm=0;mm<=wmm;mm+=2.5){const x=mm/wmm*widthPx;const t=document.createElement("span");t.className="ruler-tick";t.style.left=x+"px";t.style.height=(mm%10===0?13:mm%5===0?9:5)+"px";hr.appendChild(t);if(mm>0&&mm<wmm&&mm%10===0){const l=document.createElement("span");l.className="ruler-label";l.style.left=x+"px";l.textContent=String(mm/10);hr.appendChild(l)}}
 const stepPx=10*96/25.4;for(let mm=0;mm<=hmm;mm+=10){const t=document.createElement("div");t.className="vertical-tick";t.style.height=stepPx+"px";if(mm){const s=document.createElement("span");s.textContent=String(mm/10);t.appendChild(s)}vr.appendChild(t)}
}
function openPageSetup(){
 const options=Object.keys(pageSizes).map(n=>`<option ${n===page.name?"selected":""}>${n}</option>`).join("");
 openDialog("편집 용지",`
 <div class="dialog-row"><label>용지 크기</label><select id="paperSizeSelect">${options}</select></div>
 <div class="dialog-row"><label>방향</label><select id="paperOrientation"><option value="portrait" ${page.orientation==="portrait"?"selected":""}>세로</option><option value="landscape" ${page.orientation==="landscape"?"selected":""}>가로</option></select></div>
 <div class="dialog-row"><label>위/아래 여백</label><input id="marginV" type="number" min="3" max="80" value="${page.marginV}"></div>
 <div class="dialog-row"><label>좌/우 여백</label><input id="marginH" type="number" min="3" max="80" value="${page.marginH}"></div>
 <div class="dialog-actions"><button id="pageCancel">취소</button><button id="pageApply" class="primary">적용</button></div>`,()=>{
  $("#pageCancel").onclick=()=>closeDialog();
  $("#pageApply").onclick=()=>{page.name=$("#paperSizeSelect").value;page.orientation=$("#paperOrientation").value;page.marginV=Math.max(3,Number($("#marginV").value)||22);page.marginH=Math.max(3,Number($("#marginH").value)||20);closeDialog();updatePage()};
 });
}
function openPageSizeMenu(anchor){
 const items=Object.entries(pageSizes).map(([n,[w,h]])=>({icon:"📄",label:`${n}  ${w}×${h} mm`,action:()=>{page.name=n;updatePage()}}));
 if(isMobile())openSheet("용지 크기",items);else openDesktopDropdown(anchor,items);
}

function setZoom(v){zoom=Math.max(50,Math.min(160,Number(v)||100));$("#zoomRange").value=zoom;$("#zoomText").textContent=zoom+"%";getPapers().forEach(p=>{p.style.transform=`scale(${zoom/100})`;p.style.marginBottom=Math.max(0,(zoom-100)*12)+"px"})}
function fitWidth(){if(isMobile())return;const scroll=$("#pageScroll"),first=getPapers()[0];const natural=first.offsetWidth,available=scroll.clientWidth-90;setZoom(Math.max(50,Math.min(160,Math.floor(available/natural*100))))}

/* Floating objects */
function deselectObject(){if(selectedObject){selectedObject.classList.remove("selected","interactive");selectedObject=null}}
function selectObject(obj){if(selectedObject&&selectedObject!==obj)selectedObject.classList.remove("selected","interactive");selectedObject=obj;obj.classList.add("selected")}
function nextObjectPosition(){
 objectCounter++;return {left:Math.min(60+(objectCounter%6)*20,Math.max(20,editor.clientWidth-320)),top:90+(objectCounter%8)*28};
}
function createFloatingObject(type,content,{width=300,height=200,left=null,top=null}={}){
 const pos=nextObjectPosition();const obj=document.createElement("div");obj.className="floating-object";obj.dataset.objectType=type;obj.contentEditable="false";
 obj.style.left=(left??pos.left)+"px";obj.style.top=(top??pos.top)+"px";obj.style.width=width+"px";obj.style.height=height+"px";
 obj.innerHTML=`<div class="object-toolbar">
   <button class="object-move" title="드래그해서 이동">⠿ 이동</button>
   ${type==="iframe"?'<button class="object-interact" title="iframe 조작 모드">조작</button>':""}
   <button class="object-front" title="앞으로">↥</button><button class="object-back" title="뒤로">↧</button>
   <button class="delete-object" title="삭제">×</button>
 </div><div class="object-content">${content}</div>
 <span class="resize-handle" data-dir="nw"></span><span class="resize-handle" data-dir="ne"></span><span class="resize-handle" data-dir="sw"></span><span class="resize-handle" data-dir="se"></span>`;
 editor.appendChild(obj);bindFloatingObject(obj);selectObject(obj);markDirty();return obj;
}
function bindFloatingObject(obj){
 if(obj.dataset.bound==="1")return;obj.dataset.bound="1";
 const owner=()=>obj.closest(".page-editor");
 obj.addEventListener("pointerdown",e=>{
   activateEditor(owner());
   if(e.target.closest(".resize-handle")||e.target.closest(".object-toolbar button"))return;
   startMoveObject(e,obj);
 });
 $(".object-move",obj)?.addEventListener("pointerdown",e=>{e.preventDefault();startMoveObject(e,obj)});
 $(".delete-object",obj)?.addEventListener("click",()=>{obj.remove();if(selectedObject===obj)selectedObject=null;markDirty()});
 $(".object-front",obj)?.addEventListener("click",()=>{obj.style.zIndex=String(Math.min(999,(Number(obj.style.zIndex)||30)+1));markDirty()});
 $(".object-back",obj)?.addEventListener("click",()=>{obj.style.zIndex=String(Math.max(20,(Number(obj.style.zIndex)||30)-1));markDirty()});
 $(".object-interact",obj)?.addEventListener("click",()=>obj.classList.toggle("interactive"));
 $$(".resize-handle",obj).forEach(h=>h.addEventListener("pointerdown",e=>startResizeObject(e,obj,h.dataset.dir)));
 obj.addEventListener("click",e=>{e.stopPropagation();activateEditor(owner());selectObject(obj)});
}
function bindAllFloatingObjects(){getEditors().forEach(ed=>$$(".floating-object",ed).forEach(bindFloatingObject))}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function startMoveObject(e,obj){
 e.preventDefault();e.stopPropagation();selectObject(obj);obj.setPointerCapture?.(e.pointerId);
 const startX=e.clientX,startY=e.clientY,startL=parseFloat(obj.style.left)||0,startT=parseFloat(obj.style.top)||0;
 const scale=zoom/100;
 const move=ev=>{const owner=obj.closest(".page-editor")||editor;const maxL=Math.max(0,owner.clientWidth-obj.offsetWidth),maxT=Math.max(0,owner.clientHeight-obj.offsetHeight);obj.style.left=clamp(startL+(ev.clientX-startX)/scale,0,maxL)+"px";obj.style.top=clamp(startT+(ev.clientY-startY)/scale,0,maxT)+"px"};
 const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);markDirty()};
 window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});
}
function startResizeObject(e,obj,dir){
 e.preventDefault();e.stopPropagation();selectObject(obj);
 const startX=e.clientX,startY=e.clientY,startW=obj.offsetWidth,startH=obj.offsetHeight,startL=parseFloat(obj.style.left)||0,startT=parseFloat(obj.style.top)||0,scale=zoom/100;
 const move=ev=>{
  let dx=(ev.clientX-startX)/scale,dy=(ev.clientY-startY)/scale,w=startW,h=startH,l=startL,t=startT;
  if(dir.includes("e"))w=startW+dx;if(dir.includes("s"))h=startH+dy;if(dir.includes("w")){w=startW-dx;l=startL+dx}if(dir.includes("n")){h=startH-dy;t=startT+dy}
  w=Math.max(60,w);h=Math.max(40,h);l=clamp(l,0,Math.max(0,editor.clientWidth-w));t=Math.max(0,t);
  obj.style.width=w+"px";obj.style.height=h+"px";obj.style.left=l+"px";obj.style.top=t+"px";
 };
 const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);markDirty()};
 window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});
}

function insertImageFile(file){
 if(!file||!file.type.startsWith("image/"))return;
 const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=340,ratio=img.naturalWidth/img.naturalHeight||1;let w=Math.min(max,img.naturalWidth||max),h=w/ratio;if(h>280){h=280;w=h*ratio}createFloatingObject("image",`<img src="${reader.result}" alt="삽입 이미지">`,{width:w,height:h})};img.src=reader.result};reader.readAsDataURL(file);
}
function openIframeDialog(){
 openDialog("iframe 삽입",`<div class="dialog-message">웹페이지를 문서 위에 떠 있는 HTML iframe으로 삽입합니다. 사이트에 따라 외부 iframe 표시를 차단할 수 있습니다.</div>
 <div class="dialog-row"><label>URL</label><input id="iframeUrl" type="url" value="https://example.com"></div>
 <div class="dialog-row"><label>너비(px)</label><input id="iframeW" type="number" value="420" min="120" max="1200"></div>
 <div class="dialog-row"><label>높이(px)</label><input id="iframeH" type="number" value="260" min="80" max="1000"></div>
 <div class="dialog-actions"><button id="iframeCancel">취소</button><button id="iframeOk" class="primary">삽입</button></div>`,()=>{
  $("#iframeCancel").onclick=()=>closeDialog();$("#iframeOk").onclick=()=>{const url=$("#iframeUrl").value.trim();if(!/^https?:\/\//i.test(url)){showToast("http:// 또는 https:// 주소를 입력하세요.");return}const w=Number($("#iframeW").value)||420,h=Number($("#iframeH").value)||260;closeDialog();createFloatingObject("iframe",`<iframe src="${escapeHtml(url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" tabindex="-1"></iframe>`,{width:w,height:h})};
 });
}
function openMediaDialog(kind){
 const label=kind==="video"?"비디오":"오디오";
 openDialog(label+" 삽입",`<div class="dialog-row"><label>미디어 URL</label><input id="mediaUrl" type="url" placeholder="https://..."></div>
 <div class="dialog-actions"><button id="mediaCancel">취소</button><button id="mediaOk" class="primary">삽입</button></div>`,()=>{
  $("#mediaCancel").onclick=()=>closeDialog();$("#mediaOk").onclick=()=>{const u=$("#mediaUrl").value.trim();if(!/^https?:\/\//i.test(u)){showToast("웹 URL을 입력하세요.");return}closeDialog();restoreSelection();editor.focus();exec("insertHTML",kind==="video"?`<video controls src="${escapeHtml(u)}" style="max-width:100%"></video><p><br></p>`:`<audio controls src="${escapeHtml(u)}"></audio><p><br></p>`)};
 });
}
function insertDetails(){restoreSelection();editor.focus();exec("insertHTML",`<details><summary>펼쳐 보기</summary><p>여기에 내용을 입력하세요.</p></details><p><br></p>`)}
function insertCode(){restoreSelection();editor.focus();exec("insertHTML",`<pre><code>여기에 코드를 입력하세요.</code></pre><p><br></p>`)}

function openTableDialog(){
 openDialog("표 만들기",`<div class="dialog-row"><label>행</label><input id="tableRows" type="number" min="1" max="30" value="3"></div><div class="dialog-row"><label>열</label><input id="tableCols" type="number" min="1" max="20" value="3"></div><div class="dialog-actions"><button id="tableCancel">취소</button><button id="tableOk" class="primary">삽입</button></div>`,()=>{
  $("#tableCancel").onclick=()=>closeDialog();$("#tableOk").onclick=()=>{const r=Math.max(1,Math.min(30,Number($("#tableRows").value)||3)),c=Math.max(1,Math.min(20,Number($("#tableCols").value)||3));let h="<table><tbody>";for(let y=0;y<r;y++){h+="<tr>";for(let x=0;x<c;x++)h+="<td><br></td>";h+="</tr>"}h+="</tbody></table><p><br></p>";closeDialog();exec("insertHTML",h)};
 });
}
function activeCell(){const s=getSelection();let n=s?.anchorNode;n=n?.nodeType===3?n.parentElement:n;return n?.closest?.("td,th")||null}
function tableRowBelow(){const c=activeCell();if(!c)return showToast("표 안에 커서를 놓으세요.");const row=c.parentElement,newRow=row.cloneNode(true);$$("td,th",newRow).forEach(x=>x.innerHTML="<br>");row.after(newRow);markDirty();queuePagination()}
function tableColRight(){const c=activeCell();if(!c)return showToast("표 안에 커서를 놓으세요.");const idx=[...c.parentElement.children].indexOf(c),table=c.closest("table");$$("tr",table).forEach(r=>{const ref=r.children[idx];const n=document.createElement(ref?.tagName||"td");n.innerHTML="<br>";ref?.after(n)});markDirty();queuePagination()}
function deleteRow(){const c=activeCell();if(!c)return showToast("표 안에 커서를 놓으세요.");const row=c.parentElement,table=c.closest("table");if($$("tr",table).length<=1)return showToast("마지막 행은 삭제할 수 없습니다.");row.remove();markDirty();queuePagination()}
function deleteCol(){const c=activeCell();if(!c)return showToast("표 안에 커서를 놓으세요.");const idx=[...c.parentElement.children].indexOf(c),table=c.closest("table");const first=$("tr",table);if(first.children.length<=1)return showToast("마지막 열은 삭제할 수 없습니다.");$$("tr",table).forEach(r=>r.children[idx]?.remove());markDirty()}

async function openLinkDialog(){
 const url=await sitePrompt("링크 삽입","주소","https://","삽입","url");if(!url)return;
 restoreSelection();const sel=getSelection();if(sel&&!sel.isCollapsed)exec("createLink",url);else exec("insertHTML",`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
}
function openPasteDialog(){
 openDialog("붙이기",`<div class="dialog-message">브라우저 보안 때문에 버튼이 시스템 클립보드를 항상 직접 읽을 수는 없습니다. 아래 칸에 붙여넣고 삽입을 누르세요.</div><div class="dialog-row"><label>내용</label><textarea id="pasteArea" placeholder="여기에 Ctrl/Cmd+V"></textarea></div><div class="dialog-actions"><button id="pasteCancel">취소</button><button id="pasteOk" class="primary">삽입</button></div>`,()=>{
  $("#pasteCancel").onclick=()=>closeDialog();$("#pasteOk").onclick=()=>{const v=$("#pasteArea").value;closeDialog();exec("insertText",v)};$("#pasteArea").focus();
 });
}
async function findText(){
 const q=await sitePrompt("찾기","찾을 내용","");if(!q)return;let found=false;
 for(const ed of getEditors()){const walker=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){const i=node.nodeValue.indexOf(q);if(i>=0){activateEditor(ed);const r=document.createRange();r.setStart(node,i);r.setEnd(node,i+q.length);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);node.parentElement?.scrollIntoView({block:"center"});found=true;break}}if(found)break}
 showToast(found?"찾았습니다.":"찾지 못했습니다.");
}
async function replaceText(){
 return new Promise(resolve=>{
  openDialog("찾아 바꾸기",`<div class="dialog-row"><label>찾을 내용</label><input id="findInput"></div><div class="dialog-row"><label>바꿀 내용</label><input id="replaceInput"></div><div class="dialog-actions"><button id="replaceCancel">취소</button><button id="replaceAll" class="primary">모두 바꾸기</button></div>`,()=>{
   $("#replaceCancel").onclick=()=>{closeDialog();resolve()};$("#replaceAll").onclick=()=>{const q=$("#findInput").value,r=$("#replaceInput").value;if(!q)return;const nodes=[];getEditors().forEach(ed=>{const walker=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);while(walker.nextNode())nodes.push(walker.currentNode)});let c=0;nodes.forEach(n=>{if(n.nodeValue.includes(q)){const p=n.nodeValue.split(q);c+=p.length-1;n.nodeValue=p.join(r)}});closeDialog();markDirty();countChars();paginateDocument(false);showToast(c+"개를 바꿨습니다.");resolve()};
  });
 });
}
function openSourceEditor(){
 const clone=cleanCloneForExport(editor);
 openDialog("HTML 원본 편집",`<div class="dialog-message">현재 페이지의 HTML을 직접 수정할 수 있습니다. &lt;script&gt;와 이벤트 속성은 적용 시 제거됩니다.</div><div class="dialog-row"><textarea id="sourceArea"></textarea></div><div class="dialog-actions"><button id="sourceCancel">취소</button><button id="sourceApply" class="primary">적용</button></div>`,()=>{
  $("#sourceArea").value=clone.innerHTML;$("#sourceCancel").onclick=()=>closeDialog();$("#sourceApply").onclick=()=>{const wrapper=document.createElement("div");wrapper.innerHTML=$("#sourceArea").value;wrapper.querySelectorAll("script,object,embed,form").forEach(n=>n.remove());wrapper.querySelectorAll("*").forEach(el=>[...el.attributes].forEach(a=>{if(/^on/i.test(a.name))el.removeAttribute(a.name)}));editor.innerHTML=wrapper.innerHTML;closeDialog();bindAllFloatingObjects();markDirty();countChars();paginateDocument(false)};
 });
}
function previewHtml(){const blob=new Blob([exportDocumentHtml()],{type:"text/html;charset=utf-8"}),url=URL.createObjectURL(blob);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000)}
function printDocument(){deselectObject();window.print()}
function showDocumentInfo(){
 const allText=getEditors().map(ed=>ed.innerText).join("\n"),words=(allText.trim().match(/\S+/g)||[]).length,chars=allText.length,objects=getEditors().reduce((n,ed)=>n+$$(".floating-object",ed).length,0),tables=getEditors().reduce((n,ed)=>n+$$("table",ed).length,0),pages=getEditors().length;
 openDialog("문서 정보",`<div class="dialog-message">문서 이름: <b>${escapeHtml(titleInput.value||"새 문서")}</b></div><div class="dialog-message">용지: ${page.name} · ${page.orientation==="portrait"?"세로":"가로"}<br>페이지: ${pages}쪽<br>글자 수: ${chars.toLocaleString()}<br>단어 수: ${words.toLocaleString()}<br>표: ${tables}개<br>떠 있는 HTML 개체: ${objects}개</div><div class="dialog-actions"><button id="infoOk" class="primary">확인</button></div>`,()=>$("#infoOk").onclick=()=>closeDialog());
}
function openLineHeight(){
 openDialog("줄 간격",`<div class="option-grid">${["1.0","1.15","1.3","1.5","1.6","1.8","2.0"].map(v=>`<button data-lh="${v}">${Math.round(Number(v)*100)}%</button>`).join("")}</div>`,()=>{
  $$("[data-lh]",dialogBody).forEach(b=>b.onclick=()=>{restoreSelection();const s=getSelection();let n=s?.anchorNode;n=n?.nodeType===3?n.parentElement:n;while(n&&n!==editor&&!/^(P|DIV|LI|H1|H2|H3|TD)$/.test(n.tagName))n=n.parentElement;if(n&&n!==editor)n.style.lineHeight=b.dataset.lh;else editor.style.lineHeight=b.dataset.lh;closeDialog();markDirty();queuePagination()});
 });
}


async function startOfflineInstallWizard(){
 const secure=location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1";
 if(!secure){
  openDialog("오프라인 설치",`
   <div class="offline-step">
    <div class="offline-warning"><strong>현재는 file://로 직접 실행 중입니다.</strong><br>
    Service Worker 오프라인 설치는 보안 정책상 <b>HTTPS</b> 또는 <b>localhost</b>에서만 사용할 수 있습니다.</div>
    <div class="offline-callout">사이트를 HTTPS로 배포하거나 로컬 서버로 실행한 뒤 이 버튼을 다시 누르면 실제 설치가 가능합니다.</div>
   </div>
   <div class="dialog-actions"><button id="offlineSecureOk" class="primary">확인</button></div>`,()=>{
    $("#offlineSecureOk").onclick=()=>closeDialog();
   });
  return;
 }
 if(!("caches" in window)||!("serviceWorker" in navigator)){
  openDialog("오프라인 설치",`<div class="offline-warning">이 브라우저는 Service Worker 또는 Cache Storage를 지원하지 않아 오프라인 설치를 사용할 수 없습니다.</div>
  <div class="dialog-actions"><button id="offlineUnsupportedOk" class="primary">확인</button></div>`,()=>$("#offlineUnsupportedOk").onclick=()=>closeDialog());
  return;
 }

 const onlineVersion=await getOnlineVersion();
 renderOfflineWizardStep(1,{onlineVersion});
}
function renderOfflineWizardStep(step,ctx={}){
 const installed=offlineInstalledVersion();
 const online=ctx.onlineVersion||"확인 중";
 const next=(n)=>renderOfflineWizardStep(n,{...ctx,onlineVersion:online});

 if(step===1){
  openDialog("오프라인 설치",`
   <div class="offline-step">
    <strong>이 편집기를 오프라인에서도 사용할 수 있도록 설치할까요?</strong>
    <div class="offline-callout">편집기 본체, 서비스 워커, 오프라인 캐시, 주요 웹폰트와 글꼴 목록의 웹폰트를 이 브라우저에 저장합니다.</div>
   </div>
   <div class="dialog-actions"><button id="offlineCancel">취소</button><button id="offlineNext" class="primary">다음</button></div>`,()=>{
    $("#offlineCancel").onclick=()=>closeDialog();
    $("#offlineNext").onclick=()=>next(2);
  });return;
 }

 if(step===2){
  openDialog("오프라인 설치 · 안내",`
   <div class="offline-step">
    <strong>오프라인 버전은 한 번 다운로드한 시점의 편집기입니다.</strong>
    <div class="offline-warning">온라인 버전이 나중에 업데이트되어도 이미 다운로드한 오프라인 버전은 자동으로 최신 버전이 되지 않습니다.<br><br>
    <b>온라인 버전이 바뀌면 검토 → 오프라인 설치를 다시 눌러 새 버전을 다시 다운로드해야 합니다.</b></div>
    <div class="offline-version-box"><span>현재 다운로드된 버전</span><span class="value">v${escapeHtml(installed)}</span><span>현재 온라인 버전</span><span class="value">v${escapeHtml(online)}</span></div>
   </div>
   <div class="dialog-actions"><button id="offlineBack">이전</button><button id="offlineNext" class="primary">다음</button></div>`,()=>{
    $("#offlineBack").onclick=()=>next(1);$("#offlineNext").onclick=()=>next(3);
  });return;
 }

 if(step===3){
  openDialog("오프라인 설치 · 주의",`
   <div class="offline-step">
    <div class="offline-warning">
      <strong>설치 전에 확인하세요.</strong><br>
      • 브라우저의 사이트 데이터/캐시를 삭제하면 오프라인 설치도 삭제될 수 있습니다.<br>
      • 설치 중에는 이 탭을 닫거나 새로고침하지 마세요.<br>
      • iframe, YouTube, 외부 웹페이지, 온라인 영상처럼 인터넷이 필요한 콘텐츠는 오프라인에서 표시되지 않을 수 있습니다.<br>
      • 시스템 글꼴은 운영체제의 글꼴을 그대로 사용하며 별도로 다운로드하지 않습니다.
    </div>
   </div>
   <div class="dialog-actions"><button id="offlineBack">이전</button><button id="offlineNext" class="primary">다음</button></div>`,()=>{
    $("#offlineBack").onclick=()=>next(2);$("#offlineNext").onclick=async()=>{
      ctx.freeStorage=await storageAvailableText();
      renderOfflineWizardStep(4,ctx);
    };
  });return;
 }

 if(step===4){
  openDialog("오프라인 설치 · 다운로드 확인",`
   <div class="offline-step">
    <strong>다음 항목을 이 브라우저에 다운로드합니다.</strong>
    <ul class="offline-download-list">
      <li>편집기 최신 버전 v${escapeHtml(online)}: HTML / CSS / JavaScript</li>
      <li>Service Worker, 버전 정보, PWA 매니페스트</li>
      <li>Tossface 및 Pretendard / Wanted Sans Variable / G마켓 산스 / Paperlogy</li>
      <li>글꼴 목록의 웹폰트 ${googleFonts.length}종 (오프라인용 Regular 400)</li>
      <li>각 웹폰트 CSS가 사용하는 실제 WOFF/WOFF2 파일</li>
    </ul>
    <div class="offline-callout">
      <b>예상 다운로드 용량: 약 ${OFFLINE_ESTIMATED_MIN_MB}~${OFFLINE_ESTIMATED_MAX_MB} MB</b><br>
      글꼴 CDN의 분할 방식과 브라우저에 따라 실제 용량은 달라집니다. 설치 중 실제로 받은 용량이 표시됩니다.<br>
      현재 브라우저에서 확인되는 남은 저장공간: <b>${escapeHtml(ctx.freeStorage||"확인 불가")}</b>
    </div>
    <div class="offline-version-box"><span>다운로드된 버전</span><span class="value">v${escapeHtml(installed)}</span><span>온라인 버전</span><span class="value">v${escapeHtml(online)}</span></div>
   </div>
   <div class="dialog-actions"><button id="offlineBack">이전</button><button id="offlineInstallNow" class="primary">설치</button></div>`,()=>{
    $("#offlineBack").onclick=()=>next(3);
    $("#offlineInstallNow").onclick=()=>performOfflineInstall(online);
  });return;
 }
}
function renderOfflineProgress(title="오프라인 설치 중"){
 openDialog(title,`
  <div class="offline-step">
   <div id="offlineProgressPhase"><strong>설치를 준비하고 있습니다.</strong></div>
   <div class="offline-progress-wrap">
    <div class="offline-progress"><div id="offlineProgressBar" class="offline-progress-bar"></div></div>
    <div class="offline-progress-line"><strong id="offlineProgressPercent">0%</strong><span id="offlineProgressCaption">준비 중</span></div>
    <div id="offlineCurrentItem" class="offline-current">리소스 목록을 준비하는 중...</div>
    <div class="offline-stats">
      <div class="offline-stat"><span>받은 용량</span><strong id="offlineBytes">0 MB</strong></div>
      <div class="offline-stat"><span>완료</span><strong id="offlineCompleted">0개</strong></div>
      <div class="offline-stat"><span>남음</span><strong id="offlineRemaining">계산 중</strong></div>
    </div>
   </div>
  </div>`);
}
function setOfflineProgress({percent=null,caption=null,current=null,bytes=null,completed=null,remaining=null,phase=null}){
 if(percent!=null){const p=Math.max(0,Math.min(100,percent));$("#offlineProgressBar").style.width=p+"%";$("#offlineProgressPercent").textContent=Math.round(p)+"%"}
 if(caption!=null)$("#offlineProgressCaption").textContent=caption;
 if(current!=null)$("#offlineCurrentItem").textContent=current;
 if(bytes!=null)$("#offlineBytes").textContent=formatBytes(bytes);
 if(completed!=null)$("#offlineCompleted").textContent=completed+"개";
 if(remaining!=null)$("#offlineRemaining").textContent=remaining+"개";
 if(phase!=null)$("#offlineProgressPhase").innerHTML=`<strong>${escapeHtml(phase)}</strong>`;
}
async function cacheFetchedResponse(cache,url,response){
 try{await cache.put(url,response.clone())}catch(err){console.warn("cache put",url,err)}
 let bytes=0;
 try{bytes=(await response.clone().arrayBuffer()).byteLength}catch(_){}
 return bytes;
}
async function discoverOfflineFontResources(cache,onStatus){
 const cssUrls=[...OFFLINE_FIXED_STYLESHEETS,...googleFonts.map(googleOfflineStylesheetUrl)];
 const fontUrls=new Set();
 let bytes=0,done=0;
 for(const url of cssUrls){
  done++;
  onStatus?.(done,cssUrls.length,url,bytes);
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok&&r.type!=="opaque")throw new Error(`스타일시트 다운로드 실패: ${url}`);
  bytes+=await cacheFetchedResponse(cache,url,r);
  if(r.type!=="opaque"){
   const text=await r.clone().text();
   extractCssUrls(text,url).forEach(u=>fontUrls.add(u));
  }
 }
 return {cssUrls,fontUrls:[...fontUrls],bytes};
}
async function fetchIntoCache(cache,url){
 const req=new Request(url,{cache:"reload"});
 const r=await fetch(req);
 if(!r.ok&&r.type!=="opaque")throw new Error(`다운로드 실패 (${r.status}): ${url}`);
 const bytes=await cacheFetchedResponse(cache,url,r);
 return bytes;
}
async function performOfflineInstall(onlineVersion){
 if(offlineInstallRunning)return;
 offlineInstallRunning=true;
 renderOfflineProgress();
 $("#dialogCloseBtn").disabled=true;
 const cacheName=`${OFFLINE_CACHE_PREFIX}${onlineVersion}`;
 let downloadedBytes=0;
 try{
  const swOk=await registerOfflineServiceWorker();
  if(!swOk)throw new Error("Service Worker를 등록할 수 없습니다.");

  const cache=await caches.open(cacheName);

  setOfflineProgress({phase:"글꼴 파일 목록 확인 중",caption:"웹폰트 정보를 확인하는 중",current:"웹폰트 CSS 확인 중..."});
  const discovery=await discoverOfflineFontResources(cache,(done,total,url,bytes)=>{
   downloadedBytes=bytes;
   setOfflineProgress({
    percent:(done/total)*12,
    caption:`폰트 목록 ${done}/${total}`,
    current:`확인 중: ${url}`,
    bytes:downloadedBytes,
    completed:done,
    remaining:total-done
   });
  });
  downloadedBytes=discovery.bytes;

  const resources=[...OFFLINE_CORE_FILES,...discovery.fontUrls];
  const total=resources.length;
  let completed=0;
  setOfflineProgress({phase:"편집기와 폰트 다운로드 중",caption:`0/${total}`,current:"다운로드를 시작합니다.",completed:0,remaining:total,bytes:downloadedBytes,percent:12});

  const concurrency=4;
  let cursor=0;
  async function worker(){
   while(true){
    const idx=cursor++;
    if(idx>=resources.length)return;
    const url=resources[idx];
    setOfflineProgress({current:`받는 중: ${url}`});
    const b=await fetchIntoCache(cache,url);
    downloadedBytes+=b;
    completed++;
    const p=12+(completed/total)*88;
    setOfflineProgress({
      percent:p,
      caption:`${completed}/${total}`,
      current:`완료: ${url}`,
      bytes:downloadedBytes,
      completed,
      remaining:total-completed
    });
   }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,total)},worker));

  // Remove previous installed version caches only after the new install completed successfully.
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith(OFFLINE_CACHE_PREFIX)&&k!==cacheName).map(k=>caches.delete(k)));

  localStorage.setItem("imdocOfflineVersion",onlineVersion);
  localStorage.setItem("imdocOfflineBytes",String(downloadedBytes));
  localStorage.setItem("imdocOfflineInstalledAt",new Date().toISOString());

  $("#dialogCloseBtn").disabled=false;
  offlineInstallRunning=false;
  const latestOnline=await getOnlineVersion();
  openDialog("다운로드 완료!",`
   <div class="offline-complete-icon tossface">✅</div>
   <div class="offline-step" style="text-align:center">
    <strong>오프라인 설치가 완료되었습니다!</strong><br>
    인터넷 연결이 끊기면 편집기 상단에 <b>오프라인 모드</b>라고 표시되고, 지금 다운로드한 버전으로 편집기를 실행합니다.
   </div>
   <div class="offline-callout">실제 저장된 용량: <b>${formatBytes(downloadedBytes)}</b><br>외부 iframe, YouTube, 온라인 미디어는 인터넷 연결이 없으면 사용할 수 없습니다.</div>
   <div class="offline-version-box">
    <span>다운받은 버전</span><span class="value">v${escapeHtml(onlineVersion)}</span>
    <span>온라인 버전</span><span class="value">v${escapeHtml(latestOnline)}</span>
   </div>
   <div class="dialog-actions"><button id="offlineDone" class="primary">완료</button></div>`,()=>$("#offlineDone").onclick=()=>closeDialog());
 }catch(err){
  console.error(err);
  try{await caches.delete(cacheName)}catch(_){}
  $("#dialogCloseBtn").disabled=false;
  offlineInstallRunning=false;
  openDialog("오프라인 설치 실패",`
   <div class="offline-warning"><strong>설치를 완료하지 못했습니다.</strong><br>${escapeHtml(err?.message||String(err))}</div>
   <div class="offline-callout">인터넷 연결과 저장공간을 확인한 뒤 다시 시도해 주세요.</div>
   <div class="dialog-actions"><button id="offlineFailOk" class="primary">확인</button></div>`,()=>$("#offlineFailOk").onclick=()=>closeDialog());
 }
}

function fileItems(){return [
 {icon:"📄",label:"새 문서",key:"Ctrl+N",action:newDocument},{icon:"📂",label:"열기",key:"Ctrl+O",action:openDocument},{icon:"💾",label:"저장 / 다운로드",key:"Ctrl+S",action:saveDocument},"sep",
 {icon:"🖨️",label:"인쇄",key:"Ctrl+P",action:printDocument},{icon:"◉",label:"HTML 미리보기",action:previewHtml},{icon:"</>",label:"HTML 원본",action:openSourceEditor}
]}
function mobileInsertItems(){return[
 {icon:"▦",label:"표",action:openTableDialog},{icon:"🖼️",label:"그림",action:()=>imageFileInput.click()},{icon:"🔗",label:"링크",action:openLinkDialog},
 {icon:"▣",label:"iframe",action:openIframeDialog},{icon:"▶",label:"비디오",action:()=>openMediaDialog("video")},{icon:"♪",label:"오디오",action:()=>openMediaDialog("audio")},
 {icon:"⌄",label:"접기/펼치기",action:insertDetails},{icon:"</>",label:"코드 블록",action:insertCode}
]}
function mobilePageItems(){return[
 {icon:"📄",label:"편집 용지",action:openPageSetup},{icon:"A4",label:"용지 크기",action:()=>openPageSizeMenu($("#mobileMenuBtn"))},{icon:"↻",label:"방향 전환",action:()=>{page.orientation=page.orientation==="portrait"?"landscape":"portrait";updatePage()}},{icon:"↵",label:"쪽 나누기",action:()=>exec("insertHTML",'<div class="page-break" contenteditable="false"></div><p><br></p>')},{icon:"🖨️",label:"인쇄",action:printDocument}
]}
function mobileMoreItems(){return[
 {icon:"🔎",label:"찾기",action:findText},{icon:"↔",label:"찾아 바꾸기",action:replaceText},
 {icon:"⬇️",label:"오프라인 설치",action:startOfflineInstallWizard},
 {icon:"</>",label:"HTML 원본",action:openSourceEditor},{icon:"◉",label:"미리보기",action:previewHtml},{icon:"ⓘ",label:"문서 정보",action:showDocumentInfo}
]}

function showRibbon(tab){
 $$(".ribbon-panel").forEach(p=>p.classList.toggle("active",p.dataset.ribbon===tab));$$(".menu-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
}
function syncToggleButtons(){$$(".toggle-tool").forEach(b=>{try{b.classList.toggle("active",document.queryCommandState(b.dataset.command))}catch(_){}})}

function handleKeyboard(e){
 const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();

 // Plain Enter must be handled by contenteditable itself.
 // Only Ctrl/Cmd+Enter is reserved for a manual page break below.
 if(e.key==="Enter"&&!mod){
  const active=e.target?.closest?.(".page-editor");
  if(active)activateEditor(active);
  return;
 }
 if(e.key==="Escape"){closeDropdown();closeSheet();if(dialogBackdrop.classList.contains("open"))closeDialog(null);deselectObject();return}
 if(e.key==="F7"){e.preventDefault();openPageSetup();return}
 if(mod&&key==="s"){e.preventDefault();saveDocument();return}
 if(mod&&key==="o"){e.preventDefault();openDocument();return}
 if(mod&&key==="p"){e.preventDefault();printDocument();return}
 if(mod&&key==="n"){e.preventDefault();startChordN();return}
 if(mod&&key==="z"){e.preventDefault();exec("undo");return}
 if(mod&&key==="y"){e.preventDefault();exec("redo");return}
 if(mod&&key==="b"){e.preventDefault();exec("bold");return}
 if(mod&&key==="i"){e.preventDefault();exec("italic");return}
 if(mod&&key==="u"){e.preventDefault();exec("underline");return}
 if(mod&&key==="f"){e.preventDefault();findText();return}
 if(mod&&key==="h"){e.preventDefault();replaceText();return}
 if(mod&&e.key==="Enter"){e.preventDefault();exec("insertHTML",'<div class="page-break" contenteditable="false"></div><p><br></p>');return}
}
let chordTimer=null,chordWaiting=false;
function startChordN(){
 chordWaiting=true;clearTimeout(chordTimer);showToast("Ctrl+N, T = 표 만들기 · 잠시 기다리면 새 문서");
 chordTimer=setTimeout(()=>{if(chordWaiting){chordWaiting=false;newDocument()}},850);
}
document.addEventListener("keydown",e=>{
 if(chordWaiting){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="n")return;
  if(e.key.toLowerCase()==="t"){e.preventDefault();chordWaiting=false;clearTimeout(chordTimer);openTableDialog();return}
  if(!["control","meta","shift","alt"].includes(e.key.toLowerCase())){chordWaiting=false;clearTimeout(chordTimer)}
 }
 handleKeyboard(e);
});

function normalizeMobileBlocks(target=editor){
 if(!isMobile())return;$$(':scope > p, :scope > div',target).forEach(n=>{if(!n.classList.contains("floating-object")&&!n.classList.contains("page-break")){n.style.marginTop="0";n.style.marginBottom="0"}})
}

/* init bindings */
fillFonts();getEditors().forEach(bindPageEditor);rebuildRulers();countChars();updatePageNumbers();markSaved();

document.addEventListener("selectionchange",()=>{const sel=getSelection();if(sel?.rangeCount){const ed=getEditors().find(x=>x.contains(sel.anchorNode));if(ed)activateEditor(ed)}saveSelection();syncToggleButtons()});
document.addEventListener("pointerdown",e=>{if(!e.target.closest(".floating-object"))deselectObject();if(!e.target.closest("#desktopDropdown")&&!e.target.closest(".menu-tab")&&!e.target.closest("#pageSizeBtn"))closeDropdown()});
window.addEventListener("resize",()=>{rebuildRulers();closeDropdown()});

titleInput.addEventListener("input",()=>{updateTitleUI();markDirty()});

$("#newBtn").onclick=newDocument;$("#openBtn").onclick=openDocument;$("#saveBtn").onclick=saveDocument;$("#undoBtn").onclick=()=>exec("undo");$("#redoBtn").onclick=()=>exec("redo");
$("#pasteBtn").onclick=openPasteDialog;$("#cutBtn").onclick=()=>exec("cut");$("#copyBtn").onclick=()=>exec("copy");$("#selectAllBtn").onclick=()=>{editor.focus();exec("selectAll")};
$$("[data-command]").forEach(b=>{b.addEventListener("mousedown",e=>e.preventDefault());b.addEventListener("click",()=>exec(b.dataset.command))});
$$(".font-chip").forEach(b=>b.onclick=()=>applyFont(b.dataset.font));fontFamily.onchange=()=>applyFont(fontFamily.value);mobileFontFamily.onchange=()=>applyFont(mobileFontFamily.value);
$("#styleSelect").onchange=e=>applyBlockStyle(e.target.value);
fontSizeInput.addEventListener("focus",saveSelection);fontSizeInput.onchange=()=>applyFontSize(fontSizeInput.value);fontSizeInput.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();applyFontSize(fontSizeInput.value);fontSizeMenu.classList.remove("open");editor.focus()}};
$("#fontSizeDropBtn").onclick=e=>{e.stopPropagation();saveSelection();fontSizeMenu.classList.toggle("open")};$$("#fontSizeMenu button").forEach(b=>b.onclick=()=>{applyFontSize(b.dataset.size);fontSizeMenu.classList.remove("open")});
$("#mobileFontSize").onchange=e=>applyFontSize(e.target.value);$("#textColor").onchange=e=>exec("foreColor",e.target.value);$("#highlightColor").onchange=e=>exec("hiliteColor",e.target.value);
$("#indentBtn").onclick=()=>exec("indent");$("#outdentBtn").onclick=()=>exec("outdent");

$("#view100Btn").onclick=()=>setZoom(100);$("#fitWidthBtn").onclick=fitWidth;$("#zoomInRibbonBtn").onclick=()=>setZoom(zoom+10);$("#zoomOutRibbonBtn").onclick=()=>setZoom(zoom-10);
$("#toggleRulerBtn").onclick=()=>{$("#horizontalRulerWrap").classList.toggle("hidden-by-user");$("#verticalRuler").classList.toggle("hidden-by-user");const hide=$("#horizontalRulerWrap").classList.contains("hidden-by-user");$("#horizontalRulerWrap").style.display=hide?"none":"";$("#verticalRuler").style.display=hide?"none":""};
$("#togglePageShadowBtn").onclick=()=>{const add=!getPapers()[0].classList.contains("no-shadow");getPapers().forEach(p=>p.classList.toggle("no-shadow",add))};

$("#insertTableBtn").onclick=openTableDialog;$("#insertImageBtn").onclick=()=>imageFileInput.click();$("#insertLinkBtn").onclick=openLinkDialog;$("#horizontalRuleBtn").onclick=()=>exec("insertHorizontalRule");
$("#insertIframeBtn").onclick=openIframeDialog;$("#insertVideoBtn").onclick=()=>openMediaDialog("video");$("#insertAudioBtn").onclick=()=>openMediaDialog("audio");$("#insertDetailsBtn").onclick=insertDetails;$("#insertCodeBtn").onclick=insertCode;

$("#lineHeightBtn").onclick=openLineHeight;$("#clearFormatBtn").onclick=()=>exec("removeFormat");$("#supBtn").onclick=()=>exec("superscript");$("#subBtn").onclick=()=>exec("subscript");

$("#pageSetupBtn").onclick=openPageSetup;$("#pageSizeBtn").onclick=e=>openPageSizeMenu(e.currentTarget);$("#orientationBtn").onclick=()=>{page.orientation=page.orientation==="portrait"?"landscape":"portrait";updatePage()};$("#pageBreakBtn").onclick=()=>exec("insertHTML",'<div class="page-break" contenteditable="false"></div><p><br></p>');$("#printBtn").onclick=printDocument;

$("#tableInsertBtn").onclick=openTableDialog;$("#rowBelowBtn").onclick=tableRowBelow;$("#colRightBtn").onclick=tableColRight;$("#deleteRowBtn").onclick=deleteRow;$("#deleteColBtn").onclick=deleteCol;
$("#findBtn").onclick=findText;$("#replaceBtn").onclick=replaceText;$("#sourceBtn").onclick=openSourceEditor;$("#previewBtn").onclick=previewHtml;
$("#documentInfoBtn").onclick=showDocumentInfo;$("#spellcheckBtn").onclick=()=>{spellcheckOn=!spellcheckOn;getEditors().forEach(ed=>ed.spellcheck=spellcheckOn);showToast(spellcheckOn?"맞춤법 표시 켜짐":"맞춤법 표시 꺼짐")};
$("#offlineInstallBtn").onclick=startOfflineInstallWizard;

$("#fileTab").onclick=e=>{e.stopPropagation();openDesktopDropdown(e.currentTarget,fileItems())};
$$(".menu-tab").filter(b=>b.id!=="fileTab").forEach(b=>b.onclick=()=>showRibbon(b.dataset.tab));

openFileInput.onchange=e=>{const f=e.target.files?.[0];if(f)loadHtmlFile(f);openFileInput.value=""};
imageFileInput.onchange=e=>{const f=e.target.files?.[0];if(f)insertImageFile(f);imageFileInput.value=""};

$("#zoomRange").oninput=e=>setZoom(e.target.value);$("#zoomOutBtn").onclick=()=>setZoom(zoom-10);$("#zoomInBtn").onclick=()=>setZoom(zoom+10);

$("#mobileMenuBtn").onclick=()=>openSheet("문서",fileItems().filter(x=>x!=="sep"));$("#mobileUndoBtn").onclick=()=>exec("undo");$("#mobileSaveBtn").onclick=saveDocument;$("#mobileMoreFormatBtn").onclick=()=>openSheet("서식",[
 {icon:"B",label:"굵게",action:()=>exec("bold")},{icon:"I",label:"기울임",action:()=>exec("italic")},{icon:"U",label:"밑줄",action:()=>exec("underline")},
 {icon:"≡",label:"왼쪽",action:()=>exec("justifyLeft")},{icon:"≣",label:"가운데",action:()=>exec("justifyCenter")},{icon:"↕",label:"줄 간격",action:openLineHeight}
]);
$$(".mobile-bottomnav button").forEach(b=>b.onclick=()=>{$$(".mobile-bottomnav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");const a=b.dataset.mobileAction;if(a==="edit"){editor.focus();return}if(a==="table"){openTableDialog();return}if(a==="insert"){openSheet("입력",mobileInsertItems());return}if(a==="page"){openSheet("쪽",mobilePageItems());return}openSheet("더보기",mobileMoreItems())});
$("#sheetCloseBtn").onclick=closeSheet;sheetBackdrop.onclick=e=>{if(e.target===sheetBackdrop)closeSheet()};
$("#dialogCloseBtn").onclick=()=>{if(offlineInstallRunning){showToast("오프라인 설치가 진행 중입니다.");return}closeDialog(null)};dialogBackdrop.onclick=e=>{if(e.target===dialogBackdrop){if(offlineInstallRunning){showToast("오프라인 설치가 진행 중입니다.");return}closeDialog(null)}};

document.addEventListener("click",e=>{if(!e.target.closest("#fontSizeCombo"))fontSizeMenu.classList.remove("open")});

setZoom(100);updatePage();markSaved();
updateNetworkModeUI();
window.addEventListener("online",updateNetworkModeUI);
window.addEventListener("offline",updateNetworkModeUI);
registerOfflineServiceWorker();
})();
