const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/;

/** Normalize punctuation while requiring an explicit country code in E.164 form. */
export function normalizeAuthPhoneNumber(value: string): string {
  const normalized = value.trim().replace(/[^\d+]/g, "");
  if (!INTERNATIONAL_PHONE.test(normalized)) {
    throw new Error("Enter your phone number with its country code, for example +256 7xx xxx xxx.");
  }
  return normalized;
}

/** Identify missing-user responses so the UI does not disclose whether a number is registered. */
export function isPhoneSignInLookupError(rawMessage: string): boolean {
  return /user (?:does not exist|not found|not registered)|phone.*not.*found|signups not allowed/i.test(
    rawMessage,
  );
}

/** Keep phone-link and OTP failures from exposing whether a number belongs to an account. */
export function phoneAuthErrorMessage(rawMessage: string, isLinking: boolean): string {
  if (
    /sms provider|unsupported phone provider|phone.*disabled|phone sign.?in.*disabled|not configured/i.test(
      rawMessage,
    )
  ) {
    return "Phone verification is not active on the VITO authentication project yet. Supabase Auth must have phone sign-in and an SMS provider configured.";
  }
  if (/rate|limit|too many/i.test(rawMessage)) {
    return "Too many verification attempts. Please wait a few minutes before trying again.";
  }
  if (/invalid.*token|token.*expired|otp.*expired|otp.*invalid/i.test(rawMessage)) {
    return "That code is invalid or expired. Go back and request a new code.";
  }
  if (isLinking) {
    return "We could not link this number. Check that it is correct and try again, or use another sign-in method.";
  }
  return "We could not start phone sign-in. Check the number and try again, or choose another sign-in method. If you have not linked a number yet, use ‘Set up phone sign-in for an existing account’.";
}
