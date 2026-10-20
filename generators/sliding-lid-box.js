'use strict';
/* Sliding-lid box: an open box whose front wall is shorter, with rails glued inside the side
   walls. The lid slides in over the front wall, its edges running in the groove between the
   low rail and the top rail on each side. */
(()=>{
const J=LB.joints,{rect,fmt}=LB;

function make(p){
  const t=p.t,c=p.c;
  let X,Y,Z,Zg;                                         // Zg: underside of the lid
  if(p.outside){X=p.x;Y=p.y;Z=p.z;Zg=Z-p.rh-c-t;}
  else{X=p.x+4*t;Y=p.y+2*t;Zg=p.z+t;Z=Zg+t+c+p.rh;}
  const parts=J.boxParts(X,Y,Z,t,p.fw*t,{top:false,play:p.play,h:{front:Zg},em:p.em,engrave:['front','back','left','right']});
  // Rails: drawn in side-wall coordinates (u = y, v = z), glued to the inside of each side.
  const rail=(label,x0,y0,y1,z0,z1)=>({label,outline:rect(y0,z0,y1,z1),place:{n:0,lo:x0,hi:x0+t,u:1,v:2,env:[y0,z0,y1,z1],g:0}});
  parts.push(
    rail('LOW RAIL L',t,t,Y-t,t,Zg),rail('LOW RAIL R',X-2*t,t,Y-t,t,Zg),
    rail('TOP RAIL L',t,0,Y-t,Zg+t+c,Z),rail('TOP RAIL R',X-2*t,0,Y-t,Zg+t+c,Z));
  const hy=p.fd/2+6;                                    // finger hole centre from the front
  parts.push({label:'LID',outline:rect(t+c,0,X-t-c,Y-t-c),
    holes:p.fd>0?[{circle:[X/2,hy,p.fd/2],free:true}]:[],
    engrave:[[t+c+p.em,(p.fd>0?hy+p.fd/2:0)+p.em,X-t-c-p.em,Y-t-c-p.em]],
    place:{n:2,lo:Zg,hi:Zg+t,u:0,v:1,env:[t+c,0,X-t-c,Y-t-c],g:0}});
  return {X,Y,Z,Zg,parts};
}

LB.register({
  id:'sliding-lid-box',
  name:'Sliding-lid box',
  group:'Boxes',
  blurb:'Box with a lid that slides in from the front along grooves formed by glued-in rails.',
  params:[...J.boxParams({x:100,y:80,z:40}),
    {id:'rh',label:'Top rail height',def:6,step:0.5,group:'Lid',pos:true,help:'Height of the strip above the lid on each side.'},
    {id:'c',label:'Lid clearance',def:0.3,step:0.05,group:'Lid',min:0,help:'Gap above and beside the lid in the grooves.'},
    {id:'fd',label:'Finger hole diameter',def:15,step:1,group:'Lid',min:0,help:'0 for no hole.'}],
  build:J.withCheckParts(make),
  validate(p,g){
    const v=J.boxValidate(p,{...g,Z:g.Z},false),t=p.t;
    v.info.pop();
    if(g.Zg<2*t+p.fw*t)v.errors.push('The box is too shallow: the front wall needs room for one finger.');
    if(p.rh<t)v.warnings.push('Top rail is thinner than the material; it may snap.');
    if(p.c>=t/2)v.errors.push('Lid clearance is too big: the lid would barely reach into the grooves.');
    if(p.fd>0&&p.fd+12>g.Y-t)v.errors.push('Finger hole is too big for the lid.');
    v.info.push(`Outside ${fmt(g.X)} × ${fmt(g.Y)} × ${fmt(g.Z)} mm; space under the lid ${fmt(g.X-4*t)} × ${fmt(g.Y-2*t)} × ${fmt(g.Zg-t)} mm.`);
    v.info.push('Glue the low rails onto the bottom against each side wall; glue the top rails flush with the top and the front edge.');
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view',render:(p,g)=>J.view3d(g.parts)}],
  checks:(p,g)=>[...J.boxChecks(p,g.checkParts),J.fingerCheck(p,[g.X,g.Y,g.Zg]),
    {ok:p.c>0&&p.c<p.t/2,name:'Lid slides in the grooves',detail:`Lid edges reach ${fmt(p.t-p.c)} mm into each groove, with ${fmt(p.c)} mm clearance above and at each side.`}],
  filename:p=>`sliding-lid-box_${p.x}x${p.y}x${p.z}.svg`,
  help:`<ul>
<li>Sizes are the space under the lid (between the rails) unless outside dimensions are on.</li>
<li>Assemble the box, glue in the rails, then slide the lid in over the front wall.</li>
</ul>`,
});
})();
