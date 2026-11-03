const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync('blockdrop.html','utf8');
function setup(width=300){
 const handlers={}; let now=0;
 const state={game:1,starting:false,pieceSerial:1,pieceX:4,cols:10,drops:0,rotations:0,
 performance:{now:()=>now},canvas:{classList:{add(){},remove(){}},getBoundingClientRect:()=>({width}),setPointerCapture(){},releasePointerCapture(){},addEventListener:(name,fn)=>handlers[name]=fn},
 moveLeft(){state.pieceX=Math.max(0,state.pieceX-1)},moveRight(){state.pieceX=Math.min(8,state.pieceX+1)},moveDown(){state.drops++},rotatePiece(){state.rotations++}};
 vm.createContext(state);
 vm.runInContext(html.slice(html.indexOf('    let blockDragPointer = null;'),html.indexOf("    canvas.addEventListener('contextmenu'")),state);
 return {state,advance:ms=>now+=ms,fire:(name,x,y=100,id=1)=>handlers[name]({pointerId:id,clientX:x,clientY:y,isPrimary:true,pointerType:'touch',preventDefault(){}})};
}
for(const width of [180,225,300])test('grid tracking and diagonal safety at '+width,()=>{
 const t=setup(width),cell=width/10;t.fire('pointerdown',100);
 t.fire('pointermove',100+cell*2.4,115);assert.equal(t.state.pieceX,6);assert.equal(t.state.drops,0);
 t.fire('pointermove',100+cell*3.1,140);assert.equal(t.state.pieceX,7);assert.equal(t.state.drops,0);
 t.fire('pointermove',100+cell*1.9,140);assert.equal(t.state.pieceX,6);
 t.fire('pointerup',100+cell*1.9,140);assert.equal(t.state.rotations,0);
});
test('holding does not rotate, quick tap does',()=>{const t=setup();t.fire('pointerdown',100);t.advance(500);t.fire('pointerup',100);assert.equal(t.state.rotations,0);t.fire('pointerdown',100);t.fire('pointerup',100);assert.equal(t.state.rotations,1)});
test('old gesture cannot move a newly spawned piece',()=>{const t=setup();t.fire('pointerdown',100);t.state.pieceSerial++;t.fire('pointermove',200);assert.equal(t.state.pieceX,4)});
test('cancel and capture loss stop movement',()=>{for(const event of ['pointercancel','lostpointercapture']){const t=setup();t.fire('pointerdown',100);t.fire(event,100);t.fire('pointermove',200);assert.equal(t.state.pieceX,4)}});
test('downward gesture only lowers and stops on next piece',()=>{const t=setup();t.state.moveDown=()=>{t.state.drops++;t.state.pieceSerial++};t.fire('pointerdown',100);t.fire('pointermove',105,250);assert.equal(t.state.drops,1);assert.equal(t.state.pieceX,4)});
test('wall overshoot can reverse immediately',()=>{const t=setup();t.fire('pointerdown',100);t.fire('pointermove',600);assert.equal(t.state.pieceX,8);t.fire('pointermove',569);assert.equal(t.state.pieceX,7)});
test('native copy matches and inline scripts parse',()=>{assert.equal(fs.readFileSync('www/blockdrop.html','utf8'),html);for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script)});
