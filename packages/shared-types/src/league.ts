export interface League {
  /** League id as used by the trade API, e.g. "Standard". */
  readonly id: string;
  /** Display name shown to the user. */
  readonly text: string;
  readonly realm: 'pc';
}
