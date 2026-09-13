/**
 * The contract every provider's `auth.ts` implements.
 *
 * A provider returns every account the person could connect rather than one, because
 * someone who administers several Pages has to be asked which — silently taking the
 * first is how a post ends up on the wrong brand.
 */
export interface ConnectableAccount {
  externalAccountId: string;
  handle: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  followers?: number | null;
  scopes?: string[];
  /** The token used to act on this account specifically. */
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  /** Extra context for the picker, e.g. the Page an Instagram account is linked to. */
  subtitle?: string | null;
}

export interface ExchangeResult {
  /**
   * The provider's id for the person who authorised. Stored so a deauthorize or
   * data-deletion callback can be matched back to the accounts it affects.
   */
  providerUserId: string | null;
  /** Held briefly while the picker is open, so candidates can be re-listed on selection. */
  userToken: string;
  candidates: ConnectableAccount[];
}
