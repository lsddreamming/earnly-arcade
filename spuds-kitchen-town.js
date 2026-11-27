import { venues, name } from "./spuds-kitchen-data.js";

const neighborhoods = `Bayou Landing|The mailboat brings six shutters and a letter asking for supper on the water.|Mailboat Café|Cypress Canoes|Pelican Post|Porchlight Records|Reed Basket Market|Firefly Dock
Magnolia Square|Dot finds the old dance card. Someone has circled every Friday.|Tea Porch|Ribbon Shop|Magnolia Florist|Bandstand|Dance Hall|Moon Garden
Switchyard|A conductor needs packed lunches before the midnight train can run again.|Lunch Car|Signal Box|Ticket Hall|Clock Repair|Rail Museum|Sleeper Hotel
Pelican Pier|Pip promises the fishing crews breakfast before the first ferry.|Bait Shop|Net Loft|Oyster Counter|Ferry Booth|Tackle Exchange|Harbor Beacon
Cinema Mile|An usher discovers the missing reel of the town’s first film.|Poster Press|Popcorn Cart|Costume Loft|Foley Studio|Projection Booth|Starlight Cinema
Pine Ridge|The trail crew hears bells from the abandoned lookout.|Trail Pantry|Boot Works|Map Room|Cabin Café|Ranger Lodge|Lookout Tower
Carnival Quay|The carousel organ plays one note. Every ride holds another pipe.|Ticket Wagon|Candy Kitchen|Ring Toss|Mirror Maze|Painted Carousel|Ferris Wheel
Copper Hill|An apprentice wants the silent foundry to cast one last bell.|Tool Library|Kiln House|Copper Kettle|Glass Studio|Smithy|Bell Tower
Orchard Bend|A lost cider recipe turns up on the back of a harvest poster.|Seed Library|Pear Stand|Jam Pantry|Cider Mill|Pie Barn|Harvest Hall
Coral Bay|A diver brings back a cracked tile from the first public aquarium.|Shell Studio|Dive Shack|Tide Pool|Coral Nursery|Seafood Terrace|Ocean Gallery
Bookbinder Lane|The last page of the town atlas has been left blank for you.|Ink Counter|Bindery|Reading Room|Paper Mill|Poetry Café|Atlas Library
Aurora Heights|Spuddy follows a penciled star chart into the hills.|Cable Station|Alpine Bakery|Snowshoe Shop|Aurora Lodge|Lens Workshop|Observatory
Melody Ward|Six musicians remember different verses of the same song.|Drum Shop|Jazz Kitchen|Brass Repair|Radio Booth|Vinyl Press|Jubilee Theater
Cloud Harbor|An old balloon pilot offers the cooks a view of every town they fed.|Canvas Loft|Weather Hut|Flight School|Sky Galley|Mooring Mast|Balloon Port
Champion Park|Moonpin’s first league challenges the whole county to play.|Skate Shop|Courtside Grill|Batting Cage|Swim Club|Roller Rink|Victory Arena
Festival Island|All sixteen crews return to set a place at one enormous table.|Welcome Wharf|Lantern Studio|Parade Garage|Festival Bakery|Grand Pavilion|Founders’ Table`.split("\n").map(row => {
  const [district, story, ...places] = row.split("|");
  return { district, story, places };
});

export function commission(step, chains) {
  const site = Math.floor(step / 4), district = Math.floor(site / 6);
  const phase = step % 4;
  const tier = Math.min(9, 3 + Math.floor(district / 2) + (phase === 3 ? 1 : 0));
  return { id: chains[(site + phase) % chains.length] * 10 + tier, count: 2 + Math.floor(district / 4) + phase % 2 };
}

function county(s, page, note, act) {
  const step = s.countyStep || 0, site = Math.floor(step / 4);
  const area = neighborhoods[Math.min(15, Math.floor(site / 6))];
  const h = document.createElement("h3");
  h.textContent = area.district;
  page.append(h);
  
  if (site < 96) {
    const venue = s.countyVenue ?? s.venue;
    const job = commission(step, venues[venue].chains);
    const delivered = s.countyDelivered || 0;
    const ready = s.board.filter(id => id === job.id).length;
    note("Next storefront: " + area.places[site % 6] + " · " + ["Feed the surveyors","Stock the workshop","Cater the crew lunch","Host opening night"][step % 4] + " · " + name(job.id) + " " + delivered + "/" + job.count);
    if (venue !== s.venue) note("Find these ingredients at " + venues[venue].name + ".");
    if (!ready) note("Back in the kitchen, merge ingredients to make "+name(job.id)+". Return here to deliver one at a time.");
    if (ready) act("Deliver " + name(job.id), () => {
      const at = s.board.indexOf(job.id);
      if ((s.countyStep || 0) !== step || at < 0) return;
      s.board[at] = null;
      s.countyVenue = venue;
      // Credit each contribution immediately so the player need not store a whole order.
      s.countyDelivered = (s.countyDelivered || 0) + 1;
      if (s.countyDelivered >= job.count) {
        s.countyStep = step + 1;
        delete s.countyVenue;
        s.countyDelivered = 0;
        s.money += 10 + Math.floor(site / 6) * 5;
      }
    });
  } else note("Founders’ Table is open. Every neighborhood is ready for festival night.");
  note(area.story);
  const atlas = document.createElement("details");
  const title = document.createElement("summary");
  title.textContent = "County atlas · " + (4 + site) + "/100 places open";
  atlas.append(title);
  neighborhoods.forEach(({district, places}, index) => {
    const row = document.createElement("p");
    const count = Math.max(0, Math.min(6, site - index * 6));
    row.textContent = district + " · " + count + "/6 · " + places.map((place,i) => (i < count ? "✓ " : "") + place).join(" · ");
    atlas.append(row);
  });
  page.append(atlas);
}
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


  const next=stops[open];
  if(next){
    note("Your goal · Reopen "+next.name);
    const remaining = Math.max(0, next.orders - s.served);
    if (remaining) note("Serve "+remaining+" more customer"+(remaining === 1 ? "" : "s")+" in the kitchen.");
    else if (s.money < next.cost) note("Earn $"+(next.cost-s.money)+" more by serving customers.");
    note("Next opening · "+next.name+" · Orders "+Math.min(s.served,next.orders)+"/"+next.orders+" · Restaurant cash $"+s.money+"/$"+next.cost);
    if(s.served>=next.orders && s.money>=next.cost)act("Reopen "+next.name,()=>{if((s.townOpen||0)===open && s.money>=next.cost){s.money-=next.cost;s.townOpen=open+1;}});
  }
  if (open === stops.length) county(s, page, note, act);
  else note("Restore Lantern Row to open the county atlas: 16 more neighborhoods await.");
  page.insertAdjacentHTML("beforeend", skyline(open));
  if (open) note(stops[open-1].line);
  let optional;
  if (open) {
    optional = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Optional stops · shop deliveries & mini-games";
    optional.append(summary);
    page.append(optional);
    const heading = document.createElement("h3");
    heading.textContent = "Optional stops";
    page.append(heading);
    note("Shop deliveries earn restaurant cash. Arcade and bowling games save your best score. You can skip them and keep rebuilding.");
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
      note(bowling ? "Tap Roll ball when the ball reaches the gold stripe. Three rolls, up to 30 pins." : "Tap Catch spark when the spark reaches the gold stripe. Three catches, up to 300 points.");
      const start=document.createElement("button");start.textContent=(bowling?"Play three rolls":"Play Spark Catch")+" · Best "+(s[key]||0);
      const stage=document.createElement("div");page.append(start,stage);
      start.onclick=()=>{start.disabled=true;stage.replaceChildren();playRound(stage,bowling,s[key]||0,total=>{s[key]=Math.max(s[key]||0,total);save();start.textContent=(bowling?"Play three rolls":"Play Spark Catch")+" · Best "+s[key];start.disabled=false;});};
    }
  }
  while (optional?.nextSibling) optional.append(optional.nextSibling);
}
