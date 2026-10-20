'use strict';
/* Plate with mounting holes: the smallest complete generator. Copy this file to start a new one
   (see README.md, "Adding a generator"). */
(()=>{
const {rect,fmt,dimH,dimV}=LB;

LB.register({
  id:'plate',
  name:'Plate with mounting holes',
  group:'Basics',
  blurb:'Rectangular plate with optional corner holes. Also the template for new generators.',
  params:[
    {id:'W',label:'Width',def:100,step:1,group:'Plate',pos:true},
    {id:'H',label:'Height',def:60,step:1,group:'Plate',pos:true},
    {id:'holes',label:'Corner holes',def:true,type:'bool',group:'Holes'},
    {id:'d',label:'Hole diameter',def:4,step:0.1,group:'Holes',pos:true},
    {id:'e',label:'Hole inset (edge to centre)',def:6,step:0.5,group:'Holes',pos:true},
    {id:'em',label:'Engrave inset margin',def:12,step:1,group:'Engrave',min:0},
  ],
  // Derived numbers shared by the other functions.
  build:p=>({r:p.d/2,centres:[[p.e,p.e],[p.W-p.e,p.e],[p.W-p.e,p.H-p.e],[p.e,p.H-p.e]]}),
  validate(p,g){
    const errors=[],warnings=[];
    if(p.holes&&p.e<g.r+1)errors.push(`Holes break out of the edge: inset must be at least ${fmt(g.r+1)} mm.`);
    if(p.holes&&2*p.e+p.d>Math.min(p.W,p.H))errors.push('Plate is too small for holes at that inset.');
    if(p.holes&&p.eng&&p.em<p.e+g.r)warnings.push('Engrave area overlaps the holes; raise the engrave margin.');
    return {errors,warnings};
  },
  // Parts in mm, y up. Kerf, layout and export are handled by the core.
  parts:(p,g)=>[{
    label:'PLATE',
    outline:rect(0,0,p.W,p.H),
    holes:p.holes?g.centres.map(([x,y])=>({circle:[x,y,g.r]})):[],
    engrave:[[p.em,p.em,p.W-p.em,p.H-p.em]],
  }],
  annotate(p,g,[P],fs){
    return dimH(P.X(0),P.X(p.W),P.Y(0)+fs*1.6,`${fmt(p.W)}`,fs)+dimV(P.X(0)-fs*1.2,P.Y(p.H),P.Y(0),`${fmt(p.H)}`,fs);
  },
  help:'<ul><li>Hole inset is measured from the plate edge to the hole centre.</li></ul>',
});
})();
