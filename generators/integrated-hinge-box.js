'use strict';
/* Integrated-hinge box: no extra hinge parts. The box side walls end in round knobs at the top
   back corners, each with a round bore. The lid's back panel carries a square axle tab at each
   end that sits in the bore, so the lid pivots there; the lid's side walls are cut away around
   the knobs. The box back wall is lower so the lid's back panel can drop behind the rim. */
(()=>{
const J=LB.joints,{rect,fmt}=LB;

function make(p){
  const t=p.t,fw=p.fw*t,c=p.hp,d=J.boxDims(p,false),{X,Y,Z}=d;
  const th=t,rb=Math.hypot(t,th)/2+c;                  // axle tab t x th turning in a bore of radius rb
  const R=rb+1.5*t,Rp=R+c;                              // knob radius; lid side cut-out radius
  const Yc=Y-t/2;                                       // pivot: centre of the back wall plane, at the rim
  const Zb=Z-(R+1),Zl=Zb+c;                             // box back wall top; lid back panel bottom
  const LZ=p.lh+t,ZT=Z+LZ;                              // lid outside height; lid top
  const hh=Math.sqrt(R*R-t*t/4),hr=Math.sqrt(Rp*Rp-t*t/4);
  const up=(P,dz)=>P.map(([u,v])=>[u,v+dz]);

  // Box: open box with a lowered back wall; side walls get the knob and bore.
  const box=J.boxParts(X,Y,Z,t,fw,{top:false,play:p.play,h:{back:Zb},gname:'box',em:p.em,engrave:['front','left','right']});
  const knob=P=>J.roundCorner(P,[Y,Z],[Yc,Z],[Y,Z-hh],[Yc-R,Z],1);
  for(const s of box)if(s.name==='left'||s.name==='right'){
    s.outline=knob(s.outline);
    s.holes=[{circle:[Yc,Z,rb],free:true}];
    s.place.envPoly=knob(rect(0,0,Y,Z));
  }

  // Lid, built in box coordinates (closed). Corner cubes belong to the lid's front and back.
  const pl=(n,lo,hi,u,v,extra)=>({n,lo,hi,u,v,g:0,...extra});
  const lidTop={name:'lidtop',label:'LID TOP',outline:J.fingerPanel(X,Y,t,fw,['F','F','F','F'],[0,0,0,0],p.play),
    engrave:[[p.em,p.em,X-p.em,Y-p.em]],place:pl(2,ZT-t,ZT,0,1,{env:[0,0,X,Y]})};
  const lidFront={name:'lidfront',label:'LID FRONT',outline:up(J.fingerPanel(X,LZ,t,fw,['e','F','f','F'],[1,1,1,1],p.play),Z),
    place:pl(1,0,t,0,2,{env:[0,Z,X,ZT]})};
  // Lid back: below Z + Rp its ends are cut back (the knobs are there) except for the axle tabs.
  const H=ZT-Zl,low=Z+Rp-Zl,tab=[Z-th/2-Zl,Z+th/2-Zl];
  const backEdges=['e',[{len:low,type:'n',swap:[tab]},{len:H-low,type:'F',c0:true}],'f',
    [{len:H-low,type:'F',c1:true},{len:low,type:'n',swap:[[H-tab[1],H-tab[0]]]}]];
  const lidBack={name:'lidback',label:'LID BACK',outline:up(J.fingerPanel(X,H,t,fw,backEdges,[0,0,1,1],p.play),Zl),
    place:pl(1,Y-t,Y,0,2,{envPoly:J.bumpRect(t,Zl,X-t,ZT,{l:[[Z-th/2,Z+th/2,t]],r:[[Z-th/2,Z+th/2,t]]})})};
  // Lid sides: cut away around the knob with clearance.
  const cut=P=>J.roundCorner(P,[Y,Z],[Yc,Z],[Yc-Rp,Z],[Y,Z+hr]);
  const sideOutline=cut(up(J.fingerPanel(Y,LZ,t,fw,['e',[{len:Rp,type:'e'},{len:LZ-Rp,type:'f',c0:false}],'f','f'],[0,1,0,0],p.play),Z));
  const lidSide=(label,lo)=>({name:'lidside',label,outline:sideOutline,place:pl(0,lo,lo+t,1,2,{envPoly:cut(rect(0,Z,Y,ZT))})});
  const parts=[...box,lidTop,lidFront,lidBack,lidSide('LID LEFT',0),lidSide('LID RIGHT',X-t)];
  return {...d,R,rb,Zb,LZ,axis:[Yc,Z],lid:[lidTop,lidFront,lidBack],parts};
}

LB.register({
  id:'integrated-hinge-box',
  name:'Integrated-hinge box',
  group:'Boxes',
  blurb:'Box whose lid pivots on tabs of its own back panel in round knobs on the side walls. No extra hinge parts.',
  params:[...J.boxParams({x:100,y:70,z:50}),
    {id:'lh',label:'Lid depth (inside)',def:30,step:1,group:'Lid',pos:true},
    {id:'hp',label:'Hinge clearance',def:0.3,step:0.05,group:'Lid',min:0.05,help:'Gap around the axle tabs and the knobs.'}],
  build:J.withCheckParts(make),
  validate(p,g){
    const v=J.boxValidate(p,g,false),t=p.t;
    if(p.lh<g.R+2*t)v.errors.push(`The lid is too shallow for the hinge: lid depth at least ${fmt(g.R+2*t)} mm.`);
    else if(J.fingerSegs(p.lh+t-g.R,t,p.fw*t).n<3)v.warnings.push('The lid\'s back corners get only one finger above the hinge. Make the lid deeper or the fingers narrower.');
    if(g.Zb<2*t+p.fw*t)v.errors.push('The box is too short for the lowered back wall.');
    v.info.push(`The knobs stick out ${fmt(g.R-p.t/2)} mm behind the back and above the rim.`);
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view (closed)',render:(p,g)=>J.view3d(g.parts)}],
  checks(p,g){
    const P=g.checkParts,lid=P.filter(q=>q.name&&q.name.startsWith('lid'));
    const deg=J.swing3d(lid,P.filter(q=>!lid.includes(q)),g.axis);
    return [...J.boxChecks(p,P),J.fingerCheck(p,[g.X,g.Y,g.Zb]),
      {ok:deg>=85,name:'Lid swings open',detail:deg<0?'The lid collides with the box when closed.':`Rotating about the axle tabs, the lid opens ${deg}° before touching the box.`}];
  },
  filename:p=>`integrated-hinge-box_${p.x}x${p.y}x${p.z}.svg`,
  help:`<ul>
<li>Assembly order matters: put the lid back panel's two axle tabs into the bores of both box side walls first, then build the box around them (bottom, front, back), then add the lid's top, front and sides.</li>
<li>Hinge clearance is the gap around the axle tabs and between the knobs and the lid sides; raise it if the lid binds.</li>
</ul>`,
});
})();
