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
//   An edge can also be a list of spans [{len, type, c0, c1}] in the side's direction, for an
//   edge that's only partly joined. Where a joined span meets another span, a t-long end zone
//   is kept (c0 / c1 true) or cut back (false).
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
      if(sp.type==='e'||sp.type==='n'){segs.push({a:m0,b:m1,d:sp.type==='e'?0:t});return;}
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
// incoming edge) to `to` (on the outgoing edge), the short way round. Used to round a panel
// corner so a hinged lid can swing past it.
function roundCorner(P,corner,centre,from,to,n=16){
  const i=P.findIndex(v=>Math.abs(v[0]-corner[0])<1e-6&&Math.abs(v[1]-corner[1])<1e-6);
  if(i<0)return P;
  const r=Math.hypot(from[0]-centre[0],from[1]-centre[1]);
  const a0=Math.atan2(from[1]-centre[1],from[0]-centre[0]),a1=Math.atan2(to[1]-centre[1],to[0]-centre[0]);
  let sw=a1-a0;
  while(sw>Math.PI)sw-=2*Math.PI;
  while(sw<-Math.PI)sw+=2*Math.PI;
  const arc=[];
  for(let j=0;j<=n;j++){const a=a0+sw*j/n;arc.push([centre[0]+r*Math.cos(a),centre[1]+r*Math.sin(a)]);}
  return clean([...P.slice(0,i),...arc,...P.slice(i+1)]);
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
function fingerCheck(p,lengths){
  const ns=lengths.map(L=>fingerSegs(L,p.t,p.fw*p.t).n),n=Math.min(...ns);
  return {ok:n>=3,name:'Every edge has at least 3 fingers',detail:`Fewest fingers on an edge: ${n}.`};
}

// ---------- assembled view ----------
// Oblique projection from the front, right and above. Each part's visible face is drawn
// as a flat polygon; bottoms first, tops last, walls back to front.
function view3d(parts){
  const S=parts.filter(q=>q.place);
  const proj=P=>[P[0]+0.45*P[1],-P[2]-0.3*P[1]];
  const faces=S.map(A=>{
    const q=A.place,tf=q.tf||(P=>P),w=q.n===1?q.lo:q.hi;
    const to3=([u,v])=>{const P=[0,0,0];P[q.n]=w;P[q.u]=u;P[q.v]=v;return tf(P);};
    const rings=[A.outline,...(A.holes||[]).map(h=>h.circle?circlePoly(...h.circle):h)].map(r=>r.map(to3));
    const c=rings[0].reduce((s,P)=>s.map((x,i)=>x+P[i]/rings[0].length),[0,0,0]);
    return {rings,c,n:q.n,g:q.g||0};
  });
  const zs=faces.map(f=>f.c[2]),zMid=(Math.min(...zs)+Math.max(...zs))/2;
  const key=f=>f.g*1e7+(f.n===2?(f.c[2]<zMid?-1e6:1e6)+f.c[2]:-(-0.45*f.c[0]+f.c[1]-0.3*f.c[2]));
  faces.sort((a,b)=>key(a)-key(b));
  const all=faces.flatMap(f=>f.rings[0].map(proj));
  const bb=bbox(all),pad=Math.max(bb[2]-bb[0],bb[3]-bb[1])*0.04;
  const d=f=>f.rings.map(r=>'M'+r.map(P=>proj(P).map(f3).join(' ')).join(' L')+' Z').join(' ');
  return `<svg viewBox="${bb[0]-pad} ${bb[1]-pad} ${bb[2]-bb[0]+2*pad} ${bb[3]-bb[1]+2*pad}" style="max-height:420px" xmlns="http://www.w3.org/2000/svg">`+
    faces.map(f=>`<path class="${f.n===2?'solidf':'solid'}" fill-rule="evenodd" d="${d(f)}"/>`).join('')+'</svg>';
}

LB.joints={fingerSegs,fingerPanel,bumpRect,roundedRect,roundCorner,circlePoly,hingeCuts,hingeParams,widen,
  boxParams,playParam,withCheckParts,boxDims,boxParts,boxValidate,boxChecks,fingerCheck,coverage,view3d,pip};
})();
