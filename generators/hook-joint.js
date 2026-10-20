'use strict';
/* Gravity hook joint: two-panel L cover for a resin printer lid (top + hanging front).
   Fingers on the front panel's top edge rise through slots in the top panel, slide sideways
   by h, then drop so a small tooth seats in its own slot and locks the panel. */
(()=>{
const {rect,clean,offset,bbox,pathOf,fmt,f3,dimH,dimV}=LB;

const PARAMS=[
  {id:'W',label:'Width W',def:300,step:1,group:'Panels',pos:true},
  {id:'D',label:'Top depth D_top',def:250,step:1,group:'Panels',pos:true},
  {id:'H',label:'Front height H_front',def:150,step:1,group:'Panels',pos:true},
  {id:'tT',label:'Top thickness t_top',def:3,step:0.1,group:'Panels',pos:true},
  {id:'tF',label:'Front thickness t_front',def:3,step:0.1,group:'Panels',pos:true},
  {id:'N',label:'Fingers N',def:4,step:1,group:'Joint',type:'int',min:1},
  {id:'w',label:'Finger (stem) width w',def:10,step:0.5,group:'Joint',pos:true},
  {id:'h',label:'Hook overhang h',def:8,step:0.5,group:'Joint',pos:true},
  {id:'hk',label:'Hook thickness',def:5,step:0.5,group:'Joint',pos:true},
  {id:'th',label:'Tooth height',def:2,step:0.1,group:'Joint',pos:true},
  {id:'tw',label:'Tooth width',def:3,step:0.1,group:'Joint',pos:true},
  {id:'m',label:'End margin',def:20,step:1,group:'Joint',min:0},
  {id:'wall',label:'Front wall (edge to slot)',def:4,step:0.5,group:'Joint',min:0},
  {id:'c',label:'Fit clearance (per side)',def:0.2,step:0.05,group:'Joint',min:0},
  {id:'em',label:'Engrave inset margin',def:10,step:1,group:'Engrave',min:0},
];

// ---------- geometry ----------
// x along the width (0..W, left to right seen from the front).
// Top panel: y = depth from its front edge; z = 0 underside, z = t_top top surface.
// Front panel (local): z = 0 at its main top edge, body down to -H; fingers rise above.
function geom(p){
  const {W,tT,tF,w,h,hk,th,tw,m,wall,c}=p,N=p.N;
  const lift=th+c;              // lift travel for the tooth to clear = seated gap under the top panel
  const zHb=tT+lift;            // hook underside, measured from the front panel's top edge
  const zHt=zHb+hk;             // finger top
  const F=w+2*h+2*c;            // x footprint of one joint in the top panel (main slot + bridge + tooth slot)
  const pitch=N>1?(W-2*m-F)/(N-1):0;
  const xs=[];                  // seated x of each stem's left edge
  for(let i=0;i<N;i++){const fs=N>1?m+i*pitch:(W-F)/2;xs.push(fs+h+c);}
  const s=wall+c;               // front panel outer face, behind the top panel's front edge
  const slotY0=wall,slotY1=s+tF+c;
  const slots=xs.map(x=>({main:[x-h-c,x+w+c],tooth:[x+w+h-tw-c,x+w+h+c]}));
  return {N,lift,zHb,zHt,F,pitch,xs,s,slotY0,slotY1,slots,bridge:h-tw-2*c,web:N>1?pitch-F:Infinity};
}
function frontOutline(p,g){
  const {W,H,w,h,th,tw}=p;
  const pts=[[0,-H],[W,-H],[W,0]];
  for(let i=g.N-1;i>=0;i--){
    const x=g.xs[i];
    pts.push([x+w,0],[x+w,g.zHb],[x+w+h-tw,g.zHb],[x+w+h-tw,g.zHb-th],[x+w+h,g.zHb-th],[x+w+h,g.zHt],[x,g.zHt],[x,0]);
  }
  pts.push([0,0]);
  return clean(pts);
}
function parts(p,g){
  const e=p.em;
  return [
    {label:'TOP (from above, front edge at bottom)',outline:rect(0,0,p.W,p.D),
     holes:g.slots.flatMap(s=>[s.main,s.tooth].map(([a,b])=>rect(a,g.slotY0,b,g.slotY1))),
     engrave:[[e,g.slotY1+e,p.W-e,p.D-e]]},
    {label:'FRONT (from the front)',outline:frontOutline(p,g),engrave:[[e,-p.H+e,p.W-e,-e]]},
  ];
}

// ---------- validation ----------
function validate(p,g){
  const E=[],Wn=[],I=[];
  if(g.bridge<=0)E.push(`Tooth slot runs into the main slot: h must be more than tooth width + 2 × clearance (${fmt(p.tw+2*p.c)} mm).`);
  else if(g.bridge<2)Wn.push(`The bridge between the main slot and tooth slot is only ${fmt(g.bridge)} mm, and the hook rests on it. Aim for 2 mm or more (raise h).`);
  if(g.F>p.W-2*p.m)E.push(`One joint needs ${fmt(g.F)} mm of width but only ${fmt(p.W-2*p.m)} mm fits between the end margins.`);
  else if(g.web<0)E.push(`Joints overlap: ${p.N} × ${fmt(g.F)} mm doesn't fit in ${fmt(p.W-2*p.m)} mm. Reduce N, w or h, or the end margin.`);
  else if(g.web<5)Wn.push(`Only ${fmt(g.web)} mm of material between neighbouring joints.`);
  if(g.slotY1>=p.D-1)E.push('The slots reach the back of the top panel (D_top too small).');
  if(p.wall<4)Wn.push(`Front wall is ${fmt(p.wall)} mm (under 4 mm); the strip in front of the slots may crack.`);
  if(p.th>p.tT)Wn.push(`Tooth (${p.th} mm) is taller than t_top (${p.tT} mm), so it pokes out under the top panel. Works, but the lift gap grows.`);
  if(p.th<1)Wn.push('Tooth under 1 mm tall: a light bump could unseat it.');
  if(p.c===0)Wn.push('Zero clearance: parts will probably jam, since sheet thickness varies.');
  if(p.c>0.5)Wn.push('Clearance over 0.5 mm per side: the joint will rattle.');
  if(p.hk<p.tF)Wn.push(`Hook thickness (${p.hk} mm) is less than the sheet thickness; the hook may snap off.`);
  if(p.w<2*p.tF)Wn.push(`Stem width (${p.w} mm) is under 2 × t_front; the stems carry the panel's weight and may be fragile.`);
  if(p.k>0.5)Wn.push('Kerf over 0.5 mm is unusual for a laser; double-check it.');
  if(p.tw>p.h*0.6&&g.bridge>0)Wn.push('Tooth is wide relative to h, leaving little hook to bear on the top panel.');
  if(p.eng&&(p.W-2*p.em<=0||p.H-2*p.em<=0||p.D-p.em-(g.slotY1+p.em)<=0))Wn.push('Engrave margin is too large: at least one engrave area has no size and is skipped.');
  I.push(`Front panel's outer face sits ${fmt(g.s)} mm behind the top panel's front edge (front wall + clearance). With the faces flush, a closed slot isn't possible.`);
  I.push(`Seated, the front panel's top edge hangs ${fmt(g.lift)} mm below the top panel: room to lift the tooth clear.`);
  I.push(`To install, the front panel starts ${fmt(p.h)} mm to the left (seen from the front) of its final position.`);
  return {errors:E,warnings:Wn,info:I};
}

// ---------- fit simulation (2D section in the front panel's plane) ----------
const EPS=1e-6;
function topSolid(p,g){ // top panel material in the front panel's plane, as [x0,z0,x1,z1]
  const cuts=[];g.slots.forEach(s=>cuts.push(s.main,s.tooth));cuts.sort((a,b)=>a[0]-b[0]);
  const out=[];let x=0;
  for(const [a,b] of cuts){if(a>x)out.push([x,a]);x=Math.max(x,b);}
  if(x<p.W)out.push([x,p.W]);
  return out.map(([a,b])=>[a,0,b,p.tT]);
}
function frontRects(p,g,dx,zb){
  const r=[[0,-p.H,p.W,0]];
  for(const x of g.xs){
    r.push([x,0,x+p.w,g.zHt]);                                   // stem
    r.push([x,g.zHb,x+p.w+p.h,g.zHt]);                           // hook
    r.push([x+p.w+p.h-p.tw,g.zHb-p.th,x+p.w+p.h,g.zHb]);         // tooth
  }
  return r.map(([a,b,c,d])=>[a+dx,b+zb,c+dx,d+zb]);
}
function hits(A,B){
  for(const a of A)for(const b of B)
    if(Math.min(a[2],b[2])-Math.max(a[0],b[0])>EPS&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>EPS)return true;
  return false;
}
function sweep(p,g,T,from,to,step){ // first blocked pose [dx, zb], or null
  const L=Math.hypot(to[0]-from[0],to[1]-from[1]),n=Math.max(1,Math.ceil(L/step));
  for(let i=0;i<=n;i++){
    const t=i/n,dx=from[0]+(to[0]-from[0])*t,zb=from[1]+(to[1]-from[1])*t;
    if(hits(frontRects(p,g,dx,zb),T))return [dx,zb];
  }
  return null;
}
function freeTravel(p,g,T,pose,dir,max){
  const step=0.002;
  for(let d=step;d<=max;d+=step)if(hits(frontRects(p,g,pose[0]+dir*d,pose[1]),T))return d-step;
  return Infinity;
}
function fitCheck(p,g){
  const T=topSolid(p,g),R=[];
  const add=(ok,name,detail)=>R.push({ok,name,detail});
  const start=[-p.h,-(g.zHt+p.tT+2)],up=[-p.h,0],slid=[0,0],seat=[0,-g.lift];
  let b=sweep(p,g,T,start,up,0.02);
  add(!b,'Rise through the main slots',b?`Collides at x shift ${fmt(b[0])}, height ${fmt(b[1])}`:`Full L (stem + hook + tooth) passes; ${fmt(p.c)} mm clearance at each slot end.`);
  const toothClear=up[1]+g.zHb-p.th-p.tT;
  add(toothClear>0,'Tooth clears the top surface when lifted',`Tooth bottom is ${fmt(toothClear)} mm above the surface with the panel lifted against the underside.`);
  b=sweep(p,g,T,up,slid,0.005);
  add(!b,`Slide +x by h = ${fmt(p.h)} mm`,b?`Collides at x shift ${fmt(b[0])}`:'Stem stays inside the main slot for the whole slide.');
  b=sweep(p,g,T,slid,seat,0.002);
  add(!b,'Drop: tooth falls into tooth slot',b?`Collides at height ${fmt(b[1])}`:`Panel drops ${fmt(g.lift)} mm.`);
  const rest=seat[1]+g.zHb-p.tT;
  const bearing=g.xs.reduce((s,x)=>{let L=0;for(const t of T)L+=Math.max(0,Math.min(t[2],x+p.w+p.h)-Math.max(t[0],x+p.w));return Math.min(s,L);},Infinity);
  add(Math.abs(rest)<1e-9&&bearing>0,'Hooks rest on the top surface',`Hook underside to top surface: ${fmt(rest)} mm. Bearing length per hook: ${fmt(bearing)} mm.`);
  const back=freeTravel(p,g,T,seat,-1,p.h+2),fwd=freeTravel(p,g,T,seat,1,p.h+2);
  add(back<p.h-1e-6,'Locked against sliding back (−x)',`Can move ${fmt(back)} mm before the tooth catches (unlocking would need ${fmt(p.h)} mm).`);
  add(fwd<p.h,'Stopped going forward (+x)',`Can move ${fmt(fwd)} mm before stem/tooth hit the slot ends.`);
  const yFront=g.s-g.slotY0,yBack=g.slotY1-(g.s+p.tF);
  add(yFront>0&&yBack>0&&g.slotY0>0,'Front-to-back fit in slots',`Clearance ${fmt(yFront)} mm in front, ${fmt(yBack)} mm behind. Front wall ${fmt(g.slotY0)} mm.`);
  const s0=g.slots[0].main,ob=bbox(offset(frontOutline(p,g),p.k/2)),sb=bbox(offset(rect(s0[0],g.slotY0,s0[1],g.slotY1),-p.k/2));
  const kOK=Math.abs((ob[2]-ob[0])-(p.W+p.k))<1e-6&&Math.abs((sb[2]-sb[0])-(p.w+p.h+2*p.c-p.k))<1e-6;
  add(kOK,'Kerf compensation',`Front cut path ${fmt(ob[2]-ob[0])} mm wide (W + kerf); main slot cut path ${f3(sb[2]-sb[0])} mm long (nominal − kerf).`);
  return R;
}

// ---------- drawings ----------
function annotate(p,g,L,fs){
  const [T,F]=L;
  let o=dimH(T.X(0),T.X(p.W),T.Y(0)+fs*1.6,`W ${fmt(p.W)}`,fs);
  o+=dimV(T.X(0)-fs*1.2,T.Y(p.D),T.Y(0),`D ${fmt(p.D)}`,fs);
  o+=dimH(F.X(0),F.X(p.W),F.Y(-p.H)+fs*1.6,`W ${fmt(p.W)}`,fs);
  o+=dimV(F.X(p.W)+fs*1.2,F.Y(0),F.Y(-p.H),`H ${fmt(p.H)}`,fs,false);
  o+=dimV(F.X(p.W)+fs*1.2,F.Y(g.zHt),F.Y(0),fmt(g.zHt),fs*.8,false);
  if(g.N>1)o+=dimH(F.X(g.xs[0]),F.X(g.xs[1]),F.Y(0)+fs*1.6,`pitch ${fmt(g.pitch)}`,fs*.8,false);
  o+=dimH(F.X(0),F.X(g.xs[0]),F.Y(0)+fs*1.6,fmt(g.xs[0]),fs*.8,false);
  return o;
}
function drawAssembly(p,g){
  const x0=g.xs[0],xL=x0-2*p.h-p.c-4,xR=x0+p.w+p.h+p.c+6,fw=xR-xL;
  const zTop=g.zHt+g.lift+3,zBot=-g.lift-8,fh=zTop-zBot,gapF=fw*.18;
  const fs=fw/16,T=topSolid(p,g),outline=frontOutline(p,g);
  const frames=[
    {pose:[-p.h,0],t:'1  Lift up through slots',arrow:[[x0-p.h-3,-g.lift-5],[x0-p.h-3,0]]},
    {pose:[0,0],t:`2  Slide +x by h (${fmt(p.h)})`,arrow:[[x0-p.h,g.zHt+1.5],[x0+p.w,g.zHt+1.5]]},
    {pose:[0,-g.lift],t:`3  Drop ${fmt(g.lift)}: tooth locks`,arrow:[[x0+p.w+p.h+3,g.zHt+1],[x0+p.w+p.h+3,g.zHt-g.lift-1]]},
  ];
  const sideW=fw*.8,totalW=3*fw+3*gapF+sideW;
  let o=`<svg viewBox="0 ${-fs*.2} ${totalW} ${fh+fs*2.6}" xmlns="http://www.w3.org/2000/svg"><defs>`;
  frames.forEach((_,i)=>o+=`<clipPath id="hj-cf${i}"><rect x="${i*(fw+gapF)}" y="0" width="${fw}" height="${fh}"/></clipPath>`);
  o+=`<clipPath id="hj-cfs"><rect x="${3*(fw+gapF)}" y="0" width="${sideW}" height="${fh}"/></clipPath>`;
  o+=`<marker id="hj-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path class="ah" d="M0 0L10 5L0 10z"/></marker></defs>`;
  frames.forEach((f,i)=>{
    const ox=i*(fw+gapF),X=x=>ox+(x-xL),Y=z=>zTop-z;
    o+=`<g clip-path="url(#hj-cf${i})">`;
    T.forEach(r=>o+=`<rect class="solid" x="${X(r[0])}" y="${Y(r[3])}" width="${r[2]-r[0]}" height="${r[3]-r[1]}"/>`);
    o+=`<path class="solidf" d="${pathOf(outline,x=>X(x+f.pose[0]),z=>Y(z+f.pose[1]))}"/></g>`;
    const [a,b]=f.arrow;
    o+=`<line class="arrow" x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" marker-end="url(#hj-ah)"/>`;
    o+=`<rect class="frame" x="${ox}" y="0" width="${fw}" height="${fh}"/>`;
    o+=`<text class="lbl" x="${ox+fw/2}" y="${fh+fs*1.2}" font-size="${fs*.75}" text-anchor="middle">${f.t}</text>`;
  });
  // side section (y–z) through a finger, seated
  const ox=3*(fw+gapF),X=y=>ox+2+y,Y=z=>zTop-z;
  o+=`<g clip-path="url(#hj-cfs)">`;
  o+=`<path class="solid" d="M${X(0)} ${Y(0)} L${X(g.slotY0)} ${Y(0)} L${X(g.slotY0)} ${Y(p.tT)} L${X(0)} ${Y(p.tT)} Z M${X(g.slotY1)} ${Y(0)} L${X(sideW)} ${Y(0)} L${X(sideW)} ${Y(p.tT)} L${X(g.slotY1)} ${Y(p.tT)} Z"/>`;
  o+=`<path class="solidf" d="M${X(g.s)} ${Y(zBot)} L${X(g.s+p.tF)} ${Y(zBot)} L${X(g.s+p.tF)} ${Y(g.zHt-g.lift)} L${X(g.s)} ${Y(g.zHt-g.lift)} Z"/>`;
  o+=`<path class="lid" d="M${X(g.s+p.tF)} ${Y(zBot)} L${X(g.s+p.tF)} ${Y(0)} L${X(sideW)} ${Y(0)}"/></g>`;
  o+=`<text class="lbl" style="font-weight:400" x="${X(g.s+p.tF+3)}" y="${Y(zBot)-fs*.6}" font-size="${fs*.6}">printer lid</text>`;
  o+=`<rect class="frame" x="${ox}" y="0" width="${sideW}" height="${fh}"/>`;
  o+=`<text class="lbl" x="${ox+sideW/2}" y="${fh+fs*1.2}" font-size="${fs*.75}" text-anchor="middle">Side section (front at left)</text>`;
  return o+'</svg>';
}
function drawDetail(p,g){
  const x0=g.xs[0],xL=x0-p.h-p.c-6,xR=x0+p.w+p.h+p.c+6,span=xR-xL;
  const fs=span/34,P=g.slotY1+6+fs*2.5,G=fs*5.5,body=6;
  const X=x=>x-xL,pY=y=>P-y,eY=z=>P+G+(g.zHt-z);
  const s=g.slots[0];
  let o=`<svg viewBox="${-fs*3} ${-fs} ${span+fs*6} ${P+G+g.zHt+body+fs*4}" xmlns="http://www.w3.org/2000/svg">`;
  // plan of the top panel's front strip
  o+=`<path class="cutp" fill-rule="evenodd" d="${pathOf(rect(xL,0,xR,g.slotY1+6),X,pY)} ${pathOf(rect(s.main[0],g.slotY0,s.main[1],g.slotY1),X,pY)} ${pathOf(rect(s.tooth[0],g.slotY0,s.tooth[1],g.slotY1),X,pY)}"/>`;
  o+=`<text class="lbl" x="0" y="${-fs*.1}" font-size="${fs*.9}">Top panel, plan (front edge at bottom)</text>`;
  o+=dimH(X(s.main[0]),X(s.main[1]),pY(g.slotY1)-fs*.9,`slot ${fmt(s.main[1]-s.main[0])}`,fs*.8);
  o+=dimH(X(s.main[1]),X(s.tooth[0]),pY(g.slotY1)-fs*.9,fmt(g.bridge),fs*.8);
  o+=dimH(X(s.tooth[0]),X(s.tooth[1]),pY(g.slotY1)-fs*.9,fmt(s.tooth[1]-s.tooth[0]),fs*.8);
  o+=dimV(X(s.tooth[1])+fs*1.2,pY(g.slotY1),pY(g.slotY0),fmt(g.slotY1-g.slotY0),fs*.7,false);
  o+=dimV(X(s.main[0])-fs*1.2,pY(g.slotY0),pY(0),`wall ${fmt(p.wall)}`,fs*.7);
  // elevation of the finger
  const fx=[[xL,-body],[xR,-body],[xR,0],[x0+p.w,0],[x0+p.w,g.zHb],[x0+p.w+p.h-p.tw,g.zHb],[x0+p.w+p.h-p.tw,g.zHb-p.th],[x0+p.w+p.h,g.zHb-p.th],[x0+p.w+p.h,g.zHt],[x0,g.zHt],[x0,0],[xL,0]];
  o+=`<path class="cutf" d="${pathOf(clean(fx),X,eY)}"/>`;
  o+=`<text class="lbl" x="0" y="${P+G-fs*2.6}" font-size="${fs*.9}">Front panel finger, elevation (same x scale)</text>`;
  o+=dimH(X(x0),X(x0+p.w),eY(g.zHt)-fs*.9,`w ${fmt(p.w)}`,fs*.8);
  o+=dimH(X(x0+p.w),X(x0+p.w+p.h),eY(g.zHt)-fs*.9,`h ${fmt(p.h)}`,fs*.8);
  o+=dimV(X(x0)-fs*1.2,eY(g.zHt),eY(g.zHb),fmt(p.hk),fs*.7);
  o+=dimV(X(x0)-fs*2.6,eY(g.zHb),eY(0),fmt(g.zHb),fs*.7);
  o+=dimV(X(x0+p.w+p.h)+fs*1.2,eY(g.zHb),eY(g.zHb-p.th),fmt(p.th),fs*.7,false);
  o+=dimH(X(x0+p.w+p.h-p.tw),X(x0+p.w+p.h),eY(g.zHb-p.th)+fs*.9,fmt(p.tw),fs*.7,false);
  return o+'</svg>';
}

LB.register({
  id:'hook-joint',
  name:'Gravity hook joint cover',
  group:'Lids & covers',
  blurb:'Two-panel L cover (top + front) joined by hooked fingers that lift, slide and drop to lock.',
  params:PARAMS,
  build:geom,
  validate,
  parts,
  annotate,
  panels:[
    {title:'Assembly: lift, slide, drop',render:drawAssembly},
    {title:'Joint detail (finger 1, nominal sizes)',render:drawDetail,maxWidth:720},
  ],
  checks:fitCheck,
  filename:p=>`hook-joint_W${p.W}_D${p.D}_H${p.H}_N${p.N}.svg`,
  help:`<ul>
<li><b>Fit clearance</b> is per side: each slot is the part size + 2 × clearance in both directions.</li>
<li><b>Install:</b> hold the front panel h mm to the left (seen from the front), push the fingers up through the long slots until the panel touches the underside, slide right by h, let it drop. The teeth fall into the small slots and lock it. <b>Remove:</b> lift, slide left, pull down.</li>
<li><b>Front wall:</b> the fingers are in the front panel's plane, so a closed slot needs material in front of it. The front panel therefore sits (front wall + clearance) behind the top panel's front edge, leaving a small lip.</li>
<li>Seated, the front panel's top edge hangs (tooth height + clearance) below the top panel: that gap is the lift room the tooth needs.</li>
<li>The fit check simulates the section through the front panel's plane (stem, hook, tooth vs. top panel) along the whole install path, plus the front-to-back slot clearances. It doesn't model the printer lid.</li>
</ul>`,
});
})();
