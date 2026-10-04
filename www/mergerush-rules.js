(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MergeRushRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const directions=['left','right','up','down'];
  function slide(board,dir){
    if(!directions.includes(dir))return {board:board.slice(),changed:false,merges:0,biggest:0};
    const next=Array(16).fill(0);let merges=0,biggest=0;
    for(let n=0;n<4;n++){
      const indices=Array.from({length:4},(_,k)=>dir==='left'?n*4+k:dir==='right'?n*4+3-k:dir==='up'?k*4+n:(3-k)*4+n);
      const line=indices.map(i=>board[i]).filter(Boolean),out=[];
      for(let k=0;k<line.length;k++){if(line[k]===line[k+1]){const value=line[k]*2;out.push(value);merges++;biggest=Math.max(biggest,value);k++;}else out.push(line[k]);}
      indices.forEach((i,k)=>next[i]=out[k]||0);
    }
    return {board:next,changed:board.some((v,i)=>v!==next[i]),merges,biggest};
  }
  const canMove=board=>directions.some(dir=>slide(board,dir).changed);
  const budget=target=>target/2+16;
  function create(random=Math.random){
    let state={board:Array(16).fill(0),score:0,moves:0,left:48,target:64,cleared:0,merges:0,bestMerge:0,combo:0,bestCombo:0,next:2,over:false,reason:''};
    function spawn(){const empty=state.board.map((v,i)=>v?null:i).filter(i=>i!==null);if(!empty.length)return;state.board[empty[Math.min(empty.length-1,Math.floor(random()*empty.length))]]=state.next;state.next=random()<.9?2:4;}
    spawn();spawn();
    return {snapshot:()=>({...state,board:state.board.slice()}),move(dir){
      if(state.over||!directions.includes(dir))return {...this.snapshot(),changed:false,clearedNow:false};
      const result=slide(state.board,dir);state.board=result.board;state.moves++;state.left--;
      state.merges+=result.merges;state.bestMerge=Math.max(state.bestMerge,result.biggest);state.combo=result.merges?state.combo+1:0;state.bestCombo=Math.max(state.bestCombo,state.combo);
      let clearedNow=false;
      if(result.changed){
        if(Math.max(...state.board)>=state.target){state.score+=100*Math.pow(2,state.cleared);state.cleared++;state.target*=2;state.left=budget(state.target);clearedNow=true;}
        spawn();
      }
      if(state.left<=0||!canMove(state.board)){state.over=true;state.reason=state.left<=0?'Out of Swipes':'No More Moves';}
      return {...this.snapshot(),changed:result.changed,clearedNow,biggest:result.biggest,swipeMerges:result.merges};
    }};
  }
  return {slide,canMove,create,directions,budget};
});
