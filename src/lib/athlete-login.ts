export const isAthleteCode = (code: string) => /^VITO-ATH-\d{6,8}$/.test(code.trim().toUpperCase());

/** Login address for athletes who sign in with their athlete ID only; it never receives email. */
export const athleteLoginEmail = (code: string) => `${code.trim().toLowerCase()}@athletes.vitophysio.app`;
