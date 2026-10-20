'use strict';
/* Hinge box: open box plus a lid (shallow upside-down open box) joined by knuckle hinges on the
   back. Each hinge is a row of small upright leaves, alternating box leaf and lid leaf, each
   tabbed through a slot in the back wall (box) or the lid's back wall (lid), with a rod through
   the eyes. The pivot sits behind the back face at rim height, so the lid opens to about 90°. */
(()=>{
const J=LB.joints,{fmt}=LB;

// A leaf in side-wall coordinates (u = y, v = z), for a back face at y = Y and a rim at z = R:
// body behind the back face below the rim, a half-round eye above the rim, and a tab forward
// through the back wall. Returns [outline, body (for the fit check), eye centre].
function leaf(Y,R,t,ra,Lh){
  const ey=Y+ra,arc=[];
  for(let j=1;j<16;j++){const a=Math.PI*j/16;arc.push([ey+ra*Math.cos(a),R+ra*Math.sin(a)]);}
  const top=[[Y+2*ra,R],...arc,[Y,R]];
  const outline=[[Y,R-Lh],[Y+2*ra,R-Lh],...top,[Y,R-t],[Y-t,R-t],[Y-t,R-Lh+t],[Y,R-Lh+t]];
  return [outline,[[Y,R-Lh],[Y+2*ra,R-Lh],...top],[ey,R]];
}

function make(p){
  const t=p.t,fw=p.fw*t,d=J.boxDims(p,false),{X,Y,Z}=d;
  const ra=p.pd/2+t,Lh=Math.max(4*t,2*ra+t),LZ=p.lh+t;
  // Leaf x positions: hinges centred at (i + 0.5) / nh of the width, leaves alternating box/lid.
  const leaves=[];
  for(let i=0;i<p.nh;i++){
    const xc=X*(i+0.5)/p.nh,W=p.ne*t+(p.ne-1)*p.hp;
    for(let k=0;k<p.ne;k++)leaves.push({x0:xc-W/2+k*(t+p.hp),lid:k%2===1});
  }
  const slot=(x0,R)=>LB.rect(x0,R-Lh+t,x0+t,R-t);
  const pin=([u,v])=>({circle:[u,v,p.pd/2],free:true});
  const box=J.boxParts(X,Y,Z,t,fw,{top:false,play:p.play,gname:'box',em:p.em,engrave:['front','left','right'],
    holes:{back:leaves.filter(l=>!l.lid).map(l=>slot(l.x0,Z))}});
  const tf=P=>[P[0],P[1],Z+LZ-P[2]];                   // lid-local (upside-down box) to box coordinates
  const lid=J.boxParts(X,Y,LZ,t,fw,{top:false,play:p.play,prefix:'LID ',g:1,gname:'lid',em:p.em,engrave:['bottom'],tf,
    holes:{back:leaves.filter(l=>l.lid).map(l=>slot(l.x0,LZ))}});
  const parts=[...box,...lid];
  leaves.forEach((l,i)=>{
    const [outline,body,eye]=leaf(Y,l.lid?LZ:Z,t,ra,Lh);
    parts.push({name:'leaf',label:`LEAF ${l.lid?'LID':'BOX'} ${i+1}`,outline,holes:[pin(eye)],
      place:{n:0,lo:l.x0,hi:l.x0+t,u:1,v:2,envPoly:body,g:l.lid?1:0,gname:l.lid?'lid':'box',tf:l.lid?tf:undefined}});
  });
  return {...d,ra,Lh,LZ,leaves,axis:[Y+ra,Z],parts};
}

LB.register({
  id:'hinge-box',
  name:'Hinge box',
  group:'Boxes',
  blurb:'Box with a lid on knuckle hinges: alternating leaves on the back with a rod through them.',
  params:[...J.boxParams({x:100,y:70,z:50}),
    {id:'lh',label:'Lid depth (inside)',def:25,step:1,group:'Lid',pos:true},
    {id:'pd',label:'Rod diameter',def:3,step:0.1,group:'Hinge',pos:true,help:'Hole size for the hinge rod (e.g. 3 mm rod or M3 bolt, 1.75 mm filament).'},
    {id:'nh',label:'Number of hinges',def:2,step:1,group:'Hinge',type:'int',min:1},
    {id:'ne',label:'Leaves per hinge',def:3,step:1,group:'Hinge',type:'int',min:2,help:'Alternating box / lid leaves; odd numbers put a box leaf at each end.'},
    {id:'hp',label:'Gap between leaves',def:0.3,step:0.05,group:'Hinge',min:0}],
  build:J.withCheckParts(make),
  validate(p,g){
    const v=J.boxValidate(p,g,false),t=p.t;
    if(g.Lh>g.LZ-t)v.errors.push(`The lid is too shallow for the hinge leaves: lid depth at least ${fmt(g.Lh)} mm.`);
    else if(J.fingerSegs(g.LZ,t,p.fw*t).n<3)v.warnings.push('The lid\'s short edges get only one finger. Make the lid deeper or the fingers narrower.');
    if(g.Lh>g.Z-2*t)v.errors.push('The box is too short for the hinge leaves.');
    const xs=g.leaves.map(l=>l.x0).sort((a,b)=>a-b);
    if(xs[0]<t+1||xs[xs.length-1]+t>g.X-t-1)v.errors.push('Hinges reach the box corners: fewer hinges, fewer leaves, or a wider box.');
    else if(xs.some((x,i)=>i&&x<xs[i-1]+t))v.errors.push('Hinges overlap: fewer hinges or leaves.');
    v.info.push(`Hinge rods: ${p.nh} × ${fmt(p.pd)} mm, about ${fmt(p.ne*t+(p.ne-1)*p.hp+4)} mm long. Leaves stick out ${fmt(2*g.ra)} mm behind the back.`);
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view (closed)',render:(p,g)=>J.view3d(g.parts)}],
  checks(p,g){
    const P=g.checkParts,deg=J.swing3d(P.filter(q=>q.place.g===1),P.filter(q=>q.place.g===0),g.axis);
    return [...J.boxChecks(p,P),J.fingerCheck(p,[g.X,g.Y,g.Z,g.LZ]),
      {ok:deg>=85,name:'Lid swings open',detail:deg<0?'The lid collides with the box when closed.':deg>=180?'Rotating about the rods, the lid opens a full 180° and hangs flat behind the box.':`Rotating about the rods, the lid opens ${deg}° before touching the box.`}];
  },
  filename:p=>`hinge-box_${p.x}x${p.y}x${p.z}.svg`,
  help:`<ul>
<li>Assembly: build the box and the lid. Press the box leaves into the back wall's slots and the lid leaves into the lid's back wall, line up the eyes, and push a rod through each hinge. Glue the leaves if they're loose.</li>
<li>Rods: short lengths of 3 mm rod, M3 bolts, or 1.75 mm filament (set the diameter to match).</li>
</ul>`,
});
})();
