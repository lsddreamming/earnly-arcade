/** In-memory protocol state only. The repository must recheck ownership/reservations
 * and commit both sides in ONE database transaction keyed by tradeId + revision.
 */
export interface TradeRepository {
  exchange(tradeId:string,revision:number,offers:ReadonlyArray<{userId:string;items:readonly string[]}>):Promise<void>;
}
export class TradeSession {
  readonly id:string;
  readonly participants:readonly string[];
  #offers = new Map<string,string[]>();
  #locked = new Set<string>();
  #confirmed = new Set<string>();
  #revision=0;
  #status:'open'|'committing'|'complete'|'cancelled'='open';
  constructor(id:string,a:string,b:string){
    if(!id||!a||!b||a===b)throw new Error('Invalid trade');
    this.id=id;this.participants=Object.freeze([a,b]);this.#offers.set(a,[]);this.#offers.set(b,[]);
  }
  snapshot(){return {id:this.id,revision:this.#revision,status:this.#status,offers:this.participants.map(userId=>({userId,items:[...this.#offers.get(userId)!],locked:this.#locked.has(userId),confirmed:this.#confirmed.has(userId)}))};}
  #check(userId:string,revision:number){
    if(!this.participants.includes(userId)||revision!==this.#revision||this.#status!=='open')throw new Error('Stale or unauthorized trade');
  }
  edit(userId:string,revision:number,items:readonly string[]){
    this.#check(userId,revision);
    if(!Array.isArray(items)||items.length>12||items.some(i=>typeof i!=='string'||!i||i.length>128)||new Set(items).size!==items.length)throw new Error('Invalid offer');
    this.#offers.set(userId,[...items]);this.#revision++;this.#locked.clear();this.#confirmed.clear();
    return this.snapshot();
  }
  lock(userId:string,revision:number){this.#check(userId,revision);this.#locked.add(userId);return this.snapshot();}
  cancel(userId:string,revision:number){this.#check(userId,revision);this.#status='cancelled';return this.snapshot();}
  async confirm(userId:string,revision:number,repository:TradeRepository){
    this.#check(userId,revision);
    if(this.#locked.size!==2)throw new Error('Both offers must be locked');
    this.#confirmed.add(userId);
    if(this.#confirmed.size!==2)return this.snapshot();
    this.#status='committing';
    try{
      await repository.exchange(this.id,this.#revision,this.participants.map(id=>({userId:id,items:[...this.#offers.get(id)!]})));
      this.#status='complete';
    }catch(error){
      // An ambiguous timeout may already have committed. Never reopen an editable
      // offer: reconcile this immutable trade using its idempotency key instead.
      throw error;
    }
    return this.snapshot();
  }
}
