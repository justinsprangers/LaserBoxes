'use strict';
/* Closed box: six finger-jointed panels. */
(()=>{
const J=LB.joints;

LB.register({
  id:'closed-box',
  name:'Closed box',
  group:'Boxes',
  blurb:'Six-sided box with finger joints on every edge.',
  params:J.boxParams({x:100,y:80,z:60}),
  build(p){
    const d=J.boxDims(p,true);
    return {...d,parts:J.boxParts(d.X,d.Y,d.Z,p.t,p.fw*p.t,{top:true,em:p.em,engrave:['front','back','left','right','top']})};
  },
  validate:(p,g)=>J.boxValidate(p,g,true),
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view',render:(p,g)=>J.view3d(g.parts)}],
  checks:(p,g)=>[...J.boxChecks(p,g.parts),J.fingerCheck(p,[g.X,g.Y,g.Z])],
  filename:p=>`closed-box_${p.x}x${p.y}x${p.z}.svg`,
  help:`<ul>
<li>Front and back are full rectangles at the corners; the sides, top and bottom fit between them.</li>
<li>Joints are a press fit at nominal size once kerf is compensated. If they're too tight, lower the kerf a little; too loose, raise it.</li>
<li>A closed box has no way in: glue all but one panel, or use the <b>Box with lid</b> generator.</li>
</ul>`,
});
})();
