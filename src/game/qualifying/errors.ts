/**
 * T04 — typed refusals for the qualifying layer.
 *
 * The T01 contract freezes `ContractErrorCode`, and the rules in `docs/CONTRACTS.md` say a new code
 * means a `CONTRACTS_VERSION` bump in the same change. T04 does not own that bump, so qualifying
 * failures are typed *here*, with their own stable codes, and nothing inside `contracts/` is edited.
 * Anything the contract already refuses (a bad entry shape, an illegal crossing) still surfaces as a
 * `ContractError` with its own code.
 */
export type QualifyingErrorCode =
  | 'E_GATE_MISSING'
  | 'E_FIELD_EMPTY'
  | 'E_NO_HUMAN'
  | 'E_ATTEMPT_COMPLETE';

export class QualifyingError extends Error {
  readonly code: QualifyingErrorCode;
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(code: QualifyingErrorCode, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = 'QualifyingError';
    this.code = code;
    this.detail = Object.freeze({ ...detail });
  }
}

export const isQualifyingError = (value: unknown): value is QualifyingError => value instanceof QualifyingError;
