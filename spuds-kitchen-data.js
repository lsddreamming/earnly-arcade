export const chains = [
  [
    "Copper espresso bar",
    "Coffee cherry|Roasted beans|Ground coffee|Ristretto|Espresso|Cortado|Flat white|Honey latte|Mocha cloud|Affogato",
  ],
  [
    "Stone hearth",
    "Wheat ear|Milled flour|Soft dough|Dinner roll|Milk bun|Olive loaf|Baguette|Brioche knot|Braided challah|Harvest crown",
  ],
  [
    "Pastry bench",
    "Butter curl|Pastry sheet|Sugar twist|Berry pocket|Palmier|Croissant|Almond crescent|Pistachio swirl|Pear lattice|Bakery bouquet",
  ],
  [
    "Orchard press",
    "Apple slice|Apple fan|Pressed juice|Cloudy cider|Berry spritz|Peach nectar|Orchard punch|Apple granita|Sparkling carafe|Harvest cooler",
  ],
  [
    "Diner griddle",
    "Potato wedge|Hash coins|Crispy patty|Breakfast stack|Pepper skillet|Egg melt|Brunch burger|Double decker|Sunrise platter|Diner feast",
  ],
  [
    "Shake mixer",
    "Vanilla bean|Cream scoop|Soft swirl|Malted milk|Strawberry shake|Chocolate float|Cherry sundae|Banana split|Soda fountain tower|Starlight special",
  ],
].map(([station, items]) => ({ station, items: items.split("|") }));
export const venues = [
  {
    name: "Spud’s Coffee Corner",
    level: 1,
    chains: [0, 1],
    detail: "A corner café with copper pots and misty windows.",
    colors: ["#34786c", "#bc794f"],
    story: "Pip found the key under the flour sack. The first coffee is on us.",
  },
  {
    name: "Small-Town Bakery",
    level: 8,
    chains: [2, 3],
    detail: "A stone bakehouse tucked inside an apple orchard.",
    colors: ["#738349", "#aa614e"],
    story:
      "Aunt Rye saved her best oven for you. Can you smell the apple trees?",
  },
  {
    name: "Classic American Diner",
    level: 20,
    chains: [4, 5],
    detail: "A chrome lunch counter on the moonlit highway.",
    colors: ["#47748f", "#aa4957"],
    story:
      "Dot flips the OPEN sign. The night shift already has a favorite booth.",
  },
];
export const balance = { maxEnergy: 100, regen: 120000, maxLevel: 1000 };
export const name = (id) => chains[Math.floor(id / 10)].items[id % 10];
const menus = [
  [
    "Churn room",
    "Sweet cream|Frozen custard|Vanilla scoop|Honey cone|Praline cup|Mint stracciatella|Peach ripple|Pistachio basket|Baked Alaska|Glacier bombe",
  ],
  [
    "Pizza oven",
    "Semolina|Pizza dough|Garlic knot|Tomato pizzetta|Margherita|Mushroom bianca|Calzone|Burrata pie|Truffle wheel|Piazza banquet",
  ],
  [
    "Pasta roller",
    "Durum wheat|Dough ribbon|Tagliatelle|Penne pomodoro|Pesto shells|Ricotta ravioli|Pumpkin tortelli|Seafood linguine|Porcini lasagna|Sunday timballo",
  ],
  [
    "Bayou stove",
    "Bell pepper|Diced trinity|Brown roux|Okra stew|Chicken gumbo|Smoked jambalaya|Crawfish étouffée|Boudin platter|Duck gumbo|Bayou supper",
  ],
  [
    "Cast iron fryer",
    "Cornmeal|Corn batter|Fritter|Hush puppy|Fried pickle|Catfish bite|Oyster basket|Shrimp po-boy|Seafood pirogue|Festival platter",
  ],
  [
    "Tortilla press",
    "Maize|Masa|Corn tortilla|Tostada|Bean taco|Cheese quesadilla|Mole enchilada|Stuffed poblano|Birria spread|Cantina feast",
  ],
  [
    "Salsa stone",
    "Tomatillo|Charred pepper|Pico cup|Salsa verde|Mango salsa|Guacamole|Roasted corn dip|Pepita salsa|Seven salsa flight|Fiesta tray",
  ],
  [
    "Island grill",
    "Plantain|Plantain chip|Tostones|Grilled pineapple|Jerk skewer|Coconut rice|Island ribs|Firefish plate|Sunset lobster|Beachside feast",
  ],
  [
    "Tiki blender",
    "Lime wedge|Guava pulp|Mango nectar|Papaya crush|Pineapple slush|Coconut cooler|Passionfruit fizz|Dragonfruit freeze|Lagoon punch|Paradise pitcher",
  ],
  [
    "Dockside kettle",
    "Shrimp|Peeled shrimp|Shrimp stock|Boiled shrimp|Crab cup|Blue crab bisque|Butter crab claws|Stuffed flounder|Royal seafood boil|Harbor feast",
  ],
  [
    "Oyster bar",
    "Lemon|Mignonette|Half shell|Chargrilled oyster|Oyster toast|Oyster brochette|Crab gratin|Rockefeller plate|Gulf tower|Pearl banquet",
  ],
  [
    "Smoke pit",
    "Hickory chip|Spice rub|Smoked link|Pulled pork|Burnt ends|Baby back ribs|Pepper brisket|Pitmaster sandwich|Smoke ring platter|Low and slow feast",
  ],
  [
    "Pickling crock",
    "Cucumber|Salted spear|Dill chips|Pickled onion|Pepper relish|Mustard slaw|Bread and butter jar|Chow chow|Farmhouse board|Cellar collection",
  ],
  [
    "Sushi counter",
    "Rice grain|Seasoned rice|Cucumber maki|Tamago nigiri|Salmon nigiri|Avocado roll|Eel dragon roll|Rainbow futomaki|Chirashi bowl|Omakase boat",
  ],
  [
    "Tea house",
    "Tea leaf|Steamed sencha|Genmaicha|Hojicha|Matcha bowl|Cold brew gyokuro|Yuzu tea|Sakura latte|Ceremonial matcha|Garden tea service",
  ],
  [
    "Street wok",
    "Scallion|Ginger oil|Garlic greens|Egg fried rice|Sesame noodles|Black bean tofu|Pepper beef|Ginger sea bass|Crispy roast duck|Lantern feast",
  ],
  [
    "Bamboo steamer",
    "Dumpling flour|Wrapper|Chive parcel|Pork shumai|Shrimp har gow|Soup dumpling|Lotus leaf rice|Char siu bao|Jade dumpling basket|Dim sum banquet",
  ],
  [
    "Patisserie",
    "Almond meal|Choux paste|Cream puff|Financier|Éclair|Paris Brest|Mille feuille|Opera slice|Croquembouche|Gilded entremets",
  ],
  [
    "Chocolate bench",
    "Cacao nib|Cocoa butter|Ganache|Chocolate button|Salted truffle|Hazelnut praline|Cherry cordial|Gold bonbon|Chocolate sculpture|Salon assortment",
  ],
  [
    "Steak broiler",
    "Peppercorn|Herb butter|Beef medallion|Flank steak|Sirloin|Strip steak|Ribeye|Filet mignon|Porterhouse|Chateaubriand",
  ],
  [
    "Chef’s pass",
    "Herb sprig|Shallot confit|Velouté|Leek terrine|Quail egg toast|Truffle risotto|Duck à l’orange|Morel roulade|Saffron tasting plate|Rooftop degustation",
  ],
  [
    "Lodge hearth",
    "Wild mushroom|Forest broth|Barley soup|Rye toast|Cheese raclette|Alpine rösti|Venison stew|Juniper roast|Fondue spread|Mountain supper",
  ],
  [
    "Studio bakery",
    "Sugar crystal|Cookie dough|Star cookie|Red velvet bite|Spotlight cupcake|Lemon chiffon|Gold leaf tart|Marquee cake|Premiere tower|Silver screen gâteau",
  ],
  [
    "Resort fruit bar",
    "Lychee|Starfruit|Rambutan cup|Mangosteen bowl|Papaya boat|Kiwi parfait|Guava sorbet|Hibiscus jelly|Tropical pavlova|Island fruit crown",
  ],
  [
    "Palace kitchen",
    "Saffron strand|Rose syrup|Pistachio rice|Cardamom pudding|Apricot pilaf|Saffron lamb|Jeweled couscous|Rosewater baklava|Royal mezze|Palace banquet",
  ],
  [
    "Festival kitchen",
    "Cinnamon stick|Spiced biscuit|Heart shortbread|Spring nest|Summer berry tart|Pumpkin pasty|Harvest galette|Gingerbread chalet|Midwinter roulade|Festival centerpiece",
  ],
];
for (const [station, list] of menus)
  chains.push({ station, items: list.split("|") });
const destinations = [
  [
    "Ice Cream Paradise",
    32,
    [6, 5],
    "A seaside ice cream parlor with a shell mosaic.",
  ],
  [
    "Italian Pizza Kitchen",
    46,
    [7, 8],
    "A courtyard trattoria with a wood-fired dome.",
  ],
  [
    "Louisiana Cajun Kitchen",
    62,
    [9, 10],
    "A cypress cookhouse beside the bayou.",
  ],
  [
    "Mexican Cantina",
    80,
    [11, 12],
    "A tiled kitchen overlooking a market plaza.",
  ],
  [
    "Tropical Beach Bar & Grill",
    100,
    [13, 14],
    "A palm-roof grill above the tide line.",
  ],
  [
    "New Orleans Seafood House",
    125,
    [15, 16],
    "A balcony oyster house overlooking the Quarter.",
  ],
  [
    "Southern Barbecue Smokehouse",
    155,
    [17, 18],
    "A timber smokehouse with a screened porch.",
  ],
  [
    "Tokyo Sushi Restaurant",
    190,
    [19, 20],
    "A cedar counter beside a lantern-lit canal.",
  ],
  [
    "Chinese Street Food Kitchen",
    230,
    [21, 22],
    "A night-market stall under red lanterns.",
  ],
  [
    "French Pastry Café",
    275,
    [23, 24],
    "A glass-front pastry salon beside the gardens.",
  ],
  [
    "New York Steakhouse",
    325,
    [25, 18],
    "A brick dining room under the city railway.",
  ],
  [
    "Luxury Rooftop Restaurant",
    385,
    [26, 24],
    "An open terrace above the skyline.",
  ],
  [
    "Mountain Lodge Restaurant",
    450,
    [27, 1],
    "A fireside dining room on the snowy ridge.",
  ],
  [
    "Hollywood Celebrity Café",
    530,
    [28, 5],
    "An Art Deco lobby at the picture palace.",
  ],
  [
    "Tropical Island Resort",
    625,
    [29, 14],
    "An overwater pavilion in a coral lagoon.",
  ],
  [
    "Royal Palace Restaurant",
    750,
    [30, 23],
    "A saffron-scented hall in the palace garden.",
  ],
  [
    "Grand International Food Resort",
    900,
    [31, 26],
    "A festival pavilion where all your chefs gather.",
  ],
];
for (const [name, level, stationIds, detail] of destinations)
  venues.push({
    name,
    level,
    chains: stationIds,
    detail,
    colors: ["#52756c", "#ad704b"],
    story: "Pip unlocks the door. " + detail,
  });
