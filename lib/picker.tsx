/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useMemo, useRef, useState } from "@webpack/common";
import type { KeyboardEvent } from "react";

import { overlay } from "./overlay";
import { type PaletteEntry, type PaletteMatch, rankEntries } from "./palette";
import { frecencyOf, recordPick, type UsageList } from "./usage";

/**
 * The fuzzy picker `palette`, `favpick` and `userpick` share: a text box over a ranked list of entries
 * (lib/palette.ts), drawn in a window's overlay panel. Picks are counted per list, so frequent ones rank first.
 */

const SHOWN = 8;

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
            {entry.detail && <span style={{ ...mono, opacity: 0.7 }}>{entry.detail}</span>}
        </div>
    );
}

interface PickerProps {
    entries: PaletteEntry[];
    frecency(entry: PaletteEntry): number;
    placeholder: string;
    footer: string;
    complete: boolean;
    close(): void;
    pick(match: PaletteMatch): void;
    /** Runs when the picker unmounts, however that happens (closed, or replaced in its slot by `help`). */
    gone(): void;
}

function Picker({ entries, frecency, placeholder, footer, complete, close, pick: onPick, gone }: PickerProps) {
    const [query, setQuery] = useState("");
    const [sel, setSel] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const matches = useMemo(() => rankEntries(query, entries, frecency), [query, entries]);
    useEffect(() => {
        input.current?.focus();
        return gone;
    }, []);

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
                onPick(pick);
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
                if (!complete) break;
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
                placeholder={placeholder}
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
                {desc ? `${desc} · ` : ""}{footer}
            </div>
        </div>
    );
}

export interface PickerOptions {
    /** The window to open in: the one the key was pressed in. */
    win: Window;
    entries: PaletteEntry[];
    /** Where picks are counted; an entry's `text` is its key there. */
    usage: UsageList;
    placeholder: string;
    /** What Enter does, for the footer: "runs", "opens". */
    enter: string;
    /** Tab completes the selected entry into the box, for free text after it. */
    complete?: boolean;
    /** Called after the picker closes, with the chosen match. */
    pick(match: PaletteMatch): void;
}

/** Open a picker in `win`'s overlay panel. Closing it (Esc, a pick, leaving the box) puts focus back where it was. */
export async function openPicker({ win, entries, usage, placeholder, enter, complete = false, pick }: PickerOptions) {
    const doc = win.document;
    const before = doc.activeElement as HTMLElement | null;
    const used = await frecencyOf(usage);
    // Back to where you were typing, so the picker leaves no trace.
    const gone = () => {
        if (before?.isConnected) before.focus();
    };
    const close = overlay(doc, "panel").show(
        <Picker
            entries={entries}
            frecency={e => used(e.text)}
            placeholder={placeholder}
            footer={`Enter ${enter}${complete ? " · Tab completes" : ""} · Esc closes`}
            complete={complete}
            close={() => close()}
            pick={m => {
                recordPick(usage, m.entry.text);
                pick(m);
            }}
            gone={gone}
        />,
        { duration: null }
    );
}
