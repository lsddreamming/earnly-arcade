/** Fixed classifications only; never carry upstream responses or credentials. */
export class WorldAccessError extends Error {
  readonly reason:'server_configuration'|'sign_in_required'|'confirmed_account_required';
  constructor(reason:WorldAccessError['reason']){
    super('World access unavailable');this.reason=reason;
  }
}
