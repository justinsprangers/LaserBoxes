'use strict';
/* Open box: five finger-jointed panels, no top. */
(()=>{
const J=LB.joints;

LB.register({
  id:'open-box',
  name:'Open box',
  group:'Boxes',
  blurb:'Five-sided tray or bin with no top.',
  params:J.boxParams({x:100,y:80,z:50}),
  build(p){
    const d=J.boxDims(p,false);
    return {...d,parts:J.boxParts(d.X,d.Y,d.Z,p.t,p.fw*p.t,{top:false,em:p.em,engrave:['front','back','left','right']})};
  },
  validate:(p,g)=>J.boxValidate(p,g,false),
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view',render:(p,g)=>J.view3d(g.parts)}],
  checks:(p,g)=>[...J.boxChecks(p,g.parts),J.fingerCheck(p,[g.X,g.Y,g.Z])],
  filename:p=>`open-box_${p.x}x${p.y}x${p.z}.svg`,
  help:'<ul><li>Height is measured from the inside of the bottom to the top edge (or the outside bottom, with outside dimensions on).</li></ul>',
});
})();
