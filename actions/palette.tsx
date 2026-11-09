/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useMemo, useRef, useState } from "@webpack/common";
import type { KeyboardEvent } from "react";

import { overlay } from "../lib/overlay";
import { buildEntries, type PaletteAction, type PaletteChoice, type PaletteEntry, type PaletteMatch, rankEntries } from "../lib/palette";
import { participantChoices } from "../lib/users";
import { type Action, defineAction } from "../registry";

const SHOWN = 8;

/** Each action with its args' choices read now; user args without choices offer the people in your voice channel. */
function paletteActions(actions: readonly Action[]): PaletteAction[] {
    const read = (f: () => PaletteChoice[]) => {
        try {
            return f();
        } catch {
            return [];
        }
    };
    return actions.filter(a => a.id !== "palette").map(a => ({
        id: a.id,
        description: a.description,
        args: (a.args ?? []).map(arg => ({
            name: arg.name,
            choices: arg.choices
                ? read(() => arg.choices!().map(c => ({ label: c, value: c })))
                : arg.type === "user" ? read(participantChoices) : undefined
        }))
    }));
}

const mono = { fontFamily: "var(--font-code, monospace)" } as const;

function Row({ match, selected }: { match: PaletteMatch; selected: boolean; }) {
    const { entry } = match;
    return (
        <div style={{
            display: "flex", gap: 12, padding: "2px 6px", borderRadius: 4,
            background: selected ? "var(--background-modifier-selected, rgba(78,80,88,.6))" : undefined
        }}>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {match.label}{entry.open && match.label === entry.label ? " …" : ""}
            </span>
            {entry.trigger && <span style={{ ...mono, opacity: 0.7 }}>{entry.trigger}</span>}
        </div>
    );
}

function Palette({ entries, close, run }: { entries: PaletteEntry[]; close(): void; run(text: string): void; }) {
    const [query, setQuery] = useState("");
    const [sel, setSel] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const matches = useMemo(() => rankEntries(query, entries), [query, entries]);
    useEffect(() => input.current?.focus(), []);

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        const handled = () => {
            e.preventDefault();
            e.stopPropagation();
        };
        const pick = matches[Math.min(sel, matches.length - 1)];
        switch (e.key) {
            case "Escape":
                handled();
                close();
                break;
            case "Enter":
                handled();
                if (!pick) return;
                close();
                run(pick.text);
                break;
            case "ArrowDown":
            case "ArrowUp": {
                handled();
                const n = Math.min(matches.length, SHOWN);
                if (n) setSel(s => (Math.min(s, n - 1) + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                break;
            }
            case "Tab":
                // Complete the selected entry's label, ready for free text after it.
                handled();
                if (pick) setQuery(pick.entry.open ? `${pick.entry.label} ` : pick.entry.label);
                break;
        }
    };

    const shown = matches.slice(0, SHOWN);
    const selected = Math.min(sel, shown.length - 1);
    const desc = shown[selected]?.entry.description;
    return (
        <div style={{ width: "min(520px, calc(100vw - 64px))" }}>
            <input
                ref={input}
                value={query}
                placeholder="Run a binding or action…"
                onChange={e => { setQuery(e.currentTarget.value); setSel(0); }}
                onKeyDown={onKeyDown}
                onBlur={close}
                style={{
                    width: "100%", boxSizing: "border-box", padding: "6px 8px", marginBottom: 6, border: "none", borderRadius: 4,
                    outline: "none", background: "var(--background-secondary, #2b2d31)", color: "inherit", font: "inherit"
                }}
            />
            {shown.length
                ? shown.map((m, i) => <Row key={i} match={m} selected={i === selected} />)
                : <div style={{ opacity: 0.6, padding: "2px 6px" }}>No match</div>}
            <div style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}>
                {desc ? `${desc} · ` : ""}Enter runs · Tab completes · Esc closes
            </div>
        </div>
    );
}

export default defineAction({
    id: "palette",
    description: "Fuzzy-find and run any binding or action × choice, in the window you're in",
    run({ win = window, bindings = [], actions = [], runSteps, reply }) {
        if (!runSteps) return reply("The palette only opens from a binding.", "error");
        const doc = win.document;
        const before = doc.activeElement as HTMLElement | null;
        const entries = buildEntries(bindings, paletteActions(actions));
        let hide: (() => void) | null = null;
        const close = () => {
            if (!hide) return;
            hide();
            hide = null;
            // Back to where you were typing, so the palette leaves no trace.
            if (before?.isConnected) before.focus();
        };
        hide = overlay(doc).show(<Palette entries={entries} close={close} run={text => { runSteps(text); }} />, { duration: null });
    }
});
