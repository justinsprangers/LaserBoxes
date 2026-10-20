'use strict';
/* Polygon box: a regular n-sided box. Rectangular walls stand on a polygon bottom (and under an
   optional polygon top), held by tabs through slots near the plate edges. Walls meet at their
   inside corners; square-cut ends leave a small V gap at each outside corner. */
(()=>{
const J=LB.joints,{fmt}=LB;

function make(p){
  const n=p.n,t=p.t,tw=p.fw*t,h=p.h,top=p.top;
  const a=p.r*Math.cos(Math.PI/n),s=2*p.r*Math.sin(Math.PI/n);        // inner apothem, side
  const ang=i=>-Math.PI/2-Math.PI/n+2*Math.PI*i/n;
  const V=i=>[p.r*Math.cos(ang(i)),p.r*Math.sin(ang(i))];
  const Ro=(a+2*t)/Math.cos(Math.PI/n);                               // plate: overhangs the walls by t
  const plateOutline=Array.from({length:n},(_,i)=>[Ro*Math.cos(ang(i)),Ro*Math.sin(ang(i))]);
  const k=Math.max(1,Math.floor((s-2*tw)/(2*tw)));
  const tabs=Array.from({length:k},(_,j)=>{const c=tw+(j+0.5)*(s-2*tw)/k;return [c-tw/2,c+tw/2];});
  const walls=[],slots=[];
  for(let i=0;i<n;i++){
    const A=V(i),B=V((i+1)%n),e=[(B[0]-A[0])/s,(B[1]-A[1])/s],m=-Math.PI/2+2*Math.PI*i/n,no=[Math.cos(m),Math.sin(m)];
    const at=(u,off)=>[A[0]+e[0]*u+no[0]*off,A[1]+e[1]*u+no[1]*off];
    for(const [ta,tb] of tabs)slots.push(J.widen([at(ta,0),at(tb,0),at(tb,t),at(ta,t)],p.play));
    walls.push({A,e,no});
  }
  const wallOutline=J.bumpRect(0,t,s,t+h,{b:tabs.map(([x0,x1])=>[x0,x1,t]),t:top?tabs.map(([x0,x1])=>[x0,x1,t]):[]});
  const parts=[{label:'BOTTOM',outline:plateOutline,holes:slots}];
  for(let i=0;i<n;i++)parts.push({label:`WALL ${i+1}`,outline:wallOutline,engrave:[[p.em,t+p.em,s-p.em,t+h-p.em]]});
  if(top)parts.push({label:'TOP',outline:plateOutline,holes:slots});
  return {n,a,s,Ro,k,tabs,walls,slots,wallOutline,plateOutline,parts,gap:2*t*Math.tan(Math.PI/n)};
}

// Assembled view: bottom, walls far to near (outer faces), then the top.
function view(p,g){
  const t=p.t,h=p.h,z=(P,zz)=>[P[0],P[1],zz];
  const faces=[{rings:[g.plateOutline.map(P=>z(P,t)),...g.slots.map(r=>r.map(P=>z(P,t)))],cls:'solidf'}];
  const walls=g.walls.map(({A,e,no})=>({rings:[g.wallOutline.map(([u,v])=>[A[0]+e[0]*u+no[0]*t,A[1]+e[1]*u+no[1]*t,v])]}));
  const mid=f=>f.rings[0].reduce((s,P)=>s.map((x,i)=>x+P[i]),[0,0,0]);
  walls.sort((a,b)=>J.depth(mid(b))-J.depth(mid(a)));
  faces.push(...walls.map(f=>({...f,cls:'solid'})));
  if(p.top)faces.push({rings:[g.plateOutline.map(P=>z(P,2*t+h)),...g.slots.map(r=>r.map(P=>z(P,2*t+h)))],cls:'solidf'});
  return J.drawFaces(faces);
}

LB.register({
  id:'polygon-box',
  name:'Polygon box',
  group:'Boxes',
  blurb:'Regular polygon box (3 to 12 sides): walls tab into a polygon bottom and optional top.',
  params:[
    {id:'n',label:'Number of sides',def:6,step:1,group:'Box',type:'int',min:3},
    {id:'r',label:'Inside radius (centre to corner)',def:45,step:1,group:'Box',pos:true},
    {id:'h',label:'Inside height',def:50,step:1,group:'Box',pos:true},
    {id:'top',label:'Fixed top plate',def:false,type:'bool',group:'Box'},
    {id:'t',label:'Material thickness',def:3,step:0.1,group:'Material',pos:true},
    {id:'fw',label:'Tab width (× thickness)',def:2,step:0.5,group:'Material',min:1},
    J.playParam(),
    {id:'em',label:'Engrave inset margin',def:6,step:1,group:'Engrave',min:0},
  ],
  build:make,
  validate(p,g){
    const E=[],W=[],I=[],t=p.t;
    if(p.n>12)E.push('Up to 12 sides.');
    if(g.s<3*p.fw*t)E.push(`Sides are too short for a tab (${fmt(g.s)} mm): use a bigger radius, fewer sides or narrower tabs.`);
    if(p.h<2*t)E.push('Box is too short.');
    I.push(`Each wall is ${fmt(g.s)} × ${fmt(p.h)} mm inside. Plates are ${fmt(2*g.Ro)} mm across the corners.`);
    if(p.n!==4)I.push(`Square-cut walls leave a ${fmt(g.gap)} mm V gap at each outside corner; glue, fill or sand it.`);
    return {errors:E,warnings:W,info:I};
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view',render:view}],
  checks(p,g){
    const ins=(P,Q)=>Q.some(v=>J.pip(P,v[0],v[1]));
    const clash=g.slots.some((A,i)=>g.slots.some((B,j)=>i!==j&&ins(A,B)));
    const inside=g.slots.every(S=>S.every(v=>J.pip(g.plateOutline,v[0],v[1])));
    return [
      {ok:g.slots.length===g.n*g.k,name:'Every wall tab has a slot',detail:`${g.k} tab${g.k>1?'s':''} per wall edge, ${g.slots.length} slots per plate.`},
      {ok:!clash&&inside,name:'Slots are separate and inside the plate',detail:clash?'Two slots overlap near a corner.':inside?`Slots stay ${fmt(p.t)} mm in from the plate edge.`:'A slot breaks out of the plate edge.'},
      {ok:true,name:'Walls meet at the inside corners',detail:p.n===4?'Square box: corners close fully.':`Outside corners have a ${fmt(g.gap)} mm V gap (square-cut walls at ${fmt(360/p.n)}° turns).`},
    ];
  },
  filename:p=>`polygon-box_${p.n}x${p.r}x${p.h}.svg`,
  help:'<ul><li>Glue the walls into the bottom; the tabs locate them. With a fixed top it\'s a closed box (glue all but the top for a lid you can lift off).</li></ul>',
});
})();
