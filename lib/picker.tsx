/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useMemo, useRef, useState } from "@webpack/common";
import type { KeyboardEvent } from "react";

import type { ActionContext } from "../registry";
import { logger } from "./discord";
import { UserError } from "./errors";
import { overlay } from "./overlay";
import { type PaletteEntry, type PaletteMatch, rankEntries } from "./palette";
import { frecencyOf, recordPick, type UsageList } from "./usage";

/**
 * The fuzzy picker `palette`, `favpick`, `userpick` and the other pickers share: a text box over a ranked list of entries
 * (lib/palette.ts), drawn in a window's overlay panel. Picks are counted per list, so frequent ones rank first.
 */

const SHOWN = 8;

const mono = { fontFamily: "var(--font-code, monospace)" } as const;

const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

/** `icons`: some entry has an icon, so every row keeps a column for one and labels line up. */
function Row({ match, selected, icons }: { match: PaletteMatch; selected: boolean; icons: boolean; }) {
    const { entry } = match;
    const { badge } = entry;
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "2px 6px", borderRadius: 4,
            background: selected ? "var(--background-modifier-selected, rgba(78,80,88,.6))" : undefined
        }}>
            {icons && <span style={{ width: "1.5em", flexShrink: 0, textAlign: "center", opacity: 0.8 }}>{entry.icon}</span>}
            <span style={{ flex: 1, ...ellipsis }}>
                {match.label}{entry.open && match.label === entry.label ? " …" : ""}
            </span>
            {badge && <span style={{
                flexShrink: 0, fontSize: 12, fontWeight: 700, padding: "0 6px", borderRadius: 8,
                ...badge.alert ? { background: "var(--status-danger, #da373c)", color: "#fff" } : { opacity: 0.8 }
            }}>{badge.text}</span>}
            {entry.detail && <span style={{ ...mono, ...ellipsis, maxWidth: "50%", opacity: 0.7 }}>{entry.detail}</span>}
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
    /** `alt`: picked with Shift+Enter. */
    pick(match: PaletteMatch, alt: boolean): void;
    /** Runs when the picker unmounts, however that happens (closed, or replaced in its slot by `help`). */
    gone(): void;
}

function Picker({ entries, frecency, placeholder, footer, complete, close, pick: onPick, gone }: PickerProps) {
    const [query, setQuery] = useState("");
    const [sel, setSel] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const matches = useMemo(() => rankEntries(query, entries, frecency), [query, entries]);
    const icons = useMemo(() => entries.some(e => e.icon), [entries]);
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
                onPick(pick, e.shiftKey);
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
                ? shown.map((m, i) => <Row key={i} match={m} selected={i === selected} icons={icons} />)
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
    pick(match: PaletteMatch): void | Promise<void>;
    /** A second way to pick, with Shift+Enter (`vcpick` opens the channel instead of joining); without it Shift+Enter is Enter. */
    alt?: {
        /** For the footer, like `enter`. */
        enter: string;
        pick(match: PaletteMatch): void | Promise<void>;
    };
    /** Where a throw from `pick` goes, as an action's would (a UserError's message; anything else logged too). Without it, only logged. */
    reply?: ActionContext["reply"];
}

/** Open a picker in `win`'s overlay panel. Closing it (Esc, a pick, leaving the box) puts focus back where it was. */
/** Where each window's picker puts focus back, kept for a picker opened from another (`favpick` run from the palette). */
const returnFocus = new WeakMap<Document, HTMLElement | null>();

export async function openPicker({ win, entries, usage, placeholder, enter, complete = false, pick, alt, reply }: PickerOptions) {
    const doc = win.document;
    const active = doc.activeElement as HTMLElement | null;
    // Focus still in a picker that's closing (its box, in lib/overlay.tsx's host): go back where that one would.
    const before = active?.closest("#quick-actions-overlay") ? returnFocus.get(doc) ?? null : active;
    returnFocus.set(doc, before);
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
            footer={`Enter ${enter}${alt ? ` · Shift+Enter ${alt.enter}` : ""}${complete ? " · Tab completes" : ""} · Esc closes`}
            complete={complete}
            close={() => close()}
            pick={async (m, shift) => {
                recordPick(usage, m.entry.text);
                try {
                    await (shift && alt ? alt.pick : pick)(m);
                } catch (e) {
                    if (!(e instanceof UserError)) logger.error(`${usage} pick failed`, e);
                    reply?.(e instanceof Error ? e.message : String(e), "error");
                }
            }}
            gone={gone}
        />,
        { duration: null }
    );
}
