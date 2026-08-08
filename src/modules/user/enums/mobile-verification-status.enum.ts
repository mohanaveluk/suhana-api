// Lifecycle of a single mobile_verification_otp row.
//
// PENDING  — issued, still inside its expiry window, awaiting the user's code.
// VERIFIED — the correct code was submitted; terminal success state.
// EXPIRED  — timed out, or superseded by a newer OTP for the same user.
// FAILED   — the attempt ceiling was reached; terminal failure state.
//
// Only PENDING rows are candidates for verification.
export enum MobileVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}
