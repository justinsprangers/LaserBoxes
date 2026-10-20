'use strict';
/* Stackable parts bin: open-front bin with a low front lip and sides that slope up from it.
   Two cleats glued under the bottom drop inside the walls of the bin below, so stacked bins
   can't slide sideways or backwards. */
(()=>{
const J=LB.joints,{rect,fmt}=LB;

function make(p){
  const t=p.t,fw=p.fw*t,d=J.boxDims(p,false),{X,Y,Z}=d;
  const Zf=Math.min(p.fh+t,Z),sd=Math.min(p.sd,Y);   // front lip height (outside); slope length
  const parts=J.boxParts(X,Y,Z,t,fw,{top:false,play:p.play,h:{front:Zf},em:p.em/2,engrave:['front']});
  // Sides: keep a*y + b*z + c >= 0, the region under the slope from (0, Zf) to (sd, Z).
  const a=(Z-Zf)/sd,b=-1,c=Zf;
  for(const s of parts)if(s.name==='left'||s.name==='right'){
    s.outline=J.clipHalf(s.outline,a,b,c);
    s.place.envPoly=J.clipHalf(rect(0,0,Y,Z),a,b,c);
  }
  if(p.stack){
    const cl=(label,x0)=>({name:'cleat',label,outline:rect(t+p.c,-t,Y-t-p.c,0),place:{n:0,lo:x0,hi:x0+t,u:1,v:2,env:[t+p.c,-t,Y-t-p.c,0],g:0}});
    parts.push(cl('CLEAT L',t+p.c),cl('CLEAT R',X-2*t-p.c));
  }
  return {...d,Zf,parts};
}

LB.register({
  id:'stackable-bin',
  name:'Stackable bin',
  group:'Storage',
  blurb:'Open-front parts bin with a sloped side and a label lip; cleats underneath lock bins into a stack.',
  params:[...J.boxParams({x:100,y:150,z:80}),
    {id:'fh',label:'Front lip height (inside)',def:30,step:1,group:'Bin',pos:true},
    {id:'sd',label:'Slope length (from the front)',def:80,step:1,group:'Bin',pos:true},
    {id:'stack',label:'Stacking cleats',def:true,type:'bool',group:'Stacking'},
    {id:'c',label:'Cleat clearance (per side)',def:0.5,step:0.1,group:'Stacking',min:0}],
  build:J.withCheckParts(make),
  validate(p,g){
    const v=J.boxValidate(p,g,false),t=p.t;
    if(g.Zf<2*t+p.fw*t)v.errors.push('Front lip is too low for a finger joint.');
    if(p.fh+t>=g.Z)v.errors.push('Front lip must be lower than the bin.');
    if(p.sd>=g.Y-2*t)v.warnings.push('The slope runs almost to the back; stacked bins will rest only on the back wall.');
    v.info.push(`Front lip ${fmt(g.Zf)} mm tall outside; the engrave area on it is for a label.`);
    if(p.stack)v.info.push('Glue the cleats under the bottom, flush with its edges inside the side walls. Stacked, the bin above rests on the flat back part of the sides.');
    return v;
  },
  parts:(p,g)=>g.parts,
  panels:[{title:'Assembled view (two stacked)',render:(p,g)=>J.view3d([...g.parts,...g.parts.map(q=>({...q,place:{...q.place,g:1,tf:P=>[P[0],P[1],P[2]+g.Z]}}))])}],
  checks(p,g){
    const R=[...J.boxChecks(p,g.checkParts),J.fingerCheck(p,[g.X,g.Y,g.Zf])];
    if(p.stack)R.push({ok:p.c>0,name:'Bins stack',detail:`Cleats sit ${fmt(p.c)} mm inside the walls of the bin below on each side, and stop ${fmt(p.c)} mm short of its back wall.`});
    return R;
  },
  filename:p=>`stackable-bin_${p.x}x${p.y}x${p.z}.svg`,
  help:'<ul><li>Stack as many as you like; the cleats stop bins sliding sideways and backwards. They can still be pulled forward off the stack.</li></ul>',
});
})();
