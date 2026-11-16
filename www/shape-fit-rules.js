/* Rotation families and bounded round generation, shared by browser and tests. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.ShapeFitRules = rules;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const shapes = [
    {name:'L',cells:[[0,0],[0,1],[0,2],[1,2]]},
    {name:'T',cells:[[0,0],[1,0],[2,0],[1,1]]},
    {name:'Square',cells:[[0,0],[1,0],[0,1],[1,1]]},
    {name:'Zigzag',cells:[[0,0],[1,0],[1,1],[2,1]]},
    {name:'Line',cells:[[0,0],[1,0],[2,0],[3,0]]},
    {name:'Corner',cells:[[0,0],[0,1],[1,1]]}
  ];
  function rotate(cells, turns = 0) {
    let out = cells.map(([x,y]) => [x,y]);
    for (let turn = 0; turn < turns % 4; turn++) out = out.map(([x,y]) => [3-y,x]);
    const minX = Math.min(...out.map(p => p[0])), minY = Math.min(...out.map(p => p[1]));
    return out.map(([x,y]) => [x-minX,y-minY]);
  }
  const signature = cells => cells.map(p => p.join(',')).sort().join('|');
  function shuffle(items, random) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.max(0, Math.min(i, Math.floor(random() * (i+1))));
      [out[i],out[j]] = [out[j],out[i]];
    }
    return out;
  }
  function round(number, random = Math.random) {
    const n = Math.max(1, Math.floor(Number(number) || 1));
    const pick = count => Math.max(0, Math.min(count-1, Math.floor(random()*count)));
    const base = shapes[pick(shapes.length)], turns = n < 4 ? 0 : pick(4);
    const target = {name:base.name,cells:rotate(base.cells,turns)};
    const correct = {name:base.name,cells:rotate(base.cells,n < 4 ? turns : (turns+1+pick(3))%4)};
    const count = n <= 3 ? 3 : n <= 7 ? 4 : n <= 13 ? 6 : 8;
    // Enumerate before sampling: even a repeated RNG value cannot hang a round
    // or produce two answers from the target's rotation family.
    const alternatives = [];
    for (const shape of shapes) {
      if (shape === base) continue;
      const seen = new Set();
      for (let rotation = 0; rotation < 4; rotation++) {
        const cells = rotate(shape.cells,rotation), key = signature(cells);
        if (!seen.has(key)) { seen.add(key); alternatives.push({name:shape.name,cells}); }
      }
    }
    return {
      number:n, target,
      choices:shuffle([correct,...shuffle(alternatives,random).slice(0,count-1)],random),
      duration:n <= 3 ? 7000 : Math.max(2800,6600-(n-3)*220),
      stage:n <= 3 ? 'Warm-up' : n <= 8 ? 'Rotation challenge' : n <= 15 ? 'Quick Match' : 'Expert Shapes'
    };
  }
  const nextGoal = score => [5,10,20,35,50].find(n => n > score) || (Math.floor(score/25)+1)*25;
  return {shapes,rotate,signature,round,nextGoal};
});
