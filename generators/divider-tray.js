'use strict';
/* Divider tray: open box split into a grid of equal compartments by slotted dividers.
   Dividers cross with half-height slots, and their tabs go through slots in the walls and bottom
   (geometry in LB.joints.gridBox, shared with the shelf generator). */
(()=>{
const J=LB.joints,{fmt}=LB;

LB.register({
  id:'divider-tray',
  name:'Divider tray',
  group:'Boxes',
  blurb:'Open tray with a grid of equal compartments; dividers interlock and tab into the walls.',
  params:[...J.boxParams({x:150,y:100,z:40}),
    {id:'nx',label:'Compartments across (x)',def:3,step:1,group:'Dividers',type:'int',min:1},
    {id:'ny',label:'Compartments deep (y)',def:2,step:1,group:'Dividers',type:'int',min:1},
    {id:'dh',label:'Dividers lower than walls by',def:0,step:1,group:'Dividers',min:0}],
  build:J.withCheckParts(p=>J.gridBox(p)),
  validate(p,g){
    const v=J.boxValidate(p,g,false);
    if(g.cwx<2*p.t||g.cwy<2*p.t)v.errors.push('Compartments are too small for that many dividers.');
    if(g.hd<3*p.t)v.errors.push('Dividers are too short; reduce "lower than walls by" or make the tray taller.');
    if(p.nx===1&&p.ny===1)v.info.push('With one compartment each way there are no dividers; this is an open box.');
    v.info.push(`Each compartment is ${fmt(g.cwx)} × ${fmt(g.cwy)} mm inside.`);
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view',render:(p,g)=>J.view3d(g.parts)}],
  checks:(p,g)=>[...J.boxChecks(p,g.checkParts),J.fingerCheck(p,[g.X,g.Y,g.Z])],
  filename:p=>`divider-tray_${p.x}x${p.y}x${p.z}_${p.nx}x${p.ny}.svg`,
  help:`<ul>
<li>Assembly: fit the bottom into one long wall, slot the dividers together (X dividers' slots face up, Y dividers' slots face down), drop them into the bottom slots, then add the remaining walls so the end tabs pass through.</li>
<li>Divider slots are cut at material thickness plus the joint clearance, so they fit like the finger joints.</li>
</ul>`,
});
})();
