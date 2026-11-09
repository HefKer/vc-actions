/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** A volume arg: `{set}` from a bare number, `{by}` from +n/-n. In percent as Discord's slider shows it. */
export type VolumeChange = { set: number; } | { by: number; };

/** Parses `n`, `+n` or `-n` (optional trailing %). Pure, so `node --test` can run it. */
export function parseVolumeChange(input: string | undefined): { ok: true; change: VolumeChange; } | { ok: false; error: string; } {
    const m = /^([+-]?)(\d+(?:\.\d+)?)%?$/.exec(input?.trim() ?? "");
    if (!m) return { ok: false, error: `Volume must be n (set), +n or -n (adjust), got "${input ?? ""}".` };
    const n = Number(m[2]);
    return { ok: true, change: m[1] ? { by: m[1] === "-" ? -n : n } : { set: n } };
}

/*
 * Discord stores a user's local volume as an amplitude (MediaEngineStore.getLocalVolume, 100 = normal) but its
 * slider shows a perceptual percent: below 100 a 2.8 power curve, above it 6 dB per 100%. So slider 200% is
 * amplitude ~199.5 and slider 50% is ~14.4. Our args are slider percents; these mirror Discord's conversion.
 */

/** Slider percent -> stored amplitude (Discord's perceptualToAmplitude). */
export function percentToAmplitude(percent: number): number {
    if (percent === 0) return 0;
    const r = percent / 100;
    return (r < 1 ? Math.pow(r, 2.8) : Math.pow(10, (r - 1) * 6 / 20)) * 100;
}

/** Stored amplitude -> slider percent (Discord's amplitudeToPerceptual). */
export function amplitudeToPercent(amplitude: number): number {
    if (amplitude === 0) return 0;
    const r = amplitude / 100;
    return (r < 1 ? Math.pow(r, 1 / 2.8) : 20 * Math.log10(r) / 6 + 1) * 100;
}

/** The volume after `change`, from `current`, rounded to a whole percent and clamped to 0..max. */
export function applyVolumeChange(current: number, change: VolumeChange, max: number): number {
    const v = Math.round("set" in change ? change.set : current + change.by);
    return Math.min(max, Math.max(0, v));
}
