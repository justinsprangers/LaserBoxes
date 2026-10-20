'use strict';
/* Hinged-lid box: an open box plus a lid (top, front and sides; no back) that pivots on two pins
   through the side walls near the top back corner. The side walls' top-back corners are rounded
   about the pivot and the back wall is lower, so the lid can swing up to about 90°. */
(()=>{
const J=LB.joints,{rect,fmt}=LB;

function make(p){
  const t=p.t,c=p.c,fw=p.fw*t,d=J.boxDims(p,false),{X,Y,Z}=d;
  const r=t+p.pd/2+1.5;                                 // pivot: r in from the back face and down from the top
  const Yp=Y-r,Zp=Z-r;
  const pin=(u,v)=>({circle:[u,v,p.pd/2],free:true});
  const base=J.boxParts(X,Y,Z,t,fw,{top:false,play:p.play,h:{back:Zp},gname:'box',em:p.em,engrave:['front','left','right'],
    holes:{left:[pin(Yp,Zp)],right:[pin(Yp,Zp)]}});
  const sideBody=J.roundCorner(rect(0,0,Y,Z),[Y,Z],[Yp,Zp],[Y,Zp],[Yp,Z]);
  for(const s of base)if(s.name==='left'||s.name==='right'){
    s.outline=J.roundCorner(s.outline,[Y,Z],[Yp,Zp],[Y,Zp],[Yp,Z]);
    s.place.envPoly=sideBody;
  }
  const LX=X+2*c+2*t,LY=Y+c+t,LZ=p.lh+t;
  const lid=J.boxParts(LX,LY,LZ,t,fw,{top:false,omit:['back'],play:p.play,prefix:'LID ',g:1,gname:'lid',em:p.em,engrave:['bottom'],
    holes:{left:[pin(Yp+t+c,t+r)],right:[pin(Yp+t+c,t+r)]},
    tf:P=>[P[0]-t-c,P[1]-t-c,Z+t-P[2]]});
  return {...d,r,Yp,Zp,LX,LY,LZ,sideBody,parts:[...base,...lid]};
}

// Swing the lid about the pins (side section, y-z) and find how far it opens before it hits
// the box's sides, back or front.
function swing(p,g){
  const t=p.t,c=p.c,{Y,Z,Yp,Zp}=g;
  const lidRects=[[-(t+c),Z,Y,Z+t],[-(t+c),Z+t-g.LZ,-c,Z+t]];
  const box=[[Y-t,0,Y,Zp],[0,0,t,Z]];
  const pts=[];
  for(const [y0,z0,y1,z1] of lidRects)
    for(let y=y0+0.137;y<y1;y+=0.5)for(let z=z0+0.113;z<z1;z+=0.5)pts.push([y-Yp,z-Zp]);
  const inside=([y,z])=>J.pip(g.sideBody,y,z)||box.some(b=>y>b[0]&&y<b[2]&&z>b[1]&&z<b[3]);
  let max=0;
  for(let deg=0;deg<=120;deg++){
    const a=deg*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
    if(pts.some(([dy,dz])=>inside([Yp+dy*cs+dz*sn,Zp-dy*sn+dz*cs])))break;
    max=deg;
  }
  return max;
}

LB.register({
  id:'hinged-lid-box',
  name:'Hinged-lid box',
  group:'Boxes',
  blurb:'Box with a lid that pivots on two pins through the side walls and opens to about 90°.',
  params:[...J.boxParams({x:100,y:80,z:50}),
    {id:'lh',label:'Lid depth (inside)',def:25,step:1,group:'Lid',pos:true,help:'How far the lid reaches down over the box.'},
    {id:'c',label:'Lid clearance (per side)',def:0.5,step:0.1,group:'Lid',min:0},
    {id:'pd',label:'Pin diameter',def:3,step:0.1,group:'Lid',pos:true,help:'Hole size for the pins (e.g. 3 mm rod, M3 bolt, 1.75 mm filament).'}],
  build:J.withCheckParts(make),
  validate(p,g){
    const v=J.boxValidate(p,g,false),t=p.t;
    if(p.lh<g.r+p.pd/2+1)v.errors.push(`Lid is too shallow for the pin: at least ${fmt(g.r+p.pd/2+1)} mm.`);
    else if(J.fingerSegs(g.LZ,t,p.fw*t).n<3)v.warnings.push('The lid\'s short edges get only one finger. Make the lid deeper or the fingers narrower.');
    if(g.Zp<2*t+p.fw*t)v.errors.push('The box is too short for the lowered back wall.');
    v.info.push(`Pins go ${fmt(g.r)} mm in from the back and down from the top. Closed, there's a ${fmt(g.r)} mm gap along the top of the back wall: that's what lets the lid swing.`);
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view (closed)',render:(p,g)=>J.view3d(g.parts)}],
  checks(p,g){
    const deg=swing(p,g);
    return [...J.boxChecks(p,g.checkParts),J.fingerCheck(p,[g.X,g.Y,g.Zp,g.LX,g.LY,g.LZ]),
      {ok:deg>=85,name:'Lid swings open',detail:`Rotating about the pins, the lid opens ${deg}° before touching the box${deg>=85?' (it rests on the back wall)':''}.`}];
  },
  filename:p=>`hinged-lid-box_${p.x}x${p.y}x${p.z}.svg`,
  help:`<ul>
<li>Pins: short lengths of rod, M3 bolts, or 1.75 mm filament through the lid side and box side on each end. Glue or cap them on the outside.</li>
<li>The lid has no back panel, and the box's back wall is lower than its sides, so the lid can swing back.</li>
</ul>`,
});
})();
