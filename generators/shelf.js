'use strict';
/* Shelf / cubby organizer: a grid of cubbies with an open front. It's the divider-tray grid
   (LB.joints.gridBox) stood on its back: the tray bottom becomes the back panel, X dividers
   become shelves and Y dividers become uprights. Optional wall-mounting holes in the back. */
(()=>{
const J=LB.joints,{fmt}=LB;
const RENAME={front:'BOTTOM',back:'TOP',left:'SIDE L',right:'SIDE R',bottom:'BACK'};

function make(p){
  const t=p.t;
  // Grid in tray coordinates: x = width, y = height, z = depth (open face at z = Z).
  const q={...p,x:p.w,y:p.ht,z:p.d,nx:p.cols,ny:p.rows,dh:0};
  const pre=J.gridBox(q);
  const cwx=pre.cwx,cwy=pre.cwy,Y=pre.Y;
  const mh=p.md>0?[[t+cwx/2,Y-t-Math.min(cwy/2,15)],[pre.X-t-cwx/2,Y-t-Math.min(cwy/2,15)]].map(([x,y])=>({circle:[x,y,p.md/2],free:true})):[];
  const g=J.gridBox(q,{bottomHoles:mh,engrave:['back']});
  const tf=P=>[P[0],g.Z-P[2],P[1]];                    // stand it up: tray z -> depth from the front, tray y -> up
  let s=0,u=0;
  for(const part of g.parts){
    part.label=part.name==='divx'?`SHELF ${++s}`:part.name==='divy'?`UPRIGHT ${++u}`:RENAME[part.name]||part.label;
    if(part.place)part.place={...part.place,tf};
  }
  return g;
}

LB.register({
  id:'shelf',
  name:'Shelf / cubby organizer',
  group:'Storage',
  blurb:'Open-front grid of cubbies (or a small bookshelf); shelves and uprights interlock, with optional wall-mount holes.',
  params:[
    {id:'w',label:'Inside width',def:240,step:1,group:'Shelf',pos:true},
    {id:'ht',label:'Inside height',def:160,step:1,group:'Shelf',pos:true},
    {id:'d',label:'Inside depth',def:100,step:1,group:'Shelf',pos:true},
    {id:'outside',label:'Sizes are outside dimensions',def:false,type:'bool',group:'Shelf'},
    {id:'cols',label:'Columns',def:3,step:1,group:'Shelf',type:'int',min:1},
    {id:'rows',label:'Rows',def:2,step:1,group:'Shelf',type:'int',min:1},
    {id:'md',label:'Mounting hole diameter (0 = none)',def:5,step:0.5,group:'Shelf',min:0},
    {id:'t',label:'Material thickness',def:3,step:0.1,group:'Material',pos:true},
    {id:'fw',label:'Finger width (× thickness)',def:2,step:0.5,group:'Material',min:1},
    J.playParam(),
    {id:'em',label:'Engrave inset margin',def:10,step:1,group:'Engrave',min:0},
  ],
  build:J.withCheckParts(make),
  validate(p,g){
    const v=J.boxValidate(p,g,false),t=p.t;
    v.info.pop();
    if(g.cwx<2*t||g.cwy<2*t)v.errors.push('Cubbies are too small for that many rows or columns.');
    if(p.md>0&&p.md>Math.min(g.cwx,g.cwy)/2)v.errors.push('Mounting holes are too big for the cubbies.');
    if(t<5&&g.cwx>200)v.warnings.push('Wide shelves in thin material will sag under load; add a column or use thicker stock.');
    v.info.push(`Outside ${fmt(g.X)} wide × ${fmt(g.Y)} tall × ${fmt(g.Z)} deep; each cubby ${fmt(g.cwx)} × ${fmt(g.cwy)} mm, ${fmt(g.Z-t)} mm deep.`);
    if(p.md>0)v.info.push('Mounting holes are in the back panel, in the top-left and top-right cubbies.');
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view',render:(p,g)=>J.view3d(g.parts)}],
  checks:(p,g)=>[...J.boxChecks(p,g.checkParts),J.fingerCheck(p,[g.X,g.Y,g.Z])],
  filename:p=>`shelf_${p.w}x${p.ht}x${p.d}_${p.cols}x${p.rows}.svg`,
  help:`<ul>
<li>Assembly: lay the back flat, slot the shelves and uprights together (shelf slots face the front), drop them into the back's slots, then add the bottom, top and sides so the end tabs pass through.</li>
<li>The finger joints are a press fit; glue them for anything that carries real weight.</li>
</ul>`,
});
})();
