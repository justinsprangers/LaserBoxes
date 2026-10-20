'use strict';
/* Shared helpers for joint and box generators (LB.joints): finger-jointed panels, tabbed plates,
   rounded rectangles, living hinges, an assembled 3D view, and a coverage check that proves
   the parts interlock.

   3D placement: a part may carry place = {n, lo, hi, u, v, env, g, tf}. Its material fills
   lo..hi along axis n (0 = x, 1 = y, 2 = z); its 2D coordinates (u, v) are those 3D axes, in
   box coordinates (x right, y from the front to the back, z up). env = [u0, v0, u1, v1] is the
   part's body without joints, g groups parts that assemble together, tf maps a 3D point for
   the assembled view only (e.g. to show a lid above its box). */
(()=>{
const {clean,rect,bbox,fmt,f3}=LB;

// ---------- finger joints ----------
// The middle of an edge of length L (a t-wide corner at each end) splits into an odd number
// of equal fingers of about fw.
function fingerSegs(L,t,fw){
  let n=Math.floor((L-2*t)/fw);
  if(n%2===0)n--;
  n=Math.max(1,n);
  return {n,s:(L-2*t)/n};
}
// W x H panel at outer size. edges = [bottom, right, top, left] (sides run counter-clockwise):
//   'F' keeps the 1st, 3rd, ... fingers, 'f' keeps the others (its mate is 'F'),
//   'e' is a plain edge, 'n' is cut back by t along its whole middle.
//   An edge can also be a list of spans [{len, type, c0, c1, swap}] in the side's direction, for
//   an edge that's only partly joined. Where a joined span meets another span, a t-long end zone
//   is kept (c0 / c1 true) or cut back (false). On an 'e' or 'n' span, swap = [[from, to], ...]
//   (positions along the side) flips the depth there: a notch in 'e', a tab in 'n'.
// corners = [bottom-left, bottom-right, top-right, top-left]: true keeps the t x t corner.
// play narrows each kept finger: play/2 per face against another finger, play against a
// corner or end zone, so every contact face gets a play-wide gap.
function fingerPanel(W,H,t,fw,edges,corners,play=0){
  const sides=[
    {o:[0,0],d:[1,0],n:[0,1],L:W},
    {o:[W,0],d:[0,1],n:[-1,0],L:H},
    {o:[W,H],d:[-1,0],n:[0,-1],L:W},
    {o:[0,H],d:[0,-1],n:[1,0],L:H}];
  const at=(sd,pos,dep)=>[sd.o[0]+sd.d[0]*pos+sd.n[0]*dep,sd.o[1]+sd.d[1]*pos+sd.n[1]*dep];
  const pts=[];
  sides.forEach((sd,i)=>{
    const L=sd.L,spec=typeof edges[i]==='string'?[{len:L,type:edges[i]}]:edges[i];
    const segs=[{a:0,b:t,d:corners[i]?0:t,corner:'start'}];
    let pos=0;
    spec.forEach((sp,k)=>{
      const a=pos,b=pos+sp.len;pos=b;
      let m0=k===0?t:a,m1=k===spec.length-1?L-t:b;
      if(sp.type==='e'||sp.type==='n'){
        const d=sp.type==='e'?0:t;let x=m0;
        for(const [sa,sb] of (sp.swap||[]).slice().sort((p,q)=>p[0]-q[0])){segs.push({a:x,b:sa,d},{a:sa,b:sb,d:t-d});x=sb;}
        segs.push({a:x,b:m1,d});return;
      }
      if(k>0){segs.push({a,b:a+t,d:sp.c0?0:t});m0=a+t;}
      const tail=k<spec.length-1?{a:b-t,b,d:sp.c1?0:t}:null;
      if(tail)m1=b-t;
      const {n,s}=fingerSegs(m1-m0+2*t,t,fw);
      for(let j=0;j<n;j++)segs.push({a:m0+j*s,b:m0+(j+1)*s,d:(sp.type==='F')===(j%2===0)?0:t,fing:true});
      if(tail)segs.push(tail);
    });
    segs.push({a:L-t,b:L,d:corners[(i+1)%4]?0:t,corner:'end'});
    if(play>0)segs.forEach((g,j)=>{
      if(!g.fing||g.d)return;
      const pv=segs[j-1],nx=segs[j+1];
      if(pv.d){g.a+=pv.fing?play/2:play;pv.b=g.a;}
      if(nx.d){g.b-=nx.fing?play/2:play;nx.a=g.b;}
    });
    for(const g of segs){
      if(g.corner&&g.d){ // a corner that isn't kept: just its inside point (plus any widening)
        if(g.corner==='start')pts.push(at(sd,t,t),at(sd,g.b,t));
        else pts.push(at(sd,g.a,t),at(sd,L-t,t));
      }
      else pts.push(at(sd,g.a,g.d),at(sd,g.b,g.d));
    }
  });
  return clean(pts);
}
// Replace the polygon vertex at `corner` with an arc around `centre` from point `from` (on the
// incoming edge) to `to` (on the outgoing edge). dir: 0 = the short way round, 1 = counter-
// clockwise, -1 = clockwise. Used to round a corner, cut a clearance arc, or add a knob.
function roundCorner(P,corner,centre,from,to,dir=0,n=24){
  const i=P.findIndex(v=>Math.abs(v[0]-corner[0])<1e-6&&Math.abs(v[1]-corner[1])<1e-6);
  if(i<0)return P;
  const r=Math.hypot(from[0]-centre[0],from[1]-centre[1]),TAU=2*Math.PI;
  const a0=Math.atan2(from[1]-centre[1],from[0]-centre[0]),a1=Math.atan2(to[1]-centre[1],to[0]-centre[0]);
  let sw=((a1-a0)%TAU+TAU)%TAU;                                     // counter-clockwise sweep
  if(dir===-1||(dir===0&&sw>Math.PI))sw-=TAU;
  const arc=[];
  for(let j=0;j<=n;j++){const a=a0+sw*j/n;arc.push([centre[0]+r*Math.cos(a),centre[1]+r*Math.sin(a)]);}
  return clean([...P.slice(0,i),...arc,...P.slice(i+1)]);
}
// Keep the part of polygon P where a*x + b*y + c >= 0 (P may be concave; the line should
// cross it at most twice).
function clipHalf(P,a,b,c){
  const f=v=>a*v[0]+b*v[1]+c,out=[];
  for(let i=0;i<P.length;i++){
    const A=P[i],B=P[(i+1)%P.length],fa=f(A),fb=f(B);
    if(fa>=0)out.push(A);
    if((fa>=0)!==(fb>=0)){const s=fa/(fa-fb);out.push([A[0]+(B[0]-A[0])*s,A[1]+(B[1]-A[1])*s]);}
  }
  return clean(out);
}
// Grow a slot polygon by play/2 on every side (circles and free holes are left alone).
const widen=(h,play)=>play>0&&!h.circle?LB.offset(h,play/2):h;
// Rectangle with tabs (d > 0, outward) and notches (d < 0) on its sides.
// bumps = {b, r, t, l}: lists of [from, to, d], positions in absolute x (b, t) or y (r, l).
function bumpRect(x0,y0,x1,y1,bumps){
  const B=k=>(bumps[k]||[]).slice().sort((p,q)=>p[0]-q[0]);
  const pts=[[x0,y0]];
  for(const [a,c,d] of B('b'))pts.push([a,y0],[a,y0-d],[c,y0-d],[c,y0]);
  pts.push([x1,y0]);
  for(const [a,c,d] of B('r'))pts.push([x1,a],[x1+d,a],[x1+d,c],[x1,c]);
  pts.push([x1,y1]);
  for(const [a,c,d] of B('t').reverse())pts.push([c,y1],[c,y1+d],[a,y1+d],[a,y1]);
  pts.push([x0,y1]);
  for(const [a,c,d] of B('l').reverse())pts.push([x0,c],[x0-d,c],[x0-d,a],[x0,a]);
  return clean(pts);
}
// Rounded rectangle; arcs are approximated by short segments.
function roundedRect(x0,y0,x1,y1,r){
  if(!(r>0))return rect(x0,y0,x1,y1);
  const n=Math.min(24,Math.max(4,Math.ceil(r/1.5))),pts=[];
  const C=[[x1-r,y0+r,-90],[x1-r,y1-r,0],[x0+r,y1-r,90],[x0+r,y0+r,180]];
  for(const [cx,cy,a0] of C)for(let i=0;i<=n;i++){const a=(a0+90*i/n)*Math.PI/180;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  return clean(pts);
}
const circlePoly=(cx,cy,r,n=32)=>Array.from({length:n},(_,i)=>[cx+r*Math.cos(2*Math.PI*i/n),cy+r*Math.sin(2*Math.PI*i/n)]);

// ---------- living hinge ----------
// Straight-line lattice over x0..x1: vertical slits every sp. Even columns are m closed slits
// with bw bridges; odd columns run off both edges with bridges centred on the even slits.
function hingeCuts(x0,x1,y0,y1,{cl,bw,sp}){
  const H=y1-y0,m=Math.max(1,Math.round((H-bw)/(cl+bw))),ca=(H-(m+1)*bw)/m,ext=0.5,out=[];
  if(!(ca>0)||!(sp>0))return out;
  let i=0;
  for(let x=x0+sp/2;x<=x1-sp/2+1e-9;x+=sp,i++){
    if(i%2===0)for(let j=0;j<m;j++){const a=y0+bw+j*(ca+bw);out.push([[x,a],[x,a+ca]]);}
    else{
      let a=y0-ext;
      for(let j=0;j<m;j++){const c=y0+bw+ca/2+j*(ca+bw);out.push([[x,a],[x,c-bw/2]]);a=c+bw/2;}
      out.push([[x,a],[x,y1+ext]]);
    }
  }
  return out;
}

const hingeParams=()=>[
  {id:'cl',label:'Slit length',def:15,step:1,group:'Living hinge',pos:true},
  {id:'bw',label:'Bridge between slits',def:3,step:0.5,group:'Living hinge',pos:true},
  {id:'sp',label:'Slit spacing',def:2,step:0.1,group:'Living hinge',pos:true,help:'Smaller bends tighter but is more fragile.'},
];

// ---------- boxes ----------
function boxParams(d){
  return [
    {id:'x',label:'Width (x)',def:d.x,step:1,group:'Box',pos:true},
    {id:'y',label:'Depth (y)',def:d.y,step:1,group:'Box',pos:true},
    {id:'z',label:'Height (z)',def:d.z,step:1,group:'Box',pos:true},
    {id:'outside',label:'Sizes are outside dimensions',def:false,type:'bool',group:'Box',help:'Off: sizes are the inside of the box.'},
    {id:'t',label:'Material thickness',def:3,step:0.1,group:'Material',pos:true},
    {id:'fw',label:'Finger width (× thickness)',def:2,step:0.5,group:'Material',min:1},
    playParam(),
    {id:'em',label:'Engrave inset margin',def:10,step:1,group:'Engrave',min:0},
  ];
}
const playParam=()=>({id:'play',label:'Joint clearance',def:0,step:0.05,group:'Material',min:0,
  help:'Gap per contact face in joints and slots. 0 = press fit. Try 0.05–0.1 mm for acrylic.'});
// Build twice when there's joint clearance: the fit check runs on the zero-clearance geometry,
// where every joint face must touch exactly.
const withCheckParts=make=>p=>{const g=make(p);g.checkParts=p.play>0?make({...p,play:0}).parts:g.parts;return g;};
// Outer size from the entered size. A box without a top has one thickness less in height.
function boxDims(p,top){
  const t=p.t;
  return p.outside?{X:p.x,Y:p.y,Z:p.z}:{X:p.x+2*t,Y:p.y+2*t,Z:p.z+(top?2:1)*t};
}
// Finger-jointed box with outer size X x Y x Z. Corner cubes belong to the front and back.
// o: {top, prefix, g, gname, tf, play, holes: {front: [...], ...}, engrave: [face names], em,
//     h: {front, back} (shorter front/back walls; open-top boxes only), omit: ['back']}
function boxParts(X,Y,Z,t,fw,o={}){
  const top=o.top!==false,te=top?'f':'e',all=[1,1,1,1],none=[0,0,0,0];
  const Zf=(o.h&&o.h.front)||Z,Zb=(o.h&&o.h.back)||Z,noBack=(o.omit||[]).includes('back');
  // Side panels: right side runs up the back edge, left side runs down the front edge.
  const sideBack=noBack?'e':Zb<Z?[{len:Zb,type:'f',c1:false},{len:Z-Zb,type:'e'}]:'f';
  const sideFront=Zf<Z?[{len:Z-Zf,type:'e'},{len:Zf,type:'f',c0:false}]:'f';
  const sideC=[0,noBack?1:0,noBack||Zb<Z?1:0,Zf<Z?1:0];
  const defs=[
    ['front',X,Zf,['f','F',top&&Zf===Z?'f':'e','F'],all,{n:1,lo:0,hi:t,u:0,v:2}],
    ['back',X,Zb,['f','F',top&&Zb===Z?'f':'e','F'],all,{n:1,lo:Y-t,hi:Y,u:0,v:2}],
    ['left',Y,Z,['f',sideBack,te,sideFront],sideC,{n:0,lo:0,hi:t,u:1,v:2}],
    ['right',Y,Z,['f',sideBack,te,sideFront],sideC,{n:0,lo:X-t,hi:X,u:1,v:2}],
    ['bottom',X,Y,['F','F',noBack?'e':'F','F'],none,{n:2,lo:0,hi:t,u:0,v:1}],
  ].filter(d=>!(noBack&&d[0]==='back'));
  if(top)defs.push(['top',X,Y,['F','F','F','F'],none,{n:2,lo:Z-t,hi:Z,u:0,v:1}]);
  const eng=o.engrave||[],em=o.em||0;
  return defs.map(([name,W,H,e,c,pl])=>({
    name,label:(o.prefix||'')+name.toUpperCase(),
    outline:fingerPanel(W,H,t,fw,e,c.map(Boolean),o.play||0),
    holes:((o.holes&&o.holes[name])||[]).map(h=>widen(h,o.play||0)),
    engrave:eng.includes(name)?[[em,em,W-em,H-em]]:[],
    place:{...pl,env:[0,0,W,H],g:o.g||0,gname:o.gname,tf:o.tf},
  }));
}
function boxValidate(p,g,top){
  const E=[],Wn=[],I=[],t=p.t,fw=p.fw*t;
  const need=2*t+fw;
  [['Width',g.X],['Depth',g.Y],['Height',g.Z]].forEach(([n,L])=>{
    if(L<need)E.push(`${n} is too small: the outside must be at least ${fmt(need)} mm for one finger.`);
    else if(fingerSegs(L,t,fw).n<3)Wn.push(`${n} edges get only one finger, so they won't interlock. Use a smaller finger width or a bigger box.`);
  });
  I.push(`Outside ${fmt(g.X)} × ${fmt(g.Y)} × ${fmt(g.Z)} mm; inside ${fmt(g.X-2*t)} × ${fmt(g.Y-2*t)} × ${fmt(g.Z-(top?2:1)*t)} mm.`);
  return {errors:E,warnings:Wn,info:I};
}

// ---------- coverage check ----------
function pip(P,x,y){
  let c=false;
  for(let i=0,j=P.length-1;i<P.length;j=i++){
    const [xi,yi]=P[i],[xj,yj]=P[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;
  }
  return c;
}
const inShape=(h,u,v)=>h.circle?Math.hypot(u-h.circle[0],v-h.circle[1])<h.circle[2]:pip(h,u,v);
function inPart(part,u,v){
  if(!pip(part.outline,u,v))return false;
  for(const h of part.holes||[])if(inShape(h,u,v))return false;
  return true;
}
// Sample every part's thickness on a grid. A point inside some part's body (env, minus holes
// marked free) must be material of exactly one part; a point outside every body must be empty.
function coverage(parts,t){
  const S=parts.filter(q=>q.place),bbs=S.map(q=>bbox(q.outline));
  const area=bbs.reduce((a,b)=>a+(b[2]-b[0])*(b[3]-b[1]),0);
  const step=Math.max(t/3,Math.sqrt(area/60000));
  const r={samples:0,gaps:0,overlaps:0,stray:0,first:null,step};
  S.forEach((A,ai)=>{
    const bb=bbs[ai],q=A.place,mid=(q.lo+q.hi)/2;
    for(let u=bb[0]+0.3713*step;u<bb[2];u+=step)for(let v=bb[1]+0.2917*step;v<bb[3];v+=step){
      const P=[0,0,0];P[q.n]=mid;P[q.u]=u;P[q.v]=v;
      let cnt=0,env=false;
      for(const B of S){
        const b=B.place,w=P[b.n];
        if(w<=b.lo||w>=b.hi)continue;
        const bu=P[b.u],bv=P[b.v];
        const inBody=b.envPoly?pip(b.envPoly,bu,bv):bu>b.env[0]&&bu<b.env[2]&&bv>b.env[1]&&bv<b.env[3];
        if(inBody&&!(B.holes||[]).some(h=>h.free&&inShape(h,bu,bv)))env=true;
        if(inPart(B,bu,bv))cnt++;
      }
      r.samples++;
      const kind=env&&cnt===0?'gaps':cnt>1?'overlaps':!env&&cnt===1?'stray':null;
      if(kind){r[kind]++;if(!r.first)r.first={kind,P,part:A.label};}
    }
  });
  return r;
}
function boxChecks(p,parts){
  const R=[],placed=parts.filter(q=>q.place);
  const groups=[...new Set(placed.map(q=>q.place.g))].filter(gid=>placed.filter(q=>q.place.g===gid).length>1);
  for(const gid of groups){
    const ps=placed.filter(q=>q.place.g===gid);
    const c=coverage(ps,p.t),ok=!c.gaps&&!c.overlaps&&!c.stray;
    const name=groups.length>1?`Parts interlock (${ps[0].place.gname||'group '+gid})`:'Parts interlock';
    R.push({ok,name,detail:ok
      ?`${c.samples.toLocaleString()} points sampled through every part's thickness (every ${fmt(c.step)} mm): each is filled by exactly one part, with no gaps and nothing sticking out.`
      :`${c.gaps} gaps, ${c.overlaps} overlaps, ${c.stray} points sticking out. First: ${c.first.kind} at x ${fmt(c.first.P[0])}, y ${fmt(c.first.P[1])}, z ${fmt(c.first.P[2])} (sampling ${c.first.part}).`});
  }
  if(p.play>0)R.push({ok:true,name:'Joint clearance',detail:`Fingers and slots leave ${fmt(p.play)} mm per contact face. The interlock check uses the zero-clearance geometry, where every face must touch exactly.`});
  return R;
}
// Swing the moving parts (e.g. a lid) about an axis parallel to x through (y, z) = axis, opening
// so the front rises. Samples points through each moving part's thickness and returns the
// largest angle (degrees, in steps) reached before any point enters a fixed part; -1 if they
// already collide when closed.
function swing3d(moving,fixed,axis,{max=180,step=2,grid=3}={}){
  const pts=[];
  for(const A of moving.filter(q=>q.place)){
    const q=A.place,bb=bbox(A.outline),tf=q.tf||(P=>P),uv=[];
    for(let u=bb[0]+0.31*grid;u<bb[2];u+=grid)for(let v=bb[1]+0.27*grid;v<bb[3];v+=grid)uv.push([u,v]);
    // Plus points along the outline, just inside it, so small features (tabs, corners) count.
    const O=LB.area(A.outline)>0?A.outline:A.outline.slice().reverse();
    O.forEach((a,i)=>{
      const b=O[(i+1)%O.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),nu=-(b[1]-a[1])/L*0.02,nv=(b[0]-a[0])/L*0.02;
      for(let s=0;s<L;s+=0.75)uv.push([a[0]+(b[0]-a[0])*s/L+nu,a[1]+(b[1]-a[1])*s/L+nv]);
    });
    // Depths: just inside both faces and the middle.
    for(const w of [q.lo+0.02,(q.lo+q.hi)/2,q.hi-0.02])
      for(const [u,v] of uv)if(inPart(A,u,v)){const P=[0,0,0];P[q.n]=w;P[q.u]=u;P[q.v]=v;pts.push(tf(P));}
  }
  // Fixed parts with a 3D bounding box, to skip the polygon test for far-away points.
  const F=fixed.filter(q=>q.place).map(B=>{
    const b=B.place,bb=bbox(B.outline),lo=[0,0,0],hi=[0,0,0];
    lo[b.n]=b.lo;hi[b.n]=b.hi;lo[b.u]=bb[0];hi[b.u]=bb[2];lo[b.v]=bb[1];hi[b.v]=bb[3];
    return {B,b,lo,hi};
  });
  const hit=P=>F.some(({B,b,lo,hi})=>P[0]>lo[0]&&P[0]<hi[0]&&P[1]>lo[1]&&P[1]<hi[1]&&P[2]>lo[2]&&P[2]<hi[2]&&inPart(B,P[b.u],P[b.v]));
  let ok=-1;
  for(let deg=0;deg<=max;deg+=step){
    const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    if(pts.some(P=>{const dy=P[1]-axis[0],dz=P[2]-axis[1];return hit([P[0],axis[0]+dy*c+dz*s,axis[1]-dy*s+dz*c]);}))break;
    ok=deg;
  }
  return ok;
}
function fingerCheck(p,lengths){
  const ns=lengths.map(L=>fingerSegs(L,p.t,p.fw*p.t).n),n=Math.min(...ns);
  return {ok:n>=3,name:'Every edge has at least 3 fingers',detail:`Fewest fingers on an edge: ${n}.`};
}

// ---------- assembled view ----------
// Oblique projection from the front, right and above. drawFaces draws flat 3D polygons in the
// order given: faces = [{rings: [[[x,y,z], ...], ...], cls}] (first ring outline, rest holes).
const proj=P=>[P[0]+0.45*P[1],-P[2]-0.3*P[1]];
const depth=P=>-0.45*P[0]+P[1]-0.3*P[2];                             // larger = farther away
function drawFaces(faces){
  const all=faces.flatMap(f=>f.rings[0].map(proj));
  const bb=bbox(all),pad=Math.max(bb[2]-bb[0],bb[3]-bb[1])*0.04;
  const d=f=>f.rings.map(r=>'M'+r.map(P=>proj(P).map(f3).join(' ')).join(' L')+' Z').join(' ');
  return `<svg viewBox="${bb[0]-pad} ${bb[1]-pad} ${bb[2]-bb[0]+2*pad} ${bb[3]-bb[1]+2*pad}" style="max-height:420px" xmlns="http://www.w3.org/2000/svg">`+
    faces.map(f=>`<path class="${f.cls||'solid'}" fill-rule="evenodd" d="${d(f)}"/>`).join('')+'</svg>';
}
// Each placed part's visible face, drawn as a flat polygon: bottoms first, tops last, walls
// back to front, group by group. The facing axis is taken after tf, so rotated views work.
function view3d(parts){
  const faces=parts.filter(q=>q.place).map(A=>{
    const q=A.place,tf=q.tf||(P=>P),w=q.n===1?q.lo:q.hi;
    const to3=([u,v])=>{const P=[0,0,0];P[q.n]=w;P[q.u]=u;P[q.v]=v;return tf(P);};
    const rings=[A.outline,...(A.holes||[]).map(h=>h.circle?circlePoly(...h.circle):h)].map(r=>r.map(to3));
    const c=rings[0].reduce((s,P)=>s.map((x,i)=>x+P[i]/rings[0].length),[0,0,0]);
    const span=[0,1,2].map(i=>{const v=rings[0].map(P=>P[i]);return Math.max(...v)-Math.min(...v);});
    return {rings,c,n:span.indexOf(Math.min(...span)),g:q.g||0};
  });
  const zs=faces.map(f=>f.c[2]),zMid=(Math.min(...zs)+Math.max(...zs))/2;
  const key=f=>f.g*1e7+(f.n===2?(f.c[2]<zMid?-1e6:1e6)+f.c[2]:-depth(f.c));
  faces.sort((a,b)=>key(a)-key(b));
  return drawFaces(faces.map(f=>({rings:f.rings,cls:f.n===2?'solidf':'solid'})));
}

// ---------- grid of compartments (divider tray, shelf) ----------
// Open box (outer X x Y x Z from p) split into p.nx x p.ny equal compartments by dividers that
// cross with half-height slots and tab through slots in the walls and bottom.
function gridBox(p,o={}){
  const d=boxDims(p,false),{X,Y,Z}=d,t=p.t,nx=p.nx,ny=p.ny;
  const hd=Z-t-(p.dh||0);                               // divider height above the bottom
  const cwx=(X-2*t-(nx-1)*t)/nx,cwy=(Y-2*t-(ny-1)*t)/ny; // compartment sizes
  const xc=[],yc=[];                                    // divider centres
  for(let j=1;j<nx;j++)xc.push(t+j*cwx+(j-0.5)*t);
  for(let j=1;j<ny;j++)yc.push(t+j*cwy+(j-0.5)*t);
  const tz0=t+hd*0.3,tz1=t+hd*0.7;                      // end tabs into the walls
  // Bottom tabs: one per stretch between crossings, middle 40%.
  const tabs=(from,to,cross)=>{
    const ends=[from,...cross.flatMap(c=>[c-t/2,c+t/2]),to],out=[];
    for(let i=0;i<ends.length;i+=2){const a=ends[i],b=ends[i+1],m=(a+b)/2,w=(b-a)*0.4;out.push([m-w/2,m+w/2]);}
    return out;
  };
  const xt=tabs(t,X-t,xc),yt=tabs(t,Y-t,yc);
  const holes={front:[],back:[],left:[],right:[],bottom:[...(o.bottomHoles||[])]};
  for(const x of xc){holes.front.push(rect(x-t/2,tz0,x+t/2,tz1));holes.back.push(rect(x-t/2,tz0,x+t/2,tz1));}
  for(const y of yc){holes.left.push(rect(y-t/2,tz0,y+t/2,tz1));holes.right.push(rect(y-t/2,tz0,y+t/2,tz1));}
  for(const y of yc)for(const [a,b] of xt)holes.bottom.push(rect(a,y-t/2,b,y+t/2));
  for(const x of xc)for(const [a,b] of yt)holes.bottom.push(rect(x-t/2,a,x+t/2,b));
  const parts=boxParts(X,Y,Z,t,p.fw*t,{top:false,play:p.play,holes,em:p.em,engrave:o.engrave||['front','back','left','right']});
  // Dividers parallel to the front (slots from the top) and to the sides (slots from the bottom).
  const hw=(t+p.play)/2;                                // half width of a crossing slot
  yc.forEach((y,i)=>parts.push({name:'divx',label:`DIVIDER X${i+1}`,
    outline:bumpRect(t,t,X-t,t+hd,{b:xt.map(([a,b])=>[a,b,t]),r:[[tz0,tz1,t]],l:[[tz0,tz1,t]],t:xc.map(x=>[x-hw,x+hw,-hd/2])}),
    place:{n:1,lo:y-t/2,hi:y+t/2,u:0,v:2,env:[t,t,X-t,t+hd],g:0}}));
  xc.forEach((x,i)=>parts.push({name:'divy',label:`DIVIDER Y${i+1}`,
    outline:bumpRect(t,t,Y-t,t+hd,{b:[...yt.map(([a,b])=>[a,b,t]),...yc.map(y=>[y-hw,y+hw,-hd/2])],r:[[tz0,tz1,t]],l:[[tz0,tz1,t]]}),
    place:{n:0,lo:x-t/2,hi:x+t/2,u:1,v:2,env:[t,t,Y-t,t+hd],g:0}}));
  return {...d,hd,cwx,cwy,xc,yc,parts};
}

LB.joints={fingerSegs,fingerPanel,bumpRect,roundedRect,roundCorner,clipHalf,circlePoly,hingeCuts,hingeParams,widen,
  boxParams,playParam,withCheckParts,boxDims,boxParts,boxValidate,boxChecks,fingerCheck,gridBox,
  coverage,swing3d,inPart,view3d,drawFaces,depth,pip};
})();
