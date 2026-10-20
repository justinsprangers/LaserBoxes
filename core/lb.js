'use strict';
/* LaserBoxes core: generator registry, geometry helpers, form, live preview, sheet layout,
   and SVG / DXF / 1:1 print export. Generators call LB.register({...}); see README.md.
   Plain script (no modules) so index.html works when opened straight from disk. */
const LB=(()=>{
const gens=[];
const KEY='laserBoxes.';
const SHEET_GAP=20;
let repo='';
const COMMON=[
  {id:'k',label:'Kerf',def:0.15,step:0.01,group:'Cutting',min:0,help:'Width of the laser cut; paths are offset by half of it. CNC: set 0 and let your CAM software offset by the bit radius.'},
  {id:'gap',label:'Gap between parts',def:10,step:1,group:'Cutting',min:0},
  {id:'sheetW',label:'Sheet width (0 = auto)',def:0,step:10,group:'Cutting',min:0,help:'Parts wrap onto a new row past this width. Set it to your bed width.'},
  {id:'sheetH',label:'Sheet height (0 = no limit)',def:0,step:10,group:'Cutting',min:0,help:'Parts that don\'t fit go onto another sheet.'},
  {id:'dog',label:'Dog-bone bit diameter (0 = off)',def:0,step:0.5,group:'Cutting',min:0,help:'CNC routers only: round reliefs in inside corners so square tabs fit.'},
  {id:'eng',label:'Include engrave areas (blue)',def:true,type:'bool',group:'Cutting'},
];
const COMMON_HELP=`<ul>
<li>Edit any value; the drawings update live. Values are remembered per generator in this browser, and the page address carries any changed values: <b>Copy link</b> to share or bookmark a setup.</li>
<li><b>Download SVG</b> gives real-mm sheets. Cut paths are 0.01 mm red (#FF0000) hairlines on layer <code>Cut</code>; engrave areas are blue (#0000FF) rectangles on layer <code>Engrave areas</code>. Put artwork inside the blue boxes, then delete or disable that layer before cutting. <b>Download DXF</b> has the same geometry (layers CUT and ENGRAVE, mm).</li>
<li><b>Kerf</b> is compensated: outlines grow by kerf/2 and holes shrink by kerf/2, so finished parts come out at nominal size. Set it to 0 if your software compensates instead.</li>
<li>Set <b>sheet width and height</b> to your bed size: parts wrap into rows, turn 90° if that makes them fit, and spill onto extra sheets. With more than one sheet, pick which to download.</li>
<li><b>Print 1:1</b> prints each part at actual size (with a 50 mm scale bar) so you can check sizes on paper. Print at 100% / actual size, not "fit to page".</li>
</ul>`;
const INDEX_HELP=`<div class="card howto"><h2>How to cut</h2><ol>
<li><b>Measure your kerf once.</b> Open <a href="#plate?holes=0&amp;k=0&amp;W=50&amp;H=50">Plate</a> (50 × 50 mm, kerf 0), cut it, and measure it with calipers. Kerf = 50 − measured size. Enter that as the kerf in every generator (it's remembered per generator).</li>
<li><b>Test a joint before a big job.</b> Cut a small open box from scrap. Too tight: raise <i>Joint clearance</i> by 0.05 mm. Too loose: lower it, or lower the kerf a little.</li>
<li><b>Materials.</b> 3 mm plywood or MDF works for everything here. Acrylic: use about 0.05–0.1 mm joint clearance, and avoid living hinges (it cracks).</li>
<li><b>CNC routers.</b> Set kerf to 0, set the dog-bone diameter to your bit, download DXF, and let your CAM software offset outlines outside and holes inside.</li>
<li><b>Check sizes on paper</b> with Print 1:1 before cutting good material.</li>
</ol></div>`;
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
// Dog-bone: at each inside corner of the material, cut a circle of radius r that passes through
// the corner, centred along the bisector into the material. hole = true for holes (material outside).
function dogbone(P,r,hole){
  if(!(r>0))return P;
  const Q=area(P)>0?P:P.slice().reverse(),n=Q.length,out=[],TAU=2*Math.PI;
  const unit=(x,y)=>{const L=Math.hypot(x,y);return [x/L,y/L];};
  for(let i=0;i<n;i++){
    const A=Q[(i-1+n)%n],V=Q[i],B=Q[(i+1)%n];
    const e1=unit(V[0]-A[0],V[1]-A[1]),e2=unit(B[0]-V[0],B[1]-V[1]),cr=e1[0]*e2[1]-e1[1]*e2[0];
    if(hole?cr<=1e-9:cr>=-1e-9){out.push(V);continue;}
    const u=unit(e1[0]-e2[0],e1[1]-e2[1]),C=[V[0]+r*u[0],V[1]+r*u[1]];
    const k1=2*r*(u[0]*e1[0]+u[1]*e1[1]),k2=2*r*(u[0]*e2[0]+u[1]*e2[1]);
    const P1=[V[0]+k1*e1[0],V[1]+k1*e1[1]],P2=[V[0]+k2*e2[0],V[1]+k2*e2[1]];
    const ang=Q=>Math.atan2(Q[1]-C[1],Q[0]-C[0]),a1=ang(P1),a2=ang(P2),aV=ang(V);
    const mod=x=>((x%TAU)+TAU)%TAU;
    let sweep=mod(a2-a1);
    if(mod(aV-a1)<sweep)sweep-=TAU;
    out.push(P1);
    for(let j=1;j<10;j++){const a=a1+sweep*j/10;out.push([C[0]+r*Math.cos(a),C[1]+r*Math.sin(a)]);}
    out.push(P2);
  }
  return out;
}
const pathOf=(P,X,Y)=>'M'+P.map(([a,b])=>f3(X(a))+' '+f3(Y(b))).join(' L')+' Z';

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
// Parts go left to right in rows, top-aligned, with kerf (and dog-bones) applied. Rows wrap at
// the sheet width (auto: about twice the square root of the total part area); a part turns 90°
// if that's the only way it fits; past the sheet height a new sheet starts.
// Each placed part stores its cut geometry in its sheet's coordinates (mm, y down), and, unless
// rotated, X(x) and Y(y) mapping its own coordinates into the stacked preview for annotation.
// part.cuts are open polylines (e.g. living-hinge slits); kerf doesn't apply to them.
function layout(gen,p,g){
  const M=5,parts=gen.parts(p,g);
  const items=parts.map(part=>{const out=dogbone(offset(part.outline,p.k/2),p.dog/2,false);return {part,out,bb:bbox(out)};});
  const area=items.reduce((a,i)=>a+(i.bb[2]-i.bb[0]+p.gap)*(i.bb[3]-i.bb[1]+p.gap),0);
  const widest=Math.max(...items.map(i=>i.bb[2]-i.bb[0]));
  const target=p.sheetW>0?p.sheetW-2*M:Math.max(widest,2*Math.sqrt(area)),roomH=p.sheetH>0?p.sheetH-2*M:Infinity;
  const fits=(w,h)=>w<=target+1e-9&&h<=roomH+1e-9;
  const sheets=[],placed=[];
  let sh,ox,oy,rowH,rotated=false,misfit=false;
  const newSheet=()=>{sh={placed:[],w:0,h:0};sheets.push(sh);ox=M;oy=M;rowH=0;};
  newSheet();
  for(const {part,out,bb} of items){
    let w=bb[2]-bb[0],h=bb[3]-bb[1],rot=false;
    if(!fits(w,h)&&fits(h,w)){rot=true;rotated=true;[w,h]=[h,w];}
    if(!fits(w,h))misfit=true;
    if(ox>M&&ox-M+w>target+1e-9){ox=M;oy+=rowH+p.gap;rowH=0;}
    if(oy>M&&oy-M+h>roomH+1e-9)newSheet();
    const x0=ox,y0=oy;
    const T=rot?([x,y])=>[x0+(bb[3]-y),y0+(bb[2]-x)]:([x,y])=>[x0+(x-bb[0]),y0+(bb[3]-y)];
    const rings=[out.map(T)],circles=[];
    for(const h of part.holes||[]){
      if(h.circle){const [cx,cy]=T(h.circle);circles.push([cx,cy,h.circle[2]-p.k/2]);}
      else rings.push(dogbone(offset(h,-p.k/2),p.dog/2,true).map(T));
    }
    const eng=p.eng?(part.engrave||[]).filter(r=>r[2]>r[0]&&r[3]>r[1]).map(r=>{
      const a=T([r[0],r[1]]),b=T([r[2],r[3]]);
      return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])];}):[];
    const q={part,sheet:sheets.length-1,rot,rings,circles,open:(part.cuts||[]).map(pl=>pl.map(T)),eng,x0,y0,w,h,bb};
    sh.placed.push(q);placed.push(q);
    ox+=w+p.gap;rowH=Math.max(rowH,h);sh.w=Math.max(sh.w,ox-p.gap+M);sh.h=Math.max(sh.h,oy+rowH+M);
  }
  let off=0;
  for(const s of sheets){
    if(p.sheetW>0)s.w=p.sheetW;
    if(p.sheetH>0)s.h=p.sheetH;
    s.off=off;off+=s.h+SHEET_GAP;
  }
  for(const q of placed)if(!q.rot){
    const o=sheets[q.sheet].off,{x0,y0,bb}=q;
    q.X=x=>x0+(x-bb[0]);q.Y=y=>o+y0+(bb[3]-y);
  }
  return {sheets,placed,rotated,misfit,W:Math.max(...sheets.map(s=>s.w)),H:off-SHEET_GAP,framed:p.sheetW>0||p.sheetH>0||sheets.length>1};
}
// Sheets to export: one (index) or all of them stacked.
function selection(L,si){
  const list=si==null?L.sheets:[L.sheets[si]];
  let off=0;const parts=[];
  for(const s of list){for(const q of s.placed)parts.push({q,dy:off});off+=s.h+SHEET_GAP;}
  return {parts,W:Math.max(...list.map(s=>s.w)),H:off-SHEET_GAP};
}
const ringD=(P,dy=0)=>'M'+P.map(([x,y])=>f3(x)+' '+f3(y+dy)).join(' L')+' Z';
const openD=(P,dy=0)=>'M'+P.map(([x,y])=>f3(x)+' '+f3(y+dy)).join(' L');
const circleD=([cx,cy,r],dy=0)=>`M${f3(cx-r)} ${f3(cy+dy)} A${f3(r)} ${f3(r)} 0 1 0 ${f3(cx+r)} ${f3(cy+dy)} A${f3(r)} ${f3(r)} 0 1 0 ${f3(cx-r)} ${f3(cy+dy)} Z`;
const cutPaths=(q,dy=0)=>[...q.rings.map(r=>ringD(r,dy)),...q.circles.map(c=>circleD(c,dy)),...q.open.map(o=>openD(o,dy))];
const paramLine=(gen,p)=>allParams(gen).map(q=>q.id+'='+(q.type==='bool'?(p[q.id]?1:0):p[q.id])).join(' ');
function svgFile(gen,p,L,si){
  const S=selection(L,si);
  const eng=S.parts.flatMap(({q,dy})=>q.eng.map(a=>`<rect x="${f3(a[0])}" y="${f3(a[1]+dy)}" width="${f3(a[2])}" height="${f3(a[3])}"/>`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${f3(S.W)}mm" height="${f3(S.H)}mm" viewBox="0 0 ${f3(S.W)} ${f3(S.H)}">
<!-- LaserBoxes: ${gen.id}${si==null?'':` sheet ${si+1}`}. ${paramLine(gen,p)} -->
<g id="cut" inkscape:groupmode="layer" inkscape:label="Cut" fill="none" stroke="#ff0000" stroke-width="0.01">
${S.parts.map(({q,dy},i)=>`<g id="part-${i+1}">\n${cutPaths(q,dy).map(d=>`<path d="${d}"/>`).join('\n')}\n</g>`).join('\n')}
</g>
${eng.length?`<g id="engrave" inkscape:groupmode="layer" inkscape:label="Engrave areas" fill="none" stroke="#0000ff" stroke-width="0.01">
${eng.join('\n')}
</g>
`:''}</svg>
`;
}
// DXF R12 (mm, y up): closed and open POLYLINEs and CIRCLEs on layers CUT and ENGRAVE.
function dxfFile(gen,p,L,si){
  const S=selection(L,si),o=[];
  const y=v=>f3(S.H-v);
  const poly=(pts,closed,layer)=>{
    o.push('0','POLYLINE','8',layer,'66','1','70',closed?'1':'0','10','0','20','0','30','0');
    for(const [a,b] of pts)o.push('0','VERTEX','8',layer,'10',f3(a),'20',y(b),'30','0');
    o.push('0','SEQEND','8',layer);
  };
  o.push('999',`LaserBoxes ${gen.id}. ${paramLine(gen,p)}`,'0','SECTION','2','HEADER','9','$INSUNITS','70','4','9','$MEASUREMENT','70','1','0','ENDSEC','0','SECTION','2','ENTITIES');
  for(const {q,dy} of S.parts){
    const sh=P=>P.map(([a,b])=>[a,b+dy]);
    q.rings.forEach(r=>poly(sh(r),true,'CUT'));
    q.open.forEach(r=>poly(sh(r),false,'CUT'));
    q.circles.forEach(([cx,cy,r])=>o.push('0','CIRCLE','8','CUT','10',f3(cx),'20',y(cy+dy),'30','0','40',f3(r)));
    q.eng.forEach(([x,yy,w,h])=>poly(sh([[x,yy],[x+w,yy],[x+w,yy+h],[x,yy+h]]),true,'ENGRAVE'));
  }
  o.push('0','ENDSEC','0','EOF');
  return o.join('\r\n')+'\r\n';
}
const partsSvg=(L,withOff=true)=>L.placed.map((q,i)=>{
  const dy=withOff?L.sheets[q.sheet].off:0,cls=i%2?'cutf':'cutp';
  const closed=[...q.rings.map(r=>ringD(r,dy)),...q.circles.map(c=>circleD(c,dy))].join(' ');
  return `<path class="${cls}" fill-rule="evenodd" d="${closed}"/>`+(q.open.length?`<path class="cutl" d="${q.open.map(o=>openD(o,dy)).join(' ')}"/>`:'');
}).join('');
function drawSheet(gen,p,g,L){
  const fs=Math.max(L.W,Math.min(L.H,L.W*1.5))/60,pad=fs*3.2;
  let o=`<svg viewBox="${-pad} ${-pad*1.2} ${L.W+pad*2} ${L.H+pad*2.4}" xmlns="http://www.w3.org/2000/svg">`;
  if(L.framed)L.sheets.forEach((s,i)=>{
    o+=`<rect class="sheetf" x="0" y="${s.off}" width="${s.w}" height="${s.h}"/>`;
    if(L.sheets.length>1)o+=`<text class="lbl" x="${s.w}" y="${s.off-fs*.4}" font-size="${fs*.8}" text-anchor="end">Sheet ${i+1}</text>`;
  });
  o+=partsSvg(L);
  L.placed.forEach(q=>{
    const dy=L.sheets[q.sheet].off;
    q.eng.forEach(a=>o+=`<rect class="engp" x="${a[0]}" y="${a[1]+dy}" width="${a[2]}" height="${a[3]}"/>`);
    if(q.part.label)o+=`<text class="lbl" x="${q.x0}" y="${q.y0+dy-fs*.6}" font-size="${fs*.8}">${esc(q.part.label)}${q.rot?' ↻':''}</text>`;
  });
  if(gen.annotate&&!L.rotated)o+=gen.annotate(p,g,L.placed,fs);
  const size=L.sheets.length>1?`${L.sheets.length} sheets, ${fmt(L.sheets[0].w)} × ${fmt(L.sheets[0].h)} mm each`:`Sheet ${fmt(L.W)} × ${fmt(L.H)} mm`;
  o+=`<text class="lbl" style="font-weight:400" x="${L.W/2}" y="${L.H+pad*1.1}" font-size="${fs*.8}" text-anchor="middle">${size}${L.rotated?' · ↻ = turned 90° to fit (dimensions hidden)':''}</text>`;
  return o+'</svg>';
}
// 1:1 print: each part on its own page at real size, with a 50 mm scale bar.
function printParts(){
  if(!last)return;
  const {gen,L}=last;
  const pages=L.placed.map(q=>{
    const vb=`${f3(q.x0-1)} ${f3(q.y0-1)} ${f3(q.w+2)} ${f3(q.h+2)}`;
    const eng=q.eng.map(a=>`<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" fill="none" stroke="#0057d9" stroke-width="0.2" stroke-dasharray="2 1.5"/>`).join('');
    return `<div class="pg"><p>${esc(gen.name)}: ${esc(q.part.label||'part')} (${fmt(q.w)} × ${fmt(q.h)} mm)</p>
<svg xmlns="http://www.w3.org/2000/svg" width="${f3(q.w+2)}mm" height="${f3(q.h+2)}mm" viewBox="${vb}"><path d="${cutPaths(q).join(' ')}" fill="none" stroke="#000" stroke-width="0.2"/>${eng}</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="52mm" height="6mm" viewBox="-1 0 52 6"><path d="M0 1 V5 M0 3 H50 M50 1 V5" stroke="#000" stroke-width="0.3" fill="none"/></svg><span> 50 mm: measure this to check the print scale.</span></div>`;
  }).join('');
  const w=window.open('','_blank');
  if(!w){alert('Allow pop-ups for this page to print.');return;}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(gen.name)} 1:1</title><style>@page{margin:10mm}body{margin:0;font:12px system-ui,sans-serif}.pg{page-break-after:always;margin-bottom:10mm}p{margin:0 0 3mm}span{vertical-align:top}</style></head><body>${pages}<script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
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
const footer=()=>`<footer class="info">LaserBoxes · MIT licensed · cut files are provided as-is: test-cut first${repo?` · <a href="${esc(repo)}">Source</a> · <a href="${esc(repo)}/issues">Report a problem</a>`:''}</footer>`;
function thumb(gen){
  try{const p=defaults(gen);p.eng=false;const g=gen.build(p),L=layout(gen,p,g);
    return `<svg viewBox="0 0 ${L.W} ${L.H}" xmlns="http://www.w3.org/2000/svg">${partsSvg(L)}</svg>`;}
  catch(e){return '';}
}
const badge=g=>g.experimental?' <span class="badge">Experimental</span>':'';
function showIndex(){
  cur=null;document.title='LaserBoxes: free laser-cut box generators';
  const cats=[...new Set(gens.map(g=>g.group))];
  app().innerHTML='<div class="index">'+cats.map(c=>`<h2 class="cat">${esc(c)}</h2><div class="cards">`+
    gens.filter(g=>g.group===c).map(g=>`<a class="gcard" href="#${g.id}"><div class="thumb">${thumb(g)}</div><b>${esc(g.name)}${badge(g)}</b><span>${esc(g.blurb)}</span></a>`).join('')+'</div>').join('')+
    INDEX_HELP+'</div>'+footer();
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
<div class="card"><a href="#" class="back">← All generators</a><h1>${esc(gen.name)}${badge(gen)}</h1><p class="info">${esc(gen.blurb)}</p>
${gen.experimental?`<p class="warn">${esc(gen.experimental)}</p>`:''}
<form id="form" autocomplete="off">${form}</form>
<label class="row chk" id="sheetPick" hidden><span>Download</span><select id="sheetSel"></select></label>
<div class="btns"><button class="primary" id="dl" type="button">Download SVG</button><button id="dxf" type="button">Download DXF</button></div>
<div class="btns"><button id="print" type="button">Print 1:1</button><button id="copy" type="button">Copy link</button><button id="reset" type="button">Reset defaults</button></div></div>
<div class="card"><h2>Warnings</h2><ul class="msgs" id="msgs"></ul></div></aside>
<main><div class="card prev"><h2>Cut sheet preview (red = cut, blue dashed = engrave area)</h2><div id="sheet"></div></div>
${panels}
${gen.checks?'<div class="card"><h2>Fit check (simulated at current values)</h2><div id="fit"></div></div>':''}
<div class="card"><details open><summary>How to use</summary>${gen.help||''}${COMMON_HELP}</details></div></main></div>`+footer();
  // Recalculate once typing pauses: some fit checks take a moment.
  let timer=null;
  const later=()=>{clearTimeout(timer);timer=setTimeout(update,150);};
  $('form').addEventListener('input',later);
  $('form').addEventListener('change',later);
  $('dl').addEventListener('click',()=>download('svg'));
  $('dxf').addEventListener('click',()=>download('dxf'));
  $('print').addEventListener('click',printParts);
  $('copy').addEventListener('click',copyLink);
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
  const show=()=>{$('msgs').innerHTML=v.errors.map(t=>li('err',t)).join('')+v.warnings.map(t=>li('warn',t)).join('')+
    (v.errors.length||v.warnings.length?'':li('ok','No problems found.'))+v.info.map(t=>li('info',t)).join('');};
  ['dl','dxf','print'].forEach(id=>$(id).disabled=!!v.errors.length);
  const views=['sheet',...(gen.panels||[]).map((_,i)=>'panel'+i)];
  if(v.errors.length){
    last=null;show();$('sheetPick').hidden=true;
    views.forEach(id=>$(id).innerHTML='<p class="err">Fix the errors to see the drawing.</p>');
    if($('fit'))$('fit').innerHTML='<p class="err">Not run: fix the errors first.</p>';
    return;
  }
  try{
    const L=layout(gen,p,g);last={gen,p,g,L};
    if(L.misfit)v.warnings.unshift(`A part doesn't fit on a ${fmt(p.sheetW||L.W)} × ${p.sheetH?fmt(p.sheetH):'∞'} mm sheet even turned 90°.`);
    show();
    const sel=$('sheetSel'),prev=sel.value;
    $('sheetPick').hidden=L.sheets.length<2;
    sel.innerHTML='<option value="">All sheets in one file</option>'+L.sheets.map((_,i)=>`<option value="${i}">Sheet ${i+1}</option>`).join('');
    if([...sel.options].some(o=>o.value===prev))sel.value=prev;
    $('sheet').innerHTML=drawSheet(gen,p,g,L);
    (gen.panels||[]).forEach((pn,i)=>$('panel'+i).innerHTML=pn.render(p,g));
    if(gen.checks){
      const R=gen.checks(p,g),all=R.every(r=>r.ok);
      $('fit').innerHTML=`<p class="${all?'ok':'err'}"><b>${all?'PASS: parts fit at these values.':'FAIL: see below.'}</b></p><table class="chk">${R.map(r=>`<tr><td class="${r.ok?'ok':'err'}">${r.ok?'✓':'✗'}</td><td><b>${r.name}</b><br><span class="info">${r.detail}</span></td></tr>`).join('')}</table>`;
    }
  }catch(e){
    last=null;['dl','dxf','print'].forEach(id=>$(id).disabled=true);
    show();$('msgs').insertAdjacentHTML('afterbegin',li('err','Drawing error: '+esc(e.message)));
  }
}
function download(kind){
  if(!last)return;
  const {gen,p,L}=last,v=$('sheetSel').value,si=L.sheets.length>1&&v!==''?+v:null;
  const text=kind==='dxf'?dxfFile(gen,p,L,si):svgFile(gen,p,L,si);
  const blob=new Blob([text],{type:kind==='dxf'?'application/dxf':'image/svg+xml'});
  const base=(gen.filename?gen.filename(p):gen.id+'.svg').replace(/\.svg$/,'');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`${base}${si==null?'':'_sheet'+(si+1)}.${kind}`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function copyLink(){
  const url=location.href,btn=$('copy');
  const done=()=>{btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy link',1500);};
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(url).then(done,()=>prompt('Copy this link:',url));
  else prompt('Copy this link:',url);
}
function route(){
  const [id,qs]=location.hash.slice(1).split('?');
  const gen=gens.find(g=>g.id===id);
  if(gen)showGen(gen,new URLSearchParams(qs||''));else showIndex();
  window.scrollTo(0,0);
}
function start(opts={}){repo=opts.repo||'';window.addEventListener('hashchange',route);route();}

return {register:g=>gens.push(g),start,gens,
  rect,area,clean,offset,bbox,pathOf,dogbone,f3,fmt,esc,dimH,dimV,
  layout,svgFile,dxfFile,defaults};
})();
