/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";

/** VcPresets' runtime API (../vc-presets). Looked up at call time, never imported. */
export interface VcPresetsApi {
    listPresets(): { name: string; }[];
    startPreset(name: string): Promise<void>;
    stopStream(): void;
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

export function presetNames(): string[] {
    try {
        return lookup()?.listPresets?.().map(p => p.name) ?? [];
    } catch {
        return [];
    }
}

/** Resolve a typed name to a preset: exact, then case-insensitive, then unique prefix. */
export function resolvePreset(input: string | undefined): string {
    const names = presets().listPresets().map(p => p.name);
    if (!names.length) throw new PresetsMissing("No presets saved yet: add one in VcPresets.");
    const list = `Presets: ${names.join(", ")}`;
    if (!input) throw new PresetsMissing(`Name a preset. ${list}`);
    const lower = input.toLowerCase();
    const hit = names.find(n => n === input)
        ?? names.find(n => n.toLowerCase() === lower)
        ?? (() => {
            const pre = names.filter(n => n.toLowerCase().startsWith(lower));
            return pre.length === 1 ? pre[0] : undefined;
        })();
    if (!hit) throw new PresetsMissing(`No preset "${input}". ${list}`);
    return hit;
}
