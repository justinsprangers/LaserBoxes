'use strict';
/* LaserBoxes core: generator registry, geometry helpers, form, live preview and SVG export.
   Generators call LB.register({...}); see README.md for the interface. Plain script (no modules)
   so index.html works when opened straight from disk. */
const LB=(()=>{
const gens=[];
const KEY='laserBoxes.';
const COMMON=[
  {id:'k',label:'Kerf',def:0.15,step:0.01,group:'Cutting',min:0,help:'Width of the laser cut; paths are offset by half of it.'},
  {id:'gap',label:'Gap between parts',def:10,step:1,group:'Cutting',min:0},
  {id:'sheetW',label:'Sheet width (0 = auto)',def:0,step:10,group:'Cutting',min:0,help:'Parts wrap onto a new row past this width. Set it to your laser bed width.'},
  {id:'eng',label:'Include engrave areas (blue)',def:true,type:'bool',group:'Cutting'},
];
const COMMON_HELP=`<ul>
<li>Edit any value; the drawings update live. Values are remembered per generator in this browser, and the page address carries any changed values, so you can bookmark a setup.</li>
<li><b>Download SVG</b> gives one sheet in real mm. Cut paths are 0.01 mm red (#FF0000) hairlines on layer <code>Cut</code>; engrave areas are blue (#0000FF) rectangles on layer <code>Engrave areas</code>. Put artwork inside the blue boxes, then delete or disable that layer before cutting.</li>
<li><b>Kerf</b> is compensated: outlines grow by kerf/2 and holes shrink by kerf/2, so finished parts come out at nominal size. Set it to 0 if your laser software compensates instead.</li>
</ul>`;
const $=id=>document.getElementById(id);
const f3=v=>String(Math.round(v*1000)/1000);
const fmt=v=>String(Math.round(v*100)/100);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- geometry ----------
// Part coordinates are mm with y up. A shape is a polygon [[x,y],...] or {circle:[cx,cy,r]}.
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
function area(P){let a=0;for(let i=0;i<P.length;i++){const q=P[(i+1)%P.length];a+=P[i][0]*q[1]-q[0]*P[i][1];}return a/2;}
// Remove duplicate and collinear points (the offset needs real corners).
function clean(P){
  let changed=true;
  while(changed){
    changed=false;
    for(let i=0;i<P.length&&P.length>3;i++){
      const a=P[(i-1+P.length)%P.length],b=P[i],c=P[(i+1)%P.length];
      const cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
      if((Math.abs(b[0]-a[0])<1e-9&&Math.abs(b[1]-a[1])<1e-9)||Math.abs(cr)<1e-12){P.splice(i,1);changed=true;break;}
    }
  }
  return P;
}
// Offset a simple polygon by d (d > 0 grows it, d < 0 shrinks it), mitred corners.
function offset(P,d){
  if(!d)return P.map(v=>v.slice());
  const s=area(P)>0?1:-1,n=P.length;
  const nrm=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);return [s*dy/L,-s*dx/L];};
  return P.map((v,i)=>{
    const n1=nrm(P[(i-1+n)%n],v),n2=nrm(v,P[(i+1)%n]);
    const k=d/(1+n1[0]*n2[0]+n1[1]*n2[1]);
    return [v[0]+k*(n1[0]+n2[0]),v[1]+k*(n1[1]+n2[1])];
  });
}
const bbox=P=>{const xs=P.map(v=>v[0]),ys=P.map(v=>v[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};
const offsetShape=(s,d)=>s.circle?{circle:[s.circle[0],s.circle[1],s.circle[2]+d]}:offset(s,d);
const pathOf=(P,X,Y)=>'M'+P.map(([a,b])=>f3(X(a))+' '+f3(Y(b))).join(' L')+' Z';
function shapePath(s,X,Y){
  if(!s.circle)return pathOf(s,X,Y);
  const [cx,cy,r]=s.circle,R=f3(Math.abs(X(r)-X(0)));
  return `M${f3(X(cx-r))} ${f3(Y(cy))} A${R} ${R} 0 1 0 ${f3(X(cx+r))} ${f3(Y(cy))} A${R} ${R} 0 1 0 ${f3(X(cx-r))} ${f3(Y(cy))} Z`;
}

// ---------- dimension helpers (sheet/drawing coordinates, y down) ----------
function dimH(x1,x2,y,txt,fs,above=true){
  const t=fs*.45;
  return `<g class="dim"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y-t}" x2="${x1}" y2="${y+t}"/><line x1="${x2}" y1="${y-t}" x2="${x2}" y2="${y+t}"/><text x="${(x1+x2)/2}" y="${above?y-fs*.35:y+fs*1.05}" font-size="${fs}" text-anchor="middle">${txt}</text></g>`;
}
function dimV(x,y1,y2,txt,fs,left=true){
  const t=fs*.45,ty=(y1+y2)/2,tx=left?x-fs*.35:x+fs*.35;
  return `<g class="dim"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><line x1="${x-t}" y1="${y1}" x2="${x+t}" y2="${y1}"/><line x1="${x-t}" y1="${y2}" x2="${x+t}" y2="${y2}"/><text x="${tx}" y="${ty}" font-size="${fs}" text-anchor="middle" transform="rotate(-90 ${tx} ${ty})" dy="${left?0:fs*.7}">${txt}</text></g>`;
}

// ---------- sheet layout ----------
// Parts go left to right in rows, top-aligned, with kerf applied. Rows wrap at the sheet width
// (auto: about twice the square root of the total part area). Each placed part gets X(x), Y(y)
// mapping its own coordinates to the sheet, so generators can annotate it.
// part.cuts are open polylines (e.g. living-hinge slits); kerf doesn't apply to them.
function layout(gen,p,g){
  const M=5,placed=[];
  const items=gen.parts(p,g).map(part=>{const out=offset(part.outline,p.k/2);return {part,out,bb:bbox(out)};});
  const area=items.reduce((a,i)=>a+(i.bb[2]-i.bb[0]+p.gap)*(i.bb[3]-i.bb[1]+p.gap),0);
  const widest=Math.max(...items.map(i=>i.bb[2]-i.bb[0]));
  const target=p.sheetW>0?p.sheetW-2*M:Math.max(widest,2*Math.sqrt(area));
  let ox=M,oy=M,rowH=0,SW=0;
  for(const {part,out,bb} of items){
    const w=bb[2]-bb[0],h=bb[3]-bb[1];
    if(ox>M&&ox-M+w>target+1e-9){ox=M;oy+=rowH+p.gap;rowH=0;}
    const x0=ox,y0=oy,X=x=>x0+(x-bb[0]),Y=y=>y0+(bb[3]-y);
    placed.push({part,X,Y,w,
      cut:[pathOf(out,X,Y),...(part.holes||[]).map(h=>shapePath(offsetShape(h,-p.k/2),X,Y))],
      open:(part.cuts||[]).map(pl=>'M'+pl.map(([a,b])=>f3(X(a))+' '+f3(Y(b))).join(' L')),
      eng:p.eng?(part.engrave||[]).filter(r=>r[2]>r[0]&&r[3]>r[1]).map(r=>[X(r[0]),Y(r[3]),r[2]-r[0],r[3]-r[1]]):[]});
    ox+=w+p.gap;rowH=Math.max(rowH,h);SW=Math.max(SW,ox-p.gap+M);
  }
  return {SW,SH:oy+rowH+M,placed,tooWide:p.sheetW>0&&widest>p.sheetW-2*M};
}
function svgFile(gen,p,L){
  const r=a=>`<rect x="${f3(a[0])}" y="${f3(a[1])}" width="${f3(a[2])}" height="${f3(a[3])}"/>`;
  const eng=L.placed.flatMap(q=>q.eng);
  const params=allParams(gen).map(q=>q.id+'='+(q.type==='bool'?(p[q.id]?1:0):p[q.id])).join(' ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${f3(L.SW)}mm" height="${f3(L.SH)}mm" viewBox="0 0 ${f3(L.SW)} ${f3(L.SH)}">
<!-- LaserBoxes: ${gen.id}. ${params} -->
<g id="cut" inkscape:groupmode="layer" inkscape:label="Cut" fill="none" stroke="#ff0000" stroke-width="0.01">
${L.placed.map((q,i)=>`<g id="part-${i+1}">\n${q.cut.concat(q.open).map(d=>`<path d="${d}"/>`).join('\n')}\n</g>`).join('\n')}
</g>
${eng.length?`<g id="engrave" inkscape:groupmode="layer" inkscape:label="Engrave areas" fill="none" stroke="#0000ff" stroke-width="0.01">
${eng.map(r).join('\n')}
</g>
`:''}</svg>
`;
}
const partsSvg=L=>L.placed.map((q,i)=>`<path class="${i%2?'cutf':'cutp'}" fill-rule="evenodd" d="${q.cut.join(' ')}"/>`+
  (q.open.length?`<path class="cutl" d="${q.open.join(' ')}"/>`:'')).join('');
function drawSheet(gen,p,g,L){
  const fs=Math.max(L.SW,L.SH)/60,pad=fs*3.2;
  let o=`<svg viewBox="${-pad} ${-pad*1.2} ${L.SW+pad*2} ${L.SH+pad*2.4}" xmlns="http://www.w3.org/2000/svg">`+partsSvg(L);
  L.placed.forEach(q=>q.eng.forEach(a=>o+=`<rect class="engp" x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}"/>`));
  L.placed.forEach(q=>{if(q.part.label)o+=`<text class="lbl" x="${q.X(bbox(q.part.outline)[0])}" y="${q.Y(bbox(q.part.outline)[3])-fs*.6}" font-size="${fs}">${esc(q.part.label)}</text>`;});
  if(gen.annotate)o+=gen.annotate(p,g,L.placed,fs);
  o+=`<text class="lbl" style="font-weight:400" x="${L.SW/2}" y="${L.SH+pad*1.1}" font-size="${fs*.8}" text-anchor="middle">Sheet ${fmt(L.SW)} × ${fmt(L.SH)} mm</text>`;
  return o+'</svg>';
}

// ---------- parameters ----------
const allParams=gen=>gen.params.concat(COMMON);
function defaults(gen){const o={};allParams(gen).forEach(q=>o[q.id]=q.def);return o;}
function loadValues(gen,query){
  const v=defaults(gen);
  try{const s=JSON.parse(localStorage.getItem(KEY+gen.id)||'{}');for(const k in s)if(k in v&&s[k]!==null)v[k]=s[k];}catch(e){}
  for(const [k,s] of query){
    const q=allParams(gen).find(q=>q.id===k);
    if(q)v[k]=q.type==='bool'?(s==='1'||s==='true'):parseFloat(s);
  }
  return v;
}
function coreErrors(gen,p){
  const E=[];
  for(const q of allParams(gen)){
    if(q.type==='bool')continue;
    const v=p[q.id];
    if(!Number.isFinite(v))E.push(`${q.label} needs a number.`);
    else if(q.pos&&!(v>0))E.push(`${q.label} must be greater than 0.`);
    else if(q.min!==undefined&&v<q.min)E.push(`${q.label} must be at least ${q.min}.`);
    else if(q.type==='int'&&!Number.isInteger(v))E.push(`${q.label} must be a whole number.`);
  }
  return E;
}

// ---------- pages ----------
let cur=null,last=null;
const app=()=>$('app');
function thumb(gen){
  try{const p=defaults(gen);p.eng=false;const g=gen.build(p),L=layout(gen,p,g);
    return `<svg viewBox="0 0 ${L.SW} ${L.SH}" xmlns="http://www.w3.org/2000/svg">${partsSvg(L)}</svg>`;}
  catch(e){return '';}
}
function showIndex(){
  cur=null;document.title='LaserBoxes';
  const cats=[...new Set(gens.map(g=>g.group))];
  app().innerHTML='<div class="index">'+cats.map(c=>`<h2 class="cat">${esc(c)}</h2><div class="cards">`+
    gens.filter(g=>g.group===c).map(g=>`<a class="gcard" href="#${g.id}"><div class="thumb">${thumb(g)}</div><b>${esc(g.name)}</b><span>${esc(g.blurb)}</span></a>`).join('')+'</div>').join('')+'</div>';
}
function showGen(gen,query){
  cur=gen;document.title=gen.name+' · LaserBoxes';
  const vals=loadValues(gen,query),groups={};
  for(const q of allParams(gen))(groups[q.group]=groups[q.group]||[]).push(q);
  const form=Object.entries(groups).map(([grp,qs])=>`<fieldset><legend>${esc(grp)}</legend>`+qs.map(q=>q.type==='bool'
    ?`<label class="row chk" title="${esc(q.help||'')}"><span>${esc(q.label)}</span><input type="checkbox" data-id="${q.id}" ${vals[q.id]?'checked':''}></label>`
    :`<label class="row" title="${esc(q.help||'')}"><span>${esc(q.label)}</span><input type="number" data-id="${q.id}" step="${q.step||1}" value="${vals[q.id]}"></label>`).join('')+'</fieldset>').join('');
  const panels=(gen.panels||[]).map((pn,i)=>`<div class="card"><h2>${esc(pn.title)}</h2><div id="panel${i}"${pn.maxWidth?` style="max-width:${pn.maxWidth}px"`:''}></div></div>`).join('');
  app().innerHTML=`<div class="wrap"><aside>
<div class="card"><a href="#" class="back">← All generators</a><h1>${esc(gen.name)}</h1><p class="info">${esc(gen.blurb)}</p>
<form id="form" autocomplete="off">${form}</form>
<div class="btns"><button class="primary" id="dl" type="button">Download SVG</button><button id="reset" type="button">Reset defaults</button></div></div>
<div class="card"><h2>Warnings</h2><ul class="msgs" id="msgs"></ul></div></aside>
<main><div class="card prev"><h2>Cut sheet preview (red = cut, blue dashed = engrave area)</h2><div id="sheet"></div></div>
${panels}
${gen.checks?'<div class="card"><h2>Fit check (simulated at current values)</h2><div id="fit"></div></div>':''}
<div class="card"><details open><summary>How to use</summary>${gen.help||''}${COMMON_HELP}</details></div></main></div>`;
  $('form').addEventListener('input',update);
  $('form').addEventListener('change',update);
  $('dl').addEventListener('click',download);
  $('reset').addEventListener('click',()=>{const d=defaults(gen);setInputs(d);update();});
  update();
}
function setInputs(v){document.querySelectorAll('#form [data-id]').forEach(el=>{if(el.type==='checkbox')el.checked=!!v[el.dataset.id];else el.value=v[el.dataset.id];});}
function readParams(){
  const p={};
  document.querySelectorAll('#form [data-id]').forEach(el=>p[el.dataset.id]=el.type==='checkbox'?el.checked:parseFloat(el.value));
  return p;
}
function update(){
  const gen=cur,p=readParams(),d=defaults(gen);
  try{localStorage.setItem(KEY+gen.id,JSON.stringify(p))}catch(e){}
  const qs=new URLSearchParams();
  for(const k in p)if(p[k]!==d[k]&&!Number.isNaN(p[k]))qs.set(k,typeof p[k]==='boolean'?(p[k]?1:0):p[k]);
  try{history.replaceState(null,'','#'+gen.id+(qs.toString()?'?'+qs:''))}catch(e){}
  const v={errors:coreErrors(gen,p),warnings:[],info:[]};
  let g=null;
  try{
    if(!v.errors.length){
      g=gen.build(p);
      const r=gen.validate?gen.validate(p,g):{};
      v.errors.push(...(r.errors||[]));v.warnings=r.warnings||[];v.info=r.info||[];
    }
  }catch(e){v.errors.push('Generator error: '+e.message);}
  const li=(c,t)=>`<li class="${c}">${t}</li>`;
  $('msgs').innerHTML=v.errors.map(t=>li('err',t)).join('')+v.warnings.map(t=>li('warn',t)).join('')+
    (v.errors.length||v.warnings.length?'':li('ok','No problems found.'))+v.info.map(t=>li('info',t)).join('');
  $('dl').disabled=!!v.errors.length;
  const views=['sheet',...(gen.panels||[]).map((_,i)=>'panel'+i)];
  if(v.errors.length){
    last=null;
    views.forEach(id=>$(id).innerHTML='<p class="err">Fix the errors to see the drawing.</p>');
    if($('fit'))$('fit').innerHTML='<p class="err">Not run: fix the errors first.</p>';
    return;
  }
  try{
    const L=layout(gen,p,g);last={gen,p,g,L};
    if(L.tooWide)$('msgs').insertAdjacentHTML('afterbegin',li('warn',`A part is wider than the sheet width (${fmt(p.sheetW)} mm).`));
    $('sheet').innerHTML=drawSheet(gen,p,g,L);
    (gen.panels||[]).forEach((pn,i)=>$('panel'+i).innerHTML=pn.render(p,g));
    if(gen.checks){
      const R=gen.checks(p,g),all=R.every(r=>r.ok);
      $('fit').innerHTML=`<p class="${all?'ok':'err'}"><b>${all?'PASS: parts fit at these values.':'FAIL: see below.'}</b></p><table class="chk">${R.map(r=>`<tr><td class="${r.ok?'ok':'err'}">${r.ok?'✓':'✗'}</td><td><b>${r.name}</b><br><span class="info">${r.detail}</span></td></tr>`).join('')}</table>`;
    }
  }catch(e){
    last=null;$('dl').disabled=true;
    $('msgs').insertAdjacentHTML('afterbegin',li('err','Drawing error: '+esc(e.message)));
  }
}
function download(){
  if(!last)return;
  const {gen,p,L}=last,blob=new Blob([svgFile(gen,p,L)],{type:'image/svg+xml'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=gen.filename?gen.filename(p):gen.id+'.svg';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function route(){
  const [id,qs]=location.hash.slice(1).split('?');
  const gen=gens.find(g=>g.id===id);
  if(gen)showGen(gen,new URLSearchParams(qs||''));else showIndex();
}
function start(){window.addEventListener('hashchange',route);route();}

return {register:g=>gens.push(g),start,gens,
  rect,area,clean,offset,bbox,pathOf,f3,fmt,esc,dimH,dimV,
  layout,svgFile,defaults};
})();
