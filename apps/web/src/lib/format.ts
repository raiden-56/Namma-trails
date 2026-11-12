const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** All money in the system is integer paise. */
export function formatInrFromPaise(paise: number): string {
  return inr.format(Math.round(paise) / 100);
}

/** Today's date (Asia/Kolkata) as YYYY-MM-DD, for native date input `min` values. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
