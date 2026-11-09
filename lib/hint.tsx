/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { HintEntry } from "./bindings";

/** The which-key hint: the keys typed so far, then each next key and what it runs. Drawn into our overlay. */
export function WhichKeyHint({ keys, next }: { keys: string; next: HintEntry[]; }) {
    return (
        <div style={{ whiteSpace: "normal" }}>
            <div style={{ opacity: 0.7, marginBottom: 4 }}>{keys} … (Esc cancels)</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 2 }}>
                {next.map(({ key, steps }) => [
                    <kbd key={`k${key}`} style={{ fontFamily: "var(--font-code, monospace)", fontWeight: 700 }}>{key}</kbd>,
                    <span key={`s${key}`} style={{ opacity: steps ? 1 : 0.7 }}>
                        {steps ? steps.map(s => s.text).join("; ") : "+ more keys"}
                    </span>
                ])}
            </div>
        </div>
    );
}
