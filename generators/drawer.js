'use strict';
/* Drawer: open box plus a larger face plate glued to the front, with a finger-pull hole through both. */
(()=>{
const J=LB.joints,{rect,fmt}=LB;

LB.register({
  id:'drawer',
  name:'Drawer',
  group:'Boxes',
  blurb:'Open box with an overhanging face plate and a finger-pull hole.',
  params:[...J.boxParams({x:120,y:150,z:60}),
    {id:'ov',label:'Face overhang (each side)',def:5,step:0.5,group:'Face',min:0},
    {id:'hd',label:'Finger hole diameter',def:25,step:1,group:'Face',min:0,help:'0 for no hole.'}],
  build:J.withCheckParts(p=>{
    const d=J.boxDims(p,false),{X,Z}=d,t=p.t;
    const hole=p.hd>0?[{circle:[X/2,Z/2,p.hd/2],free:true}]:[];
    const parts=J.boxParts(d.X,d.Y,Z,t,p.fw*t,{top:false,play:p.play,holes:{front:hole},em:p.em,engrave:[]});
    parts.push({label:'FACE',outline:rect(-p.ov,-p.ov,X+p.ov,Z+p.ov),holes:hole,
      engrave:[[-p.ov+p.em,-p.ov+p.em,X+p.ov-p.em,Z+p.ov-p.em]],
      place:{n:1,lo:-t,hi:0,u:0,v:2,env:[-p.ov,-p.ov,X+p.ov,Z+p.ov],g:1}});
    return {...d,parts};
  }),
  validate(p,g){
    const v=J.boxValidate(p,g,false);
    if(p.hd>0&&(p.hd/2>g.Z/2-p.t-2||p.hd>g.X-4*p.t))v.errors.push('Finger hole is too big for the front panel (it would cut into the joints).');
    v.info.push(`Face plate ${fmt(g.X+2*p.ov)} × ${fmt(g.Z+2*p.ov)} mm.`);
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view',render:(p,g)=>J.view3d(g.parts)}],
  checks:(p,g)=>[...J.boxChecks(p,g.checkParts),J.fingerCheck(p,[g.X,g.Y,g.Z])],
  filename:p=>`drawer_${p.x}x${p.y}x${p.z}.svg`,
  help:'<ul><li>Glue the face plate to the drawer front, lining up the finger holes. Size the drawer a couple of mm smaller than its opening.</li><li>The face engrave area includes the finger hole; plan artwork around it.</li></ul>',
});
})();
