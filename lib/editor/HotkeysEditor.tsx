/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./editor.css";

import { SettingsSection } from "@components/settings/tabs/plugins/components/Common";
import { classNameFactory } from "@utils/css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "@webpack/common";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

import type { Action } from "../../registry";
import type { Problem } from "../bindings";
import { complete } from "../completion";
import { type Token, tokenize } from "../highlight";
import { Reference } from "./Reference";

/**
 * The Hotkeys setting: a code editor for the bindings text (a transparent textarea over a coloured mirror, so the
 * textarea keeps native editing and undo), problems found by the binding engine shown on their lines, autocomplete,
 * and a reference of the syntax and actions below.
 */

const cl = classNameFactory("vc-qa-editor-");

/** Typing settles this long before the text is checked and saved (as long as Vencord's own text settings wait). */
const SETTLE = 300;

export interface HotkeysSettingProps {
    /** The saved text, read once when the editor mounts. */
    initial: string;
    /** Store the text in the setting. */
    save(text: string): void;
    /** The problems the binding engine finds in the text. */
    check(text: string): Problem[];
    actions: readonly Action[];
}

/** Offset of the start of each line. */
function lineStarts(text: string): number[] {
    const starts = [0];
    for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
    return starts;
}

/** A line's tokens as coloured spans, with `marker` inserted at column `at` (to measure where the caret is). */
function renderLine(tokens: Token[], at?: number, marker?: ReactNode): ReactNode[] {
    const out: ReactNode[] = [];
    let col = 0;
    tokens.forEach((t, i) => {
        const end = col + t.text.length;
        const span = (text: string, key: string) => <span key={key} className={`vc-qa-tok-${t.type}`}>{text}</span>;
        if (at !== undefined && at > col && at < end) {
            out.push(span(t.text.slice(0, at - col), `${i}a`), marker, span(t.text.slice(at - col), `${i}b`));
        } else {
            if (at === col) out.push(marker);
            out.push(span(t.text, String(i)));
        }
        col = end;
    });
    if (at !== undefined && at >= col) out.push(marker);
    return out;
}

function HotkeysEditor({ initial, save, check, actions }: HotkeysSettingProps) {
    const [text, setText] = useState(initial);
    const [sel, setSel] = useState({ start: initial.length, end: initial.length });
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [problems, setProblems] = useState(() => check(initial));
    const [active, setActive] = useState(0);
    /** Moved through the list with the arrows: Enter then picks even with nothing typed. */
    const [navigated, setNavigated] = useState(false);
    const [popupAt, setPopupAt] = useState<{ left: number; top: number; } | null>(null);

    const input = useRef<HTMLTextAreaElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const mirror = useRef<HTMLDivElement>(null);
    const caret = useRef<HTMLSpanElement>(null);
    const popup = useRef<HTMLDivElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const latest = useRef(initial);

    // Leaving the settings (or the plugin's modal) saves what's typed even if typing hadn't settled.
    useEffect(() => () => {
        clearTimeout(timer.current);
        save(latest.current);
    }, []);

    function flush() {
        clearTimeout(timer.current);
        setProblems(check(latest.current));
        save(latest.current);
    }

    function onText(next: string, ta: HTMLTextAreaElement) {
        setText(next);
        setSel({ start: ta.selectionStart, end: ta.selectionEnd });
        setDismissed(false);
        latest.current = next;
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, SETTLE);
    }

    const lines = useMemo(() => tokenize(text), [text]);
    const starts = useMemo(() => lineStarts(text), [text]);
    const byLine = useMemo(() => {
        const m = new Map<number, Problem[]>();
        for (const p of problems) m.set(p.line, [...m.get(p.line) ?? [], p]);
        return m;
    }, [problems]);

    const completion = useMemo(
        () => focused && !dismissed && sel.start === sel.end ? complete(text, sel.start, actions) : null,
        [text, sel, focused, dismissed, actions]
    );
    const completionKey = completion && `${completion.from}:${completion.prefix}:${completion.items.length}`;
    useEffect(() => {
        setActive(0);
        setNavigated(false);
    }, [completionKey]);

    const caretLine = completion ? starts.findLastIndex(s => s <= sel.start) : -1;

    // Place the list under the caret, kept inside the editor's width.
    useLayoutEffect(() => {
        const c = caret.current, b = box.current;
        if (!completion || !c || !b) return setPopupAt(null);
        const width = popup.current?.offsetWidth ?? 440;
        const left = Math.max(0, Math.min(c.offsetLeft, b.clientWidth - width));
        // An empty inline span is as tall as the font, centred in the line: the line ends half the leading below it.
        const line = parseFloat(getComputedStyle(c).lineHeight) || c.offsetHeight;
        const top = c.offsetTop + (c.offsetHeight + line) / 2;
        setPopupAt(p => p && p.left === left && p.top === top ? p : { left, top });
    }, [completionKey, caretLine, sel.start, text]);

    // Also scrolls the settings so the list isn't cut off below.
    useEffect(() => {
        if (popupAt) popup.current?.querySelector(`.${cl("item-selected")}`)?.scrollIntoView({ block: "nearest" });
    }, [active, popupAt]);

    /** Replace `from`..`to` with `insert` through the browser's editing, so Ctrl+Z undoes it. */
    function replace(from: number, to: number, insert: string) {
        const ta = input.current;
        if (!ta) return;
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(from, to);
        // Fires input, which reaches onText. Deprecated but still the only way to edit a textarea undoably.
        if (!ta.ownerDocument.execCommand("insertText", false, insert)) {
            ta.setRangeText(insert, from, to, "end");
            onText(ta.value, ta);
        }
    }

    function accept(i: number) {
        const item = completion?.items[i];
        if (item) replace(completion.from, completion.to, item.insert);
    }

    function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (!completion || e.ctrlKey || e.altKey || e.metaKey) return;
        const n = completion.items.length;
        switch (e.key) {
            case "ArrowDown":
            case "ArrowUp":
                if (e.shiftKey) return;
                setActive(a => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                setNavigated(true);
                break;
            case "Tab":
                if (e.shiftKey) return;
                accept(active);
                break;
            case "Enter":
                // Right after `= ` with nothing typed, Enter is still a newline unless you picked from the list.
                if (e.shiftKey || (!completion.prefix && !navigated)) return;
                accept(active);
                break;
            case "Escape":
                setDismissed(true);
                // Not the settings modal's Esc.
                e.stopPropagation();
                break;
            default:
                return;
        }
        e.preventDefault();
    }

    /** Select line `line` (1-based) and scroll it into view. */
    function jumpTo(line: number) {
        const ta = input.current;
        if (!ta) return;
        const start = starts[line - 1] ?? 0;
        const end = (starts[line] ?? text.length + 1) - 1;
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(start, end);
        setSel({ start, end });
        mirror.current?.children[line - 1]?.scrollIntoView({ block: "nearest" });
    }

    const updateSel = () => {
        const ta = input.current;
        if (ta && (ta.selectionStart !== sel.start || ta.selectionEnd !== sel.end)) setSel({ start: ta.selectionStart, end: ta.selectionEnd });
    };

    const marker = <span key="caret" ref={caret} />;
    const errors = problems.filter(p => p.severity === "error").length;
    const warnings = problems.length - errors;

    return (
        <>
            <div ref={box} className="vc-qa-editor" style={{ "--vc-qa-gutter": `${String(lines.length).length + 2}ch` } as CSSProperties}>
                <div ref={mirror} className={cl("mirror")} aria-hidden>
                    {lines.map((tokens, i) => {
                        const own = byLine.get(i + 1);
                        const severity = own && (own.some(p => p.severity === "error") ? "error" : "warning");
                        return (
                            <div key={i} className={cl("row", severity && `row-${severity}`)}>
                                <span className={cl("ln")} title={own?.map(p => `${p.severity}: ${p.message}`).join("\n")} onClick={() => jumpTo(i + 1)}>
                                    {i + 1}
                                </span>
                                <span className={cl("code")}>
                                    {renderLine(tokens, i === caretLine ? sel.start - starts[i] : undefined, marker)}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <textarea
                    ref={input}
                    className={cl("input")}
                    value={text}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    autoComplete="off"
                    placeholder={"ctrl+alt+p = popout\nctrl+space s = stream Gaming; popout\nhold ctrl+alt+m = unmute\non vcjoin = gotocall"}
                    onChange={e => onText(e.currentTarget.value, e.currentTarget)}
                    onSelect={updateSel}
                    onKeyDown={onKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false);
                        flush();
                    }}
                />
                {completion && (
                    <div
                        ref={popup}
                        className={cl("popup")}
                        style={popupAt ?? { visibility: "hidden" }}
                        // Clicking the list mustn't take focus from the text.
                        onMouseDown={e => e.preventDefault()}
                    >
                        <div className={cl("popup-title")}>{completion.title} · Tab to insert, Esc to close</div>
                        {completion.items.map((item, i) => (
                            <div
                                key={item.label}
                                className={cl("item", i === active && "item-selected")}
                                // Only a real move: the list opening under a resting pointer mustn't change the selection.
                                onMouseMove={e => {
                                    if (e.movementX || e.movementY) setActive(i);
                                }}
                                onClick={() => accept(i)}
                            >
                                <span className={cl("item-label")}>{item.label}</span>
                                {item.detail && <span className={cl("item-detail")}>{item.detail}</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {problems.length > 0 ? (
                <ul className={cl("problems")}>
                    {problems.map((p, i) => (
                        <li key={i} className={cl("problem", `problem-${p.severity}`)}>
                            <button type="button" className={cl("problem-line")} onClick={() => jumpTo(p.line)}>line {p.line}</button>
                            <span>{p.severity === "warning" ? "warning: " : ""}{p.message}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className={cl("status")}>{text.trim() ? "No problems." : "No bindings yet."}</div>
            )}
            {problems.length > 0 && (
                <div className={cl("status")}>
                    {[errors && `${errors} error${errors > 1 ? "s" : ""} (line skipped)`, warnings && `${warnings} warning${warnings > 1 ? "s" : ""} (still bound)`].filter(Boolean).join(", ")}
                </div>
            )}
            <Reference actions={actions} insert={id => replace(sel.start, sel.end, id)} />
        </>
    );
}

export function HotkeysSetting(props: HotkeysSettingProps) {
    return (
        <SettingsSection name="Hotkeys" id="hotkeys" description="In-app bindings and event hooks, one per line. Syntax and actions are below.">
            <div>
                <HotkeysEditor {...props} />
            </div>
        </SettingsSection>
    );
}
