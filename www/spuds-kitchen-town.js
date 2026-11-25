const stops = [
  { name: "Pip’s Night Market", sign: "MARKET", color: "#e87c52", orders: 1, cost: 5, line: "Pip unfolds the striped awning. Inside a dusty crate he finds a brass token stamped LAST LIGHT.", item: 1 },
  { name: "Last Light Arcade", sign: "ARCADE", color: "#885abe", orders: 5, cost: 20, line: "Dot slips the token into a dark cabinet. The screen hums awake. Its high-score initials spell LANES." },
  { name: "Moonpin Lanes", sign: "BOWL", color: "#287eaa", orders: 12, cost: 45, line: "Roux rolls the first ball in years. Behind pin ten is Marlo’s old supper-club invitation." },
  { name: "Marlo’s Moonrise Diner", sign: "DINER", color: "#db4969", orders: 24, cost: 90, line: "Marlo flips the OPEN sign. Every window on the block lights up for the first Friday Night Supper Club.", item: 2 }
];

function skyline(open) {
  const shops = stops.map((place, i) => {
    const x = 8 + 78 * i, color = i < open ? place.color : "#526279";
    const trim = i < open ? "#ffd77b" : "#84929e";
    const roof = [
      '<path d="M0 39l5-14h55l6 14z" fill="' + trim + '"/><path d="M12 38l3-13m12 13 1-13m15 13-1-13m15 13-3-13" stroke="' + color + '" stroke-width="6"/>',
      '<path d="M3 25V13h8V7h44v6h8v12" fill="' + color + '"/>',
      '<ellipse cx="32" cy="20" rx="20" ry="14" fill="' + trim + '"/><circle cx="32" cy="15" r="8" fill="' + color + '"/>',
      '<path d="M0 34q0-18 14-18h38q14 0 14 18z" fill="' + trim + '"/>'
    ][i];
    return '<g transform="translate('+x+' 27)"><rect x="2" y="24" width="62" height="53" rx="4" fill="'+color+'"/>'+roof+'<rect x="9" y="42" width="48" height="13" rx="3" fill="#263443"/><text x="33" y="52" text-anchor="middle" font-size="9" font-weight="bold" fill="'+trim+'">'+place.sign+'</text><path d="M9 61h20v12H9zm28 0h14v16H37z" fill="'+trim+'"/></g>';
  }).join("");
  return '<svg role="img" aria-label="Lantern Row, '+open+' of four storefronts lit" viewBox="0 0 320 118" style="display:block;width:100%;border-radius:12px"><rect width="320" height="118" fill="#334969"/><circle cx="275" cy="19" r="10" fill="#ffe4a0"/><path d="M0 9q80 32 160 0t160 0" fill="none" stroke="#172a39"/>'+[20,55,90,125,160,200,240].map((x,i)=>'<circle cx="'+x+'" cy="'+[16,23,24,20,10,0,0][i]+'" r="3" fill="#ffe296"/>').join("")+'<path d="M0 99h320v19H0z" fill="#b98169"/>'+shops+'</svg>';
}

function playRound(page, bowling, record, finish) {
  const arena = document.createElement("section");
  const guide = document.createElement("p"), track = document.createElement("div"), marker = document.createElement("span"), shot = document.createElement("button");
  guide.textContent = bowling ? "Roll when the ball crosses the gold center stripe. Three rolls, ten pins each." : "Catch the spark in the gold zone. Three tries to beat your score.";
  track.style.cssText = "position:relative;overflow:hidden;height:32px;border-radius:16px;background:linear-gradient(90deg,#27435c 40%,#ffd476 40% 60%,#27435c 60%);";
  marker.style.cssText = "position:absolute;inset:3px auto 3px 0;width:26px;border-radius:50%;background:radial-gradient(at 30% 25%,#fff,#67ced2 40%,#167092);";
  track.append(marker);
  shot.textContent = bowling ? "Roll ball" : "Catch spark";
  arena.append(guide,track,shot);
  page.append(arena);
  const motion = marker.animate([{left:"0%"},{left:"calc(100% - 26px)"}],{duration:bowling?1150:830,direction:"alternate",iterations:Infinity});
  let tries=0, total=0;
  shot.onclick = () => {
    if (tries >= 3) return;
    const a=marker.getBoundingClientRect(), b=track.getBoundingClientRect();
    const offset=Math.abs((a.left+a.width/2-b.left)/b.width-.5);
    const score=bowling?Math.max(0,10-Math.floor(offset*24)):offset<=.10?100:offset<=.20?50:0;
    total+=score; tries++;
    guide.textContent="Attempt "+tries+"/3 · "+score+(bowling?" pins":" points")+" · Total "+total;
    if(tries===3){motion.cancel();shot.disabled=true;guide.textContent+=" · Personal best "+Math.max(record,total);finish(total);}
  };
}

export function showTown(s, page, note, act, save) {
  const open=s.townOpen || 0;
  page.insertAdjacentHTML("beforeend", skyline(open));
  note(open ? stops[open-1].line : "Spuddy finds four empty sockets on Lantern Row’s festival sign. The businesses that used to light them have closed. One supper order will help Pip reopen the first stall.");
  const next=stops[open];
  if(next){
    note("Next opening · "+next.name+" · Orders "+Math.min(s.served,next.orders)+"/"+next.orders+" · Restaurant cash $"+s.money+"/$"+next.cost);
    if(s.served>=next.orders && s.money>=next.cost)act("Reopen "+next.name,()=>{if((s.townOpen||0)===open && s.money>=next.cost){s.money-=next.cost;s.townOpen=open+1;}});
  }
  for(const place of stops.slice(0,open)){
    const h=document.createElement("h3");h.textContent=place.name;page.append(h);
    if(place.item!==undefined){
      const item=place.item===1?"milled flour":"soft dough";
      const at=s.board.indexOf(place.item+10);
      note("Counter order · Deliver "+item+" for $"+(place.item*4)+".");
      if(at>=0)act("Deliver "+item,()=>{if(s.board[at]===place.item+10){s.board[at]=null;s.money+=place.item*4;}});
    }else{
      const bowling=place.sign==="BOWL", key=bowling?"bowlingBest":"arcadeBest";
      const start=document.createElement("button");start.textContent=(bowling?"Play three rolls":"Play Spark Catch")+" · Best "+(s[key]||0);
      const stage=document.createElement("div");page.append(start,stage);
      start.onclick=()=>{start.disabled=true;stage.replaceChildren();playRound(stage,bowling,s[key]||0,total=>{s[key]=Math.max(s[key]||0,total);save();start.textContent=(bowling?"Play three rolls":"Play Spark Catch")+" · Best "+s[key];start.disabled=false;});};
    }
  }
}
