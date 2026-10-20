'use strict';
/* Divider tray: open box split into a grid of equal compartments by slotted dividers.
   Dividers cross with half-height slots, and their tabs go through slots in the walls and bottom. */
(()=>{
const J=LB.joints,{rect,fmt}=LB;

function build(p){
  const d=J.boxDims(p,false),{X,Y,Z}=d,t=p.t,nx=p.nx,ny=p.ny;
  const hd=Z-t-p.dh;                                    // divider height above the bottom
  const cwx=(X-2*t-(nx-1)*t)/nx,cwy=(Y-2*t-(ny-1)*t)/ny; // compartment sizes
  const xc=[],yc=[];                                    // divider centres
  for(let j=1;j<nx;j++)xc.push(t+j*cwx+(j-0.5)*t);
  for(let j=1;j<ny;j++)yc.push(t+j*cwy+(j-0.5)*t);
  const tz0=t+hd*0.3,tz1=t+hd*0.7;                      // end tabs into the walls
  // Bottom tabs: one per stretch between crossings, middle 40%.
  const tabs=(from,to,cross)=>{
    const ends=[from,...cross.flatMap(c=>[c-t/2,c+t/2]),to],out=[];
    for(let i=0;i<ends.length;i+=2){const a=ends[i],b=ends[i+1],m=(a+b)/2,w=(b-a)*0.4;out.push([m-w/2,m+w/2]);}
    return out;
  };
  const xt=tabs(t,X-t,xc),yt=tabs(t,Y-t,yc);
  const holes={front:[],back:[],left:[],right:[],bottom:[]};
  for(const x of xc){holes.front.push(rect(x-t/2,tz0,x+t/2,tz1));holes.back.push(rect(x-t/2,tz0,x+t/2,tz1));}
  for(const y of yc){holes.left.push(rect(y-t/2,tz0,y+t/2,tz1));holes.right.push(rect(y-t/2,tz0,y+t/2,tz1));}
  for(const y of yc)for(const [a,b] of xt)holes.bottom.push(rect(a,y-t/2,b,y+t/2));
  for(const x of xc)for(const [a,b] of yt)holes.bottom.push(rect(x-t/2,a,x+t/2,b));
  const parts=J.boxParts(X,Y,Z,t,p.fw*t,{top:false,holes,em:p.em,engrave:['front','back','left','right']});
  // Dividers parallel to the front (slots from the top) and to the sides (slots from the bottom).
  yc.forEach((y,i)=>parts.push({label:`DIVIDER X${i+1}`,
    outline:J.bumpRect(t,t,X-t,t+hd,{b:xt.map(([a,b])=>[a,b,t]),r:[[tz0,tz1,t]],l:[[tz0,tz1,t]],t:xc.map(x=>[x-t/2,x+t/2,-hd/2])}),
    place:{n:1,lo:y-t/2,hi:y+t/2,u:0,v:2,env:[t,t,X-t,t+hd],g:0}}));
  xc.forEach((x,i)=>parts.push({label:`DIVIDER Y${i+1}`,
    outline:J.bumpRect(t,t,Y-t,t+hd,{b:[...yt.map(([a,b])=>[a,b,t]),...yc.map(y=>[y-t/2,y+t/2,-hd/2])],r:[[tz0,tz1,t]],l:[[tz0,tz1,t]]}),
    place:{n:0,lo:x-t/2,hi:x+t/2,u:1,v:2,env:[t,t,Y-t,t+hd],g:0}}));
  return {...d,hd,cwx,cwy,parts};
}

LB.register({
  id:'divider-tray',
  name:'Divider tray',
  group:'Boxes',
  blurb:'Open tray with a grid of equal compartments; dividers interlock and tab into the walls.',
  params:[...J.boxParams({x:150,y:100,z:40}),
    {id:'nx',label:'Compartments across (x)',def:3,step:1,group:'Dividers',type:'int',min:1},
    {id:'ny',label:'Compartments deep (y)',def:2,step:1,group:'Dividers',type:'int',min:1},
    {id:'dh',label:'Dividers lower than walls by',def:0,step:1,group:'Dividers',min:0}],
  build,
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
  checks:(p,g)=>[...J.boxChecks(p,g.parts),J.fingerCheck(p,[g.X,g.Y,g.Z])],
  filename:p=>`divider-tray_${p.x}x${p.y}x${p.z}_${p.nx}x${p.ny}.svg`,
  help:`<ul>
<li>Assembly: fit the bottom into one long wall, slot the dividers together (X dividers' slots face up, Y dividers' slots face down), drop them into the bottom slots, then add the remaining walls so the end tabs pass through.</li>
<li>Divider slots are cut at material thickness, so they're a press fit like the finger joints.</li>
</ul>`,
});
})();
