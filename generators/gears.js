'use strict';
/* Gears: involute spur gears from a module, tooth count and pressure angle, optionally with a
   second gear that meshes with the first. Addendum 1 m, dedendum 1.25 m; backlash is taken off
   each tooth at the pitch circle. No undercut correction (fine from about 17 teeth at 20°). */
(()=>{
const {fmt,dimH}=LB;
const inv=a=>Math.tan(a)-a;

function gear(N,m,alphaDeg,backlash){
  const al=alphaDeg*Math.PI/180,r=m*N/2,rb=r*Math.cos(al),ra=r+m,rf=r-1.25*m;
  const half=(Math.PI*m/2-backlash)/(2*r)+inv(al);    // half tooth angle at the base circle
  const r0=Math.max(rb,rf),flank=[];                    // [radius, angle from tooth centre], base to tip
  for(let i=0;i<=12;i++){const R=r0+(ra-r0)*i/12;flank.push([R,half-inv(Math.acos(Math.min(1,rb/R)))]);}
  const tip=flank[flank.length-1][1],P=(R,a)=>[R*Math.cos(a),R*Math.sin(a)],pts=[];
  for(let k=0;k<N;k++){
    const c=2*Math.PI*k/N;
    if(rf<r0)pts.push(P(rf,c-half));
    for(const [R,o] of flank)pts.push(P(R,c-o));
    for(let j=1;j<4;j++)pts.push(P(ra,c-tip+2*tip*j/4));
    for(let i=flank.length-1;i>=0;i--)pts.push(P(flank[i][0],c+flank[i][1]));
    if(rf<r0)pts.push(P(rf,c+half));
    const a0=c+half,a1=c+2*Math.PI/N-half;
    for(let j=1;j<4;j++)pts.push(P(rf,a0+(a1-a0)*j/4));
  }
  return {N,r,rb,ra,rf,tip,outline:pts};
}
const place=(G,cx,cy,rot)=>G.outline.map(([x,y])=>[cx+x*Math.cos(rot)-y*Math.sin(rot),cy+x*Math.sin(rot)+y*Math.cos(rot)]);

function make(p){
  const g1=gear(p.n1,p.m,p.pa,p.bl),g2=p.n2>0?gear(p.n2,p.m,p.pa,p.bl):null;
  const a=p.n2>0?p.m*(p.n1+p.n2)/2:0;
  const bore=d=>d>0?[{circle:[0,0,d/2],free:true}]:[];
  const parts=[{label:`GEAR ${p.n1}T`,outline:g1.outline,holes:bore(p.b1)}];
  if(g2)parts.push({label:`GEAR ${p.n2}T`,outline:g2.outline,holes:bore(p.b2)});
  // Phase that puts a gap of gear 2 facing tooth 0 of gear 1 (which points along +x).
  const phase=g2?Math.PI-Math.PI/p.n2:0;
  return {g1,g2,a,phase,parts};
}

// Rotate gear 1 through one tooth pitch (gear 2 follows at the gear ratio) and look for overlap.
function mesh(p,g){
  const A=g.g1,B=g.g2,steps=24,pitch=2*Math.PI/A.N;
  let worst=null;
  for(let j=0;j<=steps;j++){
    const t1=pitch*j/steps,t2=g.phase-t1*A.N/B.N;
    const P1=place(A,0,0,t1),P2=place(B,g.a,0,t2);
    const near=(P,cx)=>P.filter(v=>Math.abs(v[0]-cx)<A.ra+B.ra);
    const bad=near(P2,0).some(v=>LB.joints.pip(P1,v[0],v[1]))||near(P1,g.a).some(v=>LB.joints.pip(P2,v[0],v[1]));
    if(bad){worst=t1*180/Math.PI;break;}
  }
  return worst;
}

function preview(p,g){
  const A=g.g1,B=g.g2,pad=p.m*2;
  const x0=-A.ra-pad,x1=(B?g.a+B.ra:A.ra)+pad,y0=-Math.max(A.ra,B?B.ra:0)-pad,H=-2*y0,fs=(x1-x0)/40;
  const path=P=>'M'+P.map(([x,y])=>`${LB.f3(x)} ${LB.f3(-y)}`).join(' L')+' Z';
  let o=`<svg viewBox="${x0} ${y0} ${x1-x0} ${H+fs*2}" xmlns="http://www.w3.org/2000/svg">`;
  o+=`<path class="cutp" d="${path(place(A,0,0,0))}"/><circle class="lid" cx="0" cy="0" r="${A.r}"/>`;
  if(B){
    o+=`<path class="cutf" d="${path(place(B,g.a,0,g.phase))}"/><circle class="lid" cx="${g.a}" cy="0" r="${B.r}"/>`;
    o+=dimH(0,g.a,-y0+fs*0.6,`centre distance ${fmt(g.a)}`,fs);
  }
  return o+'</svg>';
}

LB.register({
  id:'gears',
  name:'Spur gears',
  group:'Mechanisms',
  blurb:'Involute spur gear, or a meshing pair at the right centre distance, with bores.',
  params:[
    {id:'n1',label:'Teeth (gear 1)',def:30,step:1,group:'Gears',type:'int',min:6},
    {id:'n2',label:'Teeth (gear 2, 0 = none)',def:18,step:1,group:'Gears',type:'int',min:0},
    {id:'m',label:'Module (tooth size)',def:2,step:0.1,group:'Gears',pos:true,help:'Pitch diameter = module × teeth. Mating gears need the same module.'},
    {id:'pa',label:'Pressure angle (°)',def:20,step:0.5,group:'Gears',min:14.5},
    {id:'bl',label:'Backlash per tooth',def:0.1,step:0.05,group:'Gears',min:0},
    {id:'b1',label:'Bore diameter (gear 1)',def:5,step:0.5,group:'Bores',min:0},
    {id:'b2',label:'Bore diameter (gear 2)',def:5,step:0.5,group:'Bores',min:0},
  ],
  build:make,
  validate(p,g){
    const E=[],W=[],I=[];
    if(p.pa>30)E.push('Pressure angle over 30° isn\'t supported.');
    for(const [G,b] of [[g.g1,p.b1],[g.g2,p.b2]])if(G){
      if(G.tip<=0)E.push(`The ${G.N}-tooth gear's teeth come to a point: lower the backlash or pressure angle.`);
      if(b/2>G.rf-p.m)E.push(`The bore of the ${G.N}-tooth gear is too big: at most ${fmt(2*(G.rf-p.m))} mm.`);
      if(G.N<17&&p.pa<=20)W.push(`${G.N} teeth at ${p.pa}° would normally be undercut; this profile isn't, so check the mesh (or use 17+ teeth or a 25° pressure angle).`);
    }
    I.push(`Gear 1: pitch Ø ${fmt(2*g.g1.r)} mm, outside Ø ${fmt(2*g.g1.ra)} mm.`+(g.g2?` Gear 2: pitch Ø ${fmt(2*g.g2.r)} mm, outside Ø ${fmt(2*g.g2.ra)} mm. Centre distance ${fmt(g.a)} mm, ratio ${fmt(p.n1/p.n2)}:1.`:''));
    return {errors:E,warnings:W,info:I};
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Mesh preview (pitch circles dashed)',render:preview,maxWidth:720}],
  checks(p,g){
    const R=[{ok:g.g1.tip>0&&(!g.g2||g.g2.tip>0),name:'Teeth have a flat tip',detail:`Tooth tip half-angle ${fmt(g.g1.tip*180/Math.PI)}° (gear 1).`}];
    if(g.g2){
      const w=mesh(p,g),al=p.pa*Math.PI/180;
      const cr=(Math.sqrt(g.g1.ra**2-g.g1.rb**2)+Math.sqrt(g.g2.ra**2-g.g2.rb**2)-g.a*Math.sin(al))/(Math.PI*p.m*Math.cos(al));
      R.push({ok:w===null,name:'Gears mesh without overlap',detail:w===null?`Turned through a full tooth pitch in 25 steps at ${fmt(g.a)} mm centre distance: teeth never overlap.`:`Teeth overlap at ${fmt(w)}° of gear 1.`});
      R.push({ok:cr>=1.1,name:'Smooth contact',detail:`Contact ratio ${fmt(cr)} (at least 1.1 means a new tooth pair engages before the last lets go).`});
    }
    return R;
  },
  filename:p=>`gears_${p.n1}${p.n2>0?'-'+p.n2:''}_m${p.m}.svg`,
  help:'<ul><li>Mount the gears on axles exactly the centre distance apart. Kerf is compensated like any other part; add backlash if they bind.</li><li>Teeth are drawn as short straight segments along the involute.</li></ul>',
});
})();
