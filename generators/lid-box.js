'use strict';
/* Box with lift-off lid: an open box plus a shallow upside-down open box that slips over it. */
(()=>{
const J=LB.joints,{fmt}=LB;

LB.register({
  id:'lid-box',
  name:'Box with lid',
  group:'Boxes',
  blurb:'Open box plus a lift-off lid that slips over the top.',
  params:[...J.boxParams({x:100,y:80,z:50}),
    {id:'lh',label:'Lid depth (inside)',def:25,step:1,group:'Lid',pos:true,help:'How far the lid reaches down over the box.'},
    {id:'c',label:'Lid clearance (per side)',def:0.5,step:0.1,group:'Lid',min:0}],
  build:J.withCheckParts(p=>{
    const d=J.boxDims(p,false),t=p.t,fw=p.fw*t;
    const LX=d.X+2*p.c+2*t,LY=d.Y+2*p.c+2*t,LZ=p.lh+t,lift=d.Z+LZ*0.6;
    const base=J.boxParts(d.X,d.Y,d.Z,t,fw,{top:false,play:p.play,em:p.em,engrave:['front','back','left','right'],gname:'box'});
    const lid=J.boxParts(LX,LY,LZ,t,fw,{top:false,play:p.play,prefix:'LID ',g:1,gname:'lid',em:p.em,engrave:['bottom'],
      tf:P=>[P[0]-t-p.c,P[1]-t-p.c,lift+LZ-P[2]]});
    return {...d,LX,LY,LZ,parts:[...base,...lid]};
  }),
  validate(p,g){
    const v=J.boxValidate(p,g,false);
    if(p.lh+p.t<2*p.t+p.fw*p.t)v.errors.push(`Lid depth is too small for one finger: at least ${fmt(p.t+p.fw*p.t)} mm.`);
    else if(J.fingerSegs(g.LZ,p.t,p.fw*p.t).n<3)v.warnings.push('The lid\'s short edges get only one finger, so they won\'t interlock. Make the lid deeper or the fingers narrower.');
    if(p.lh>g.Z)v.warnings.push('The lid is deeper than the box is tall.');
    if(p.c>1)v.warnings.push('Lid clearance over 1 mm per side: the lid will be loose.');
    v.info.push(`Lid outside ${fmt(g.LX)} × ${fmt(g.LY)} × ${fmt(g.LZ)} mm; inside clears the box by ${fmt(p.c)} mm per side.`);
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view (lid lifted)',render:(p,g)=>J.view3d(g.parts)}],
  checks:(p,g)=>[...J.boxChecks(p,g.checkParts),J.fingerCheck(p,[g.X,g.Y,g.Z,g.LX,g.LY,g.LZ]),
    {ok:p.c>0,name:'Lid slips over the box',detail:`Lid inside ${fmt(g.LX-2*p.t)} × ${fmt(g.LY-2*p.t)} mm vs box outside ${fmt(g.X)} × ${fmt(g.Y)} mm.`}],
  filename:p=>`lid-box_${p.x}x${p.y}x${p.z}.svg`,
  help:'<ul><li>The lid is an upside-down shallow box. Its "LID BOTTOM" panel is the top surface, so that\'s where its engrave area goes.</li></ul>',
});
})();
