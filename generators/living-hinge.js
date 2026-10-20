'use strict';
/* Living hinge panel: a plate with a band of slits so it bends. */
(()=>{
const J=LB.joints,{rect,fmt,dimH,dimV}=LB;

LB.register({
  id:'living-hinge',
  name:'Living hinge panel',
  group:'Basics',
  blurb:'Flat panel with a band of slits that lets it bend.',
  experimental:'Experimental: the hinge pattern hasn\'t been test-cut yet. Try it on scrap first.',
  params:[
    {id:'W',label:'Width',def:150,step:1,group:'Panel',pos:true},
    {id:'H',label:'Height',def:80,step:1,group:'Panel',pos:true},
    {id:'hz',label:'Hinge band width (0 = full)',def:60,step:1,group:'Panel',min:0},
    ...J.hingeParams(),
    {id:'em',label:'Engrave inset margin',def:8,step:1,group:'Engrave',min:0},
  ],
  build(p){
    const hz=p.hz>0?Math.min(p.hz,p.W):p.W,x0=(p.W-hz)/2,x1=x0+hz,e=p.em;
    return {hz,x0,x1,cuts:J.hingeCuts(x0,x1,0,p.H,p),engrave:[[e,e,x0-e,p.H-e],[x1+e,e,p.W-e,p.H-e]]};
  },
  validate(p,g){
    const E=[];
    if(p.hz>p.W)E.push('Hinge band is wider than the panel.');
    if(p.H<2*p.bw+4)E.push('Panel is too short for the hinge pattern.');
    return {errors:E,info:[`${g.cuts.length} slits across a ${fmt(g.hz)} mm band.`]};
  },
  parts:(p,g)=>[{label:'HINGE PANEL',outline:rect(0,0,p.W,p.H),cuts:g.cuts,engrave:g.engrave}],
  annotate(p,g,[P],fs){
    return dimH(P.X(0),P.X(p.W),P.Y(0)+fs*1.6,fmt(p.W),fs)+dimV(P.X(0)-fs*1.2,P.Y(p.H),P.Y(0),fmt(p.H),fs)+
      (g.hz<p.W?dimH(P.X(g.x0),P.X(g.x1),P.Y(p.H)-fs*.6,`hinge ${fmt(g.hz)}`,fs*.8):'');
  },
  filename:p=>`living-hinge_${p.W}x${p.H}.svg`,
  help:'<ul><li>The slits are open lines, so kerf compensation doesn\'t apply to them. Plywood or MDF bends best; acrylic usually cracks.</li></ul>',
});
})();
