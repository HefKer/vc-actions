/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";

import { resolveName } from "./resolve";

/** VcPresets' runtime API (../vc-presets). Looked up at call time, never imported. */
export interface VcPresetsApi {
    listPresets(): { name: string; }[];
    startPreset(name: string): Promise<void>;
    stopStream(): void;
    /** Changes only the niri cast target, mid-stream; throws a readable Error when not streaming or no video. */
    retarget(name: string): Promise<void>;
}

export class PresetsMissing extends Error { }

function raw(): VcPresetsApi | undefined {
    return (window as any).Vencord?.Plugins?.plugins?.VcPresets;
}

function lookup(): VcPresetsApi | null {
    const p = raw();
    return p && isPluginEnabled("VcPresets") ? p : null;
}

/** The VcPresets plugin, or throws PresetsMissing with a message fit for the user. */
export function presets(): VcPresetsApi {
    if (!raw()) throw new PresetsMissing("VcPresets isn't installed: build it into this Vencord (src/userplugins).");
    const p = lookup();
    if (!p) throw new PresetsMissing("VcPresets is disabled: enable it in Vencord's plugin settings.");
    if (typeof p.startPreset !== "function") throw new PresetsMissing("VcPresets is enabled but doesn't expose startPreset; it may be an older build.");
    return p;
}

/*
 * The preset our own actions last went live with or retargeted to. VcPresets' API doesn't say which
 * preset is live, so a stream started from VcPresets' own UI leaves this stale or null.
 */
let current: string | null = null;
export const currentPreset = () => current;
export function setCurrentPreset(name: string | null) {
    current = name;
}

export function presetNames(): string[] {
    try {
        return lookup()?.listPresets?.().map(p => p.name) ?? [];
    } catch {
        return [];
    }
}

/** Resolve a typed name to a preset (see resolveName). */
export function resolvePreset(input: string | undefined): string {
    const names = presets().listPresets().map(p => p.name);
    if (!names.length) throw new PresetsMissing("No presets saved yet: add one in VcPresets.");
    const r = resolveName(input, names.map(n => ({ names: [n], value: n })), "preset");
    if (!r.ok) throw new PresetsMissing(r.error);
    return r.value;
}
