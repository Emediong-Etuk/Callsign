/** tUSD has 6 decimals. Amounts on the wire are base-unit decimal strings. */
export const TUSD_DECIMALS = 6;
const UNIT = 10n ** BigInt(TUSD_DECIMALS);

export function toBaseUnits(tusd: string | number): string {
  const s = String(tusd).trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,6})?$/.test(s)) throw new Error("Enter an amount like 250 or 250.50");
  const [whole, frac = ""] = s.split(".");
  return (BigInt(whole!) * UNIT + BigInt((frac + "000000").slice(0, 6))).toString();
}

export function formatTusd(base: string | bigint, opts: { suffix?: boolean } = {}): string {
  const v = BigInt(base);
  const whole = v / UNIT;
  const frac = v % UNIT;
  const fracStr =
    frac === 0n
      ? ""
      : "." + frac.toString().padStart(6, "0").replace(/0+$/, "").slice(0, 2).padEnd(2, "0");
  const text = whole.toLocaleString("en-US") + fracStr;
  return opts.suffix === false ? text : `${text} tUSD`;
}

export function formatTime(ns: string | number | bigint, timeZone = "Africa/Lagos"): string {
  const ms = Number(BigInt(ns) / 1_000_000n);
  return (
    new Date(ms).toLocaleTimeString("en-GB", { timeZone, hour12: false }) +
    (timeZone === "Africa/Lagos" ? " WAT" : "")
  );
}
