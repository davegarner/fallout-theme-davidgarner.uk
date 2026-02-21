import { mdToHtml } from './markdown.js';
const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const IN_TOOLS=/\/tools\//i.test(location.pathname);const BASE=IN_TOOLS?'../':'./';

async function loadPartial(id,path){const el=document.getElementById(id);if(!el) return;try{const res=await fetch(BASE+path);el.innerHTML=await res.text();if(id==='header') initHeaderAfterLoad();}catch(err){console.error('Partial load failed:', path, err);}}

function initHeaderAfterLoad(){const theme=localStorage.getItem('theme')||'green';document.documentElement.setAttribute('data-theme',theme);const sel=document.getElementById('theme-select');if(sel){sel.value=theme;sel.addEventListener('change',e=>{const v=e.target.value;document.documentElement.setAttribute('data-theme',v);localStorage.setItem('theme',v);});}const map={home:'index.html',news:'news.html',projects:'projects.html',about:'about.html',tools:'tools/index.html'};document.querySelectorAll('nav a[data-nav]').forEach(a=>{const k=a.getAttribute('data-nav');if(map[k]) a.setAttribute('href',BASE+map[k]);});}

// Toast
let toastEl=null;function ensureToast(){if(!toastEl){toastEl=document.createElement('div');toastEl.className='toast';document.body.appendChild(toastEl);}return toastEl}function showToast(msg){const t=ensureToast();t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1200)}

// Modal
const Modal={backdrop:null,titleText:null,posEl:null,body:null,copyBtn:null,backBtn:null,prevBtn:null,nextBtn:null,currentFile:null,_focusables:[],_lastActive:null,isOpen(){return !!(this.backdrop&&this.backdrop.style.display==='flex');},init(){this.backdrop=document.createElement('div');this.backdrop.className='modal-backdrop';this.backdrop.innerHTML='\
  <div class="modal" role="dialog" aria-modal="true" aria-label="Terminal entry">\
    <div class="modal-titlebar">\
      <div class="modal-title"><span class="modal-title-text">TERMINAL</span><span class="modal-pos"></span></div>\
      <div class="modal-actions" style="display:flex; gap:.5rem; align-items:center;">\
        <button class="modal-copy" title="Copy link" aria-label="Copy link">🔗 Copy link</button>\
        <button class="modal-close" aria-label="Close">[X]</button>\
      </div>\
    </div>\
    <div class="modal-body"></div>\
    <div class="modal-footer">\
      <div>\
        <button class="modal-prev" aria-label="Previous (Left Arrow)">← Prev</button>\
        <button class="modal-next" aria-label="Next (Right Arrow)">Next →</button>\
      </div>\
      <button class="modal-back" aria-label="Back to list">Back to list</button>\
    </div>\
  </div>';
  document.body.appendChild(this.backdrop);
  this.titleText=$('.modal-title-text',this.backdrop);this.posEl=$('.modal-pos',this.backdrop);this.body=$('.modal-body',this.backdrop);this.copyBtn=$('.modal-copy',this.backdrop);this.backBtn=$('.modal-back',this.backdrop);this.prevBtn=$('.modal-prev',this.backdrop);this.nextBtn=$('.modal-next',this.backdrop);
  $('.modal-close',this.backdrop).addEventListener('click',()=>{this.hide(); clearHashIfOnListing();});
  this.backdrop.addEventListener('click',e=>{if(e.target===this.backdrop){this.hide(); clearHashIfOnListing();}});
  this.copyBtn.addEventListener('click',()=>{try{navigator.clipboard.writeText(location.href);}finally{showToast('Link copied')}});
  this.backBtn.addEventListener('click',()=>{clearHashIfOnListing(); this.hide();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.isOpen()){e.preventDefault(); this.hide(); clearHashIfOnListing();}});
  this.backdrop.addEventListener('keydown',e=>{if(!this.isOpen()||e.key!=='Tab')return; this._refreshFocusables(); if(this._focusables.length===0)return; const first=this._focusables[0], last=this._focusables[this._focusables.length-1]; if(e.shiftKey){if(document.activeElement===first){e.preventDefault(); last.focus();}} else {if(document.activeElement===last){e.preventDefault(); first.focus();}}});
},_refreshFocusables(){const modal=$('.modal',this.backdrop);this._focusables=Array.from(modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled);},show(title,html,pos){if(!this.backdrop) this.init();this._lastActive=document.activeElement;this.titleText.textContent=title||'TERMINAL';this.body.innerHTML=html||'';this.posEl.textContent=pos?(' — '+pos):'';this.backdrop.style.display='flex';this._refreshFocusables();(this._focusables[0]||this.body).focus();},hide(){this.backdrop.style.display='none';if(this._lastActive&&this._lastActive.focus) this._lastActive.focus();}};

async function fetchJSON(p){const r=await fetch(BASE+p);return r.json()}async function fetchText(p){const r=await fetch(BASE+p);return r.text()}
function clearHashIfOnListing(){if(/\/(news|projects)\.html$/i.test(location.pathname)){history.replaceState({},'', location.pathname + location.search);}}

// Listing pages
async function initListing(kind){const listEl=document.getElementById('list');const searchEl=document.getElementById('search');const json=await fetchJSON(`content/${kind}/${kind}.json`);let items=json.items||[];const indexByFile=new Map(items.map((it,idx)=>[it.file,idx]));let currentIdx=null;function pos(){return (currentIdx!=null)?`${currentIdx+1}/${items.length}`:''}
function openItem(file,push=true){return(async()=>{const md=await fetchText(`content/${kind}/${file}`);const html=mdToHtml(md);currentIdx=indexByFile.get(file);const title=(items[currentIdx]||{}).title||'ENTRY';Modal.currentFile=file;Modal.show(title,html,pos());if(push)history.replaceState(null,'','#'+encodeURIComponent(file));})();}
function prev(){if(currentIdx==null)return; const i=currentIdx-1; if(i>=0)openItem(items[i].file,true);} function next(){if(currentIdx==null)return; const i=currentIdx+1; if(i<items.length)openItem(items[i].file,true);} setTimeout(()=>{if(Modal.prevBtn)Modal.prevBtn.onclick=()=>prev(); if(Modal.nextBtn)Modal.nextBtn.onclick=()=>next();},0)
function render(arr){listEl.innerHTML=arr.map(it=>{const tags=(it.tags||[]).map(t=>'<button type="button" class="tag-chip" data-tag="'+t+'">#'+t+'</button>').join(' ');return '<div class="card">\n  <div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;">\n    <div>\n      <div style="font-weight:bold;letter-spacing:.05em;">'+it.title+'</div>\n      <div style="opacity:.8;font-size:.9rem;">'+it.date+' '+tags+'</div>\n    </div>\n    <button class="btn" data-open="'+it.file+'">open</button>\n  </div>\n  '+(it.excerpt?'<p style="margin:.5rem 0 0;opacity:.95;">'+it.excerpt+'</p>':'')+'\n</div>'}).join('');
  $$('.btn[data-open]').forEach(btn=>btn.addEventListener('click',e=>openItem(e.currentTarget.getAttribute('data-open'),true)));
  $$('.tag-chip',listEl).forEach(chip=>chip.addEventListener('click',()=>{const tag=chip.getAttribute('data-tag'); if(searchEl){searchEl.value=tag; applyFilter(); searchEl.focus();}}));}
function applyFilter(){const q=(searchEl.value||'').toLowerCase().trim();const filtered=items.filter(it=>{const tags=(it.tags||[]).join(' ');const hashTags=(it.tags||[]).map(t=>'#'+t).join(' ');const hay=(it.title+' '+(it.excerpt||'')+' '+tags+' '+hashTags).toLowerCase();return hay.includes(q)});render(filtered)}
searchEl&&searchEl.addEventListener('input',applyFilter);render(items);
document.addEventListener('keydown',e=>{const tag=(e.target&&e.target.tagName)||'';const typing=/^(INPUT|TEXTAREA|SELECT)$/i.test(tag);if(e.key==='/'&&!typing){e.preventDefault();searchEl&&searchEl.focus();}if(Modal.isOpen()&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault(); if(e.key==='ArrowLeft') prev(); else next();}});
const fromHash=decodeURIComponent((location.hash||'').slice(1)); if(fromHash&&indexByFile.has(fromHash)) openItem(fromHash,false);
window.addEventListener('hashchange',()=>{const h=decodeURIComponent((location.hash||'').slice(1)); if(!h){Modal.hide();return;} if(indexByFile.has(h)) openItem(h,false);});}

// Downloads
async function initDownloads(){const listEl=document.getElementById('downloads-list');const json=await fetchJSON('content/downloads/downloads.json');listEl.innerHTML=json.files.map(f=>'<div class="card"><div style="display:flex;justify-content:space-between;gap:.75rem;align-items:center;"><div><div style="font-weight:bold;">'+f.name+'</div><div style="opacity:.85;font-size:.9rem;">'+f.size+(f.sha256?' • SHA256: <code>'+f.sha256+'</code>':'')+'</div>'+(f.notes?'<p style="margin:.5rem 0 0">'+f.notes+'</p>':'')+'</div><a class="btn" href="'+f.href+'" download>download</a></div></div>').join('')}

// Gallery
async function initGallery(){const grid=document.getElementById('gallery-grid');const json=await fetchJSON('content/gallery/gallery.json');
  grid.innerHTML=json.items.map((it,idx)=>{const src=(/^(?:\.{1,2}\/|assets\/)/.test(it.src||''))?(BASE+(it.src||'').replace(/^\.\//,'')):(it.src||'');let inner=''; if(it.type==='image'){inner='<img class="gallery-img" src="'+src+'" alt="'+(it.title||'')+'" loading="lazy">';} else {inner='<pre style="height:160px;overflow:hidden;">'+(it.preview||'')+'</pre>';}
    return '<div class="card" data-idx="'+idx+'">'+inner+'<div style="margin-top:.5rem;font-weight:bold;">'+(it.title||'')+'</div></div>';}).join('');
  grid.querySelectorAll('.card').forEach(card=>{card.addEventListener('click',()=>{const idx=+card.getAttribute('data-idx');const it=json.items[idx];if(it.type==='image'){const src=(/^(?:\.{1,2}\/|assets\/)/.test(it.src||''))?(BASE+(it.src||'').replace(/^\.\//,'')):(it.src||'');Modal.show(it.title,'<img src="'+src+'" alt="'+(it.title||'')+'" style="max-width:100%;height:auto;"/><p>'+(it.caption||'')+'</p>');} else {const md=it.markdown||'';Modal.show(it.title, mdToHtml(md));}})});
}

// Contact
async function initContact(){const panel=document.getElementById('contact-panel');const md=await fetchText('content/contact.md');panel.innerHTML=mdToHtml(md)}

// Typewriter with repeat-visitor skip
function initTypewriter(){const el=document.getElementById('typewriter');if(!el)return;const lines=['VAULTSOFT // TERMINAL v1.0','LOCATION: LONDON SECTOR','STATUS: ONLINE','','Welcome, Overseer. Use the links below to navigate.'];
  const seen = localStorage.getItem('typewriter_done') === '1';
  const finalText = lines.join('\n');
  if (seen) {
    el.textContent = finalText; 
    const links=document.getElementById('home-links');
    if(links){links.style.display='block';const grid=links.querySelector('.home-grid');if(grid)grid.classList.add('reveal');}
    return;
  }
  let i=0,j=0; const cursor='<span class="cursor">&nbsp;</span>'; const out=[];
  function render(){return out.join('\n');}
  function tick(){
    if(i<lines.length){
      const line=lines[i];
      if(j<line.length){
        const cur=line.slice(0,j+1);
        out[i]=cur+cursor; el.innerHTML=render(); j++; setTimeout(tick,20+Math.random()*40);
      }else{
        out[i]=line; i++; j=0; el.innerHTML=render()+'\n'+cursor; setTimeout(tick,250);
      }
    }else{
      el.textContent=finalText; 
      localStorage.setItem('typewriter_done','1');
      const links=document.getElementById('home-links'); if(links){links.style.display='block'; const grid=links.querySelector('.home-grid'); if(grid) grid.classList.add('reveal');}
    }
  }
  tick();
}

// Router
function initPage(){const init=document.body.getAttribute('data-init');if(init==='home')initTypewriter();if(init==='news')initListing('news');if(init==='projects')initListing('projects');if(init==='downloads')initDownloads();if(init==='gallery')initGallery();if(init==='contact')initContact();if(init==='password')initPasswordTool();}

// Password tool (unchanged)
function uniqueLetters(n){const a='abcdefghijklmnopqrstuvwxyz'.split('');let p=a.slice(),o='';while(o.length<n&&p.length){const i=Math.floor(Math.random()*p.length);o+=p[i];p.splice(i,1);}return o}
function mutateTwoChars(pwd){const c=pwd.split('');const pos=Array.from({length:c.length},(_,i)=>i).filter(i=>c[i]!=='-');const p1=pos.splice(Math.floor(Math.random()*pos.length),1)[0];const p2=pos[Math.floor(Math.random()*pos.length)];const d='0123456789';c[p1]=d[Math.floor(Math.random()*d.length)];c[p2]=c[p2].toUpperCase();return c.join('')}
function generatePassword(){const b1=uniqueLetters(6),b2=uniqueLetters(6),b3=uniqueLetters(6);let pwd=b1+'-'+b2+'-'+b3;return mutateTwoChars(pwd)}
function initPasswordTool(){const out=document.getElementById('pw-output');const g=document.getElementById('btn-generate');const dl=document.getElementById('btn-download');if(g)g.addEventListener('click',e=>{e.preventDefault();out.value=generatePassword()});if(dl)dl.addEventListener('click',e=>{e.preventDefault();const u=document.getElementById('username').value.trim();const w=document.getElementById('website').value.trim();const p=(out.value.trim())||generatePassword();const rows=[["username","website","password"],[u,w,p]];const csv=rows.map(r=>r.map(v=>'"'+v.replace(/"/g,'""')+'"').join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='credentials.csv';document.body.appendChild(a);a.click();a.remove();})}

window.addEventListener('DOMContentLoaded',async()=>{await loadPartial('header','partials/header.html');await loadPartial('footer','partials/footer.html');Modal.init();initPage();});
