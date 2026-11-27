/* Canvas crew portraits and rotating emplacements, shared by the field and shop. */
window.drawPatchCrew = function (ctx, tower, ghost, turn, tools) {
  const {circle, round, path} = tools;
  const ink = '#273845', brass = '#f5bb52', steel = '#7399a1', light = '#fff4bc';
  const coat = ['#478147','#bd5529','#54c9d3','#aa3d88','#8355af','#b48b38','#7d6552','#295c85'][tower.type];
  const dot = (x,y,r,color,edge) => circle(ctx,x,y,r,color,edge);
  const plate = (x,y,w,h,color,r=2) => round(ctx,x,y,w,h,r,color,ink);
  const line = (points,w,color) => path(ctx,points,w,color);
  function polygon(points,color) {
    ctx.beginPath(); points.forEach(([x,y],i)=> i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath(); ctx.fillStyle=color; ctx.fill(); ctx.strokeStyle=ink; ctx.lineWidth=1.3; ctx.stroke();
  }
  function barrel(x,y,length,width,color) {
    plate(x,y-width/2,length,width,color);
    line([[x+2,y-width/3],[x+length-3,y-width/3]],1.5,light);
    plate(x+length-5,y-width/2-2,7,width+4,steel);
    plate(x+length-1,y-width/2,3,width,ink,1);
  }
  ctx.save(); ctx.translate(tower.x,tower.y); ctx.rotate(-turn);
  if(ghost) ctx.globalAlpha=.65;
  ctx.lineWidth=1.5;
  dot(1,8,22,'#20393b48'); const chassis = [
    [[-20,-12],[4,-17],[18,-8],[13,13],[-15,18]],
    [[-20,-14],[16,-14],[22,0],[16,17],[-20,17]],
    [[0,-22],[20,-6],[14,15],[-6,20],[-20,4]],
    [[-21,5],[-8,-17],[21,-10],[13,12],[-13,18]],
    [[0,-20],[17,-12],[20,8],[0,19],[-18,10],[-18,-9]],
    [[-20,-11],[16,-16],[22,7],[10,17],[-19,14]],
    [[-21,-16],[18,-16],[21,15],[-19,16]],
    [[-20,-16],[20,-16],[16,9],[0,21],[-16,9]]
  ][tower.type];
  ctx.save(); ctx.translate(0,4); polygon(chassis,ink); ctx.restore();
  polygon(chassis,coat);
  line(chassis.slice(0,3),2,'#ffffff85');
  for(const x of [-15,15]) for(const y of [-12,10]) dot(x,y,2,brass,ink);
  ctx.save(); ctx.rotate((tower.angle||0)+turn); ctx.translate(-Math.min(4,tower.flash||0),0);
  ctx.scale(1.17,1.14);
  switch(tower.type) {
    case 0: barrel(2,0,23,8,'#568d46'); polygon([[13,-4],[17,-15],[22,-13],[19,-4]],'#94d35b'); dot(24,0,3,'#c9f589'); for(const x of [4,9,14]) dot(x,6,3,'#89c951',ink); break;
    case 1: barrel(0,0,27,17,'#ab613d'); for(const x of [8,17]) plate(x,-10,4,20,brass); dot(-1,7,5,ink,brass); polygon([[19,-9],[31,-13],[31,12],[19,8]],steel); plate(27,-9,4,17,ink); break;
    case 2: for(let i=0;i<5;i++){ctx.rotate(2*Math.PI/5);polygon([[4,0],[11,-8],[23,-6],[18,2],[7,4]],'#adf5ff');} dot(0,0,6,steel,ink); dot(-1,-1,3,'#f1ffff'); break;
    case 3: plate(0,-6,24,12,'#763972'); polygon([[16,0],[24,-10],[32,0],[24,10]],'#ff89cf'); line([[20,0],[25,-5],[28,0]],2,'#ffecff'); break;
    case 4: for(const y of [-9,9]){plate(0,y-3,21,6,'#936dcc');for(const x of [6,11,16])plate(x,y-5,3,10,brass);dot(23,y,5,'#d0afff',ink);} line([[24,-6],[20,-1],[26,1],[23,6]],2,'#fbf1ff'); break;
    case 5: for(const y of [-8,0,8])barrel(2,y,25,5,steel);plate(7,-12,5,24,brass);for(let i=0;i<4;i++)dot(-i*3,12,2.5,brass,ink);break;
    case 6: plate(-10,-10,28,22,'#566756',5);dot(13,-1,12,steel,ink);dot(14,-2,8,ink,brass);dot(12,-4,4,'#494653'); line([[6,-8],[12,-11],[19,-9]],2,'#dbebe8');for(const y of [-14,13])plate(-13,y,15,5,brass);break;
    case 7: for(const y of [-6,6])barrel(1,y,25,7,'#496e93');line([[-13,8],[-13,-24]],2,brass);polygon([[-12,-24],[0,-21],[-12,-15]],'#ff6461');break;
  }
  ctx.restore();
  ctx.save();ctx.translate(-8,1);ctx.lineWidth=1.4;
  dot(0,0,10,'#dda562',ink);dot(-2,-2,7,'#f6cc8b');dot(-4,4,1,'#ad7847');dot(0,5,1,'#ad7847');
  for(const x of [-3,4])dot(x,-1,1.6,ink);
  const t=tower.type;
  if(t===0){polygon([[-12,-5],[-7,-8],[-5,-15],[4,-15],[7,-9],[12,-6]],'#edc965');line([[-6,-9],[6,-9]],2,'#488454');}
  if(t===1){plate(-9,-10,18,6,'#754931');for(const x of [-4,4])dot(x,-7,3.8,'#80e0ef',ink);}
  if(t===2){plate(-9,-14,18,9,'#5fbfd4',4);dot(0,-15,3,'#e5ffff');plate(-11,4,18,5,'#b7f7ff');}
  if(t===3){plate(-9,-5,20,6,'#743167');line([[-4,-3],[7,-3]],2,'#ffa8dc');}
  if(t===4){for(const x of [-7,0,7])polygon([[x-4,-7],[x,-17],[x+4,-7]],'#e4c5ff');dot(-8,0,3,brass,ink);}
  if(t===5){plate(-11,-10,22,6,'#bc383f');polygon([[-9,-7],[-16,-5],[-13,-1]],'#da5149');}
  if(t===6){plate(-10,-13,20,10,'#667c58',5);plate(-11,-7,22,4,'#899776');dot(3,-10,2,brass);}
  if(t===7){polygon([[-10,-6],[-11,-16],[-4,-12],[0,-19],[5,-12],[10,-16],[9,-6]],brass);dot(0,-10,2,'#44c8cf');}
  ctx.restore();
  for(let i=0;i<(tower.a||0);i++)polygon([[-16+i*6,15],[-14+i*6,10],[-12+i*6,15]],brass);
  for(let i=0;i<(tower.b||0);i++)dot(16-i*5,13,2,'#76f3f3',ink);
  ctx.restore();
};
