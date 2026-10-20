'use strict';
/* Flex box: rounded-corner box whose wall is one strip with living-hinge corners.
   The wall sits between a top and bottom plate, set in by t, with tabs on its straight runs
   going through slots in the plates. The strip's two ends meet in the middle of the back. */
(()=>{
const J=LB.joints,{rect,fmt}=LB;

// Wall centreline: inset 1.5 t from the plate edge, starting mid-back, clockwise seen from above.
function centreline(p){
  const t=p.t,cx=p.x/2,cy=p.y/2,ax=cx-1.5*t,ay=cy-1.5*t,rc=p.r-1.5*t,lx=ax-rc,ly=ay-rc;
  const segs=[];let s=0;
  const line=(x0,y0,x1,y1)=>{const L=Math.hypot(x1-x0,y1-y0);if(L>1e-9)segs.push({line:true,s0:s,s1:s+L,x0,y0,x1,y1,L});s+=L;};
  const arc=()=>{const L=Math.PI/2*rc;segs.push({line:false,s0:s,s1:s+L,L});s+=L;};
  line(cx,cy+ay,cx+lx,cy+ay);arc();
  line(cx+ax,cy+ly,cx+ax,cy-ly);arc();
  line(cx+lx,cy-ay,cx-lx,cy-ay);arc();
  line(cx-ax,cy-ly,cx-ax,cy+ly);arc();
  line(cx-lx,cy+ay,cx,cy+ay);
  return {segs,L:s,rc};
}
function build(p){
  const t=p.t,tabw=p.fw*t,h=p.z-2*t,C=centreline(p);
  const tabs=[],slots=[],hinge=[],cuts=[];
  for(const sg of C.segs){
    if(!sg.line){
      const a=sg.s0-1,b=sg.s1+1;
      hinge.push([a,b]);
      cuts.push(...J.hingeCuts(a,b,0,h,p));
      continue;
    }
    const k=sg.L<1.5*tabw?0:Math.max(1,Math.floor(sg.L/(3*tabw)));
    for(let i=0;i<k;i++){
      const c=sg.s0+(i+0.5)*sg.L/k,a=c-tabw/2,b=c+tabw/2;
      tabs.push([a,b]);
      const P=s=>{const f=(s-sg.s0)/sg.L;return [sg.x0+(sg.x1-sg.x0)*f,sg.y0+(sg.y1-sg.y0)*f];};
      const [A,B]=[P(a),P(b)];
      slots.push(sg.y0===sg.y1
        ?rect(Math.min(A[0],B[0]),A[1]-t/2,Math.max(A[0],B[0]),A[1]+t/2)
        :rect(A[0]-t/2,Math.min(A[1],B[1]),A[0]+t/2,Math.max(A[1],B[1])));
    }
  }
  const front=C.segs.filter(s=>s.line)[2];
  const plate=label=>({label,outline:J.roundedRect(0,0,p.x,p.y,p.r),holes:slots.map(s=>J.widen(s,p.play)),engrave:label==='TOP'?[[p.em,p.em,p.x-p.em,p.y-p.em]]:[]});
  const parts=[
    {label:'WALL STRIP',outline:J.bumpRect(0,0,C.L,h,{b:tabs.map(([a,b])=>[a,b,t]),t:tabs.map(([a,b])=>[a,b,t])}),cuts,
     engrave:front?[[front.s0+p.em,p.em,front.s1-p.em,h-p.em]]:[]},
    plate('TOP'),plate('BOTTOM'),
  ];
  return {C,h,tabs,hinge,parts};
}

LB.register({
  id:'flex-box',
  name:'Flex box',
  group:'Boxes',
  blurb:'Rounded-corner box: one wall strip with living-hinge corners between two plates.',
  experimental:'Experimental: the hinge pattern hasn\'t been test-cut yet. Try one corner on scrap first.',
  params:[
    {id:'x',label:'Outside width (x)',def:100,step:1,group:'Box',pos:true},
    {id:'y',label:'Outside depth (y)',def:70,step:1,group:'Box',pos:true},
    {id:'z',label:'Outside height (z)',def:50,step:1,group:'Box',pos:true},
    {id:'r',label:'Corner radius',def:20,step:1,group:'Box',pos:true},
    {id:'t',label:'Material thickness',def:3,step:0.1,group:'Material',pos:true},
    {id:'fw',label:'Tab width (× thickness)',def:2,step:0.5,group:'Material',min:1},
    J.playParam(),
    ...J.hingeParams(),
    {id:'em',label:'Engrave inset margin',def:10,step:1,group:'Engrave',min:0},
  ],
  build,
  validate(p,g){
    const E=[],W=[],I=[],t=p.t;
    if(p.r>Math.min(p.x,p.y)/2)E.push(`Corner radius can't be more than half the smaller side (${fmt(Math.min(p.x,p.y)/2)} mm).`);
    if(g.C.rc<2*t)E.push(`Corner radius is too small for the wall to bend: at least ${fmt(3.5*t)} mm.`);
    else if(g.C.rc<15)W.push(`Tight bend (wall radius ${fmt(g.C.rc)} mm). Test the hinge on scrap first, or reduce the slit spacing.`);
    if(g.h<2*p.bw+4)E.push('Box is too short for the hinge pattern.');
    if(E.length)return {errors:E};
    if(g.C.segs.some(s=>s.line&&s.L<1.5*p.fw*t))W.push('A straight side is too short for a tab, so nothing holds the wall there.');
    if(p.eng&&p.em<2*t+1)W.push('The top engrave area overlaps the wall slots; raise the engrave margin.');
    I.push(`Wall strip ${fmt(g.C.L)} × ${fmt(g.h)} mm (plus tabs). Its ends meet in the middle of the back; glue them or add a backing piece.`);
    I.push('Corners are drawn as short straight segments.');
    return {errors:E,warnings:W,info:I};
  },
  parts:(p,g)=>g.parts,
  checks(p,g){
    const inHinge=([a,b])=>g.hinge.some(([c,d])=>b>c&&a<d);
    const clash=g.tabs.filter(inHinge).length;
    const arcs=g.C.segs.filter(s=>!s.line);
    return [
      {ok:g.tabs.length>0,name:'Wall is held by tabs',detail:`${g.tabs.length} tabs top and bottom, each through a matching plate slot.`},
      {ok:clash===0,name:'No tab falls in a hinge zone',detail:clash?`${clash} tabs overlap a hinge.`:'Tabs are only on the straight runs.'},
      {ok:arcs.every(s=>g.hinge.some(([c,d])=>c<=s.s0&&d>=s.s1)),name:'Hinge covers every corner bend',detail:`Each bend is ${fmt(arcs[0].L)} mm long; its hinge zone is 1 mm longer at each end.`},
    ];
  },
  filename:p=>`flex-box_${p.x}x${p.y}x${p.z}_r${p.r}.svg`,
  help:`<ul>
<li>Living hinges suit plywood or MDF around 3 mm; acrylic usually cracks.</li>
<li>The plates overhang the wall by one thickness. The wall's length is measured along its centre line, where it bends.</li>
</ul>`,
});
})();
