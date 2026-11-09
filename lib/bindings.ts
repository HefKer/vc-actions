/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * The binding engine: reads the bindings setting and turns key events into effects.
 * Pure: it never touches Discord or the DOM and owns no timers, so callers feed it events and act on what it returns.
 */

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { discordDefaults } from "./discordDefaults.ts";
// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { HOOK_EVENTS, type HookEvent, isHookEvent } from "./hooks.ts";

/** What the engine needs to know about an action. */
export interface ActionMeta {
    id: string;
    /** Arg names in order; the last one takes the rest of the step. */
    args: string[];
    /** Its run can return a release callback, so hold bindings may use it. */
    holdable?: boolean;
}

/** A key event as the engine sees it. Modifiers and `repeat` mirror KeyboardEvent. */
export type KeyInput =
    | {
        type: "keydown" | "keyup";
        key: string;
        code: string;
        ctrl: boolean;
        alt: boolean;
        shift: boolean;
        meta: boolean;
        repeat?: boolean;
        /** Focus is in a text field (input, textarea, select, contenteditable). */
        inTextField?: boolean;
    }
    | { type: "blur"; };

/** One action with its args, ready to run. */
export interface Step {
    actionId: string;
    args: Record<string, string | undefined>;
    /** The step as written, for messages. */
    text: string;
}

export type Effect =
    /** Run these steps in order. */
    | { type: "run"; trigger: string; steps: Step[]; }
    /** Hold binding pressed: run this step and keep its release callback under `trigger`. */
    | { type: "hold"; trigger: string; step: Step; }
    /** Hold binding let go (keyup or blur): call the release callback kept under `trigger`. */
    | { type: "release"; trigger: string; }
    /** A sequence is under way: show the which-key hint (replacing any earlier one) until a run or cancel. */
    | { type: "hint"; keys: string; next: HintEntry[]; }
    /** The sequence under way ended without running anything: hide the hint. */
    | { type: "cancel"; }
    /** Stop the event reaching Discord (preventDefault + stopPropagation). Absent means pass it through. */
    | { type: "swallow"; };

/** One key that may come next in a sequence, as written in the bindings. */
export interface HintEntry {
    key: string;
    /** What it runs, or `null` when more keys follow. */
    steps: Step[] | null;
}

export interface Problem {
    severity: "error" | "warning";
    /** 1-based line of the bindings text. */
    line: number;
    message: string;
}

/** A loaded binding as written: its trigger, each step's text, and whether it's a hold binding. */
export interface BindingInfo {
    trigger: string;
    steps: string[];
    hold?: boolean;
}

/** A loaded event hook (`on vcjoin = gotocall`) as written. */
export interface HookInfo {
    event: HookEvent;
    steps: string[];
}

export interface BindingEngine {
    /** Problems found loading the bindings text; bad lines are skipped. */
    readonly problems: Problem[];
    /** The bindings that loaded, as written. */
    readonly bindings: readonly BindingInfo[];
    /** The event hooks that loaded, as written, in setting order. */
    readonly hooks: readonly HookInfo[];
    /** The steps hooked to `event`, if any. */
    hookSteps(event: HookEvent): Step[] | undefined;
    feed(event: KeyInput): Effect[];
    /** Read step text (`;` between steps) as a binding's right side; a string is the error. Used by the palette. */
    parseSteps(text: string): Step[] | string;
}

interface Combo {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
    key: string;
}

interface Binding {
    /** 1-based line it was bound on. */
    line: number;
    /** One combo, or a sequence's combos in order. */
    combos: Combo[];
    /** The combos as written. */
    keys: string[];
    trigger: string;
    steps: Step[];
    hold?: boolean;
}

const MODS: Record<string, keyof Omit<Combo, "key">> = {
    ctrl: "ctrl", control: "ctrl",
    alt: "alt", option: "alt",
    shift: "shift",
    meta: "meta", super: "meta", win: "meta", cmd: "meta", mod: "ctrl"
};

const ALIASES: Record<string, string> = { esc: "escape", space: " ", plus: "+", del: "delete", return: "enter" };

function parseCombo(text: string): Combo | null {
    const parts = text.toLowerCase().split("+").map(p => p.trim());
    // "ctrl+plus" or a trailing "+" key: "ctrl++"
    if (text.endsWith("++")) parts.splice(-2, 2, "+");
    const combo: Combo = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
    for (const p of parts) {
        if (!p) return null;
        if (MODS[p]) combo[MODS[p]] = true;
        else if (combo.key) return null;
        else combo.key = ALIASES[p] ?? p;
    }
    return combo.key ? combo : null;
}

/** Has ctrl, alt or meta: what a leader needs, and what lets a combo fire while typing in a text field. */
const hasLeaderModifier = (c: Combo) => c.ctrl || c.alt || c.meta;

/** `KeyboardEvent.key` of keys that only modify; pressing one on its own is never a combo. */
const MODIFIER_KEYS = new Set(["Control", "Alt", "AltGraph", "Shift", "Meta", "OS", "Hyper", "Super"]);

/** One string per distinct combo, whatever synonyms or case it was written with. */
function comboId(c: Combo): string {
    return [c.ctrl && "ctrl", c.alt && "alt", c.shift && "shift", c.meta && "meta", c.key].filter(Boolean).join("+");
}

/** Discord's default shortcuts by canonical combo; the first name listed for a combo wins. */
const discordById = new Map<string, string>();
for (const [text, what] of discordDefaults) {
    const id = comboId(parseCombo(text)!);
    if (!discordById.has(id)) discordById.set(id, what);
}

/** The key of an event, layout-independent for letters and digits so shift doesn't change it. */
function eventKey(e: { key: string; code: string; }): string {
    if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
    if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
    if (/^Numpad\d$/.test(e.code)) return e.code.slice(6);
    // Chromium on Wayland sends some combos (ctrl+space) with key "Unidentified"; fall back to the physical key.
    if (e.key === "Unidentified") return e.code === "Space" ? " " : e.code.toLowerCase();
    return e.key.toLowerCase();
}

/** Spread the words after the action id over its args; the last arg takes the remainder. */
function splitArgs(rest: string, names: string[]): Record<string, string | undefined> {
    const words = rest ? rest.split(/\s+/) : [];
    const out: Record<string, string | undefined> = {};
    names.forEach((n, i) => {
        out[n] = i === names.length - 1 ? (words.slice(i).join(" ") || undefined) : words[i];
    });
    return out;
}

/** Split the right side of a binding on `;` into steps; a string is the error for the whole binding. */
function parseSteps(text: string, byId: Map<string, ActionMeta>): Step[] | string {
    const parts = text.split(";").map(s => s.trim());
    const steps: Step[] = [];
    for (const [n, stepText] of parts.entries()) {
        const where = parts.length > 1 ? `step ${n + 1}: ` : "";
        const [actionId = "", ...rest] = stepText.split(/\s+/);
        if (!actionId) return `${where}empty step`;
        const action = byId.get(actionId);
        if (!action) return `${where}no action "${actionId}"`;
        steps.push({ actionId, args: splitArgs(rest.join(" "), action.args), text: stepText });
    }
    return steps;
}

/**
 * Build an engine from the bindings text and the known actions: `[hold] trigger = step` or `on event = step`
 * per line, `#` comments.
 */
export function createBindingEngine(text: string, actions: ActionMeta[]): BindingEngine {
    const byId = new Map(actions.map(a => [a.id, a]));
    const bindings: Binding[] = [];
    const hooks = new Map<HookEvent, { line: number; steps: Step[]; }>();
    const problems: Problem[] = [];
    const error = (line: number, message: string) => problems.push({ severity: "error", line, message });

    /** Leaders already warned about clashing with Discord, so many sequences on one leader warn once. */
    const warned = new Set<string>();
    /**
     * Conflict checks for a parsed binding: returns an error (skip the line) or pushes warnings (still bound).
     * A trigger that equals, starts or is started by an earlier one can't be told apart: the earlier line wins.
     */
    function checkConflicts(combos: Combo[], trigger: string, line: number, hold: boolean): string | undefined {
        const ids = combos.map(comboId);
        for (const b of bindings) {
            const n = Math.min(ids.length, b.combos.length);
            if (!ids.slice(0, n).every((id, j) => comboId(b.combos[j]) === id)) continue;
            if (ids.length === b.combos.length) {
                // No tap-vs-hold timing: a combo either holds or runs.
                const both = hold !== !!b.hold ? ": a combo can't be both held and tapped" : "";
                return `"${trigger}" is already bound on line ${b.line}, which wins${both}`;
            }
            return `"${trigger}" is ambiguous with "${b.trigger}" on line ${b.line}, which wins: a trigger can't also start a longer sequence`;
        }
        // Only the first combo reaches Discord: later keys of a sequence are ours while the hint is up.
        const discord = discordById.get(ids[0]);
        if (discord && !warned.has(ids[0])) {
            warned.add(ids[0]);
            const what = ids.length > 1 ? `"${trigger}" starts with ${trigger.split(/\s+/)[0]}, which` : `"${trigger}"`;
            problems.push({ severity: "warning", line, message: `${what} overrides Discord's shortcut for ${discord}` });
        }
    }

    text.split("\n").forEach((raw, i) => {
        const line = raw.replace(/#.*/, "").trim();
        if (!line) return;
        const eq = line.indexOf("=");
        if (eq < 0) return error(i + 1, `expected "trigger = action", got "${line}"`);
        let trigger = line.slice(0, eq).trim();
        const hold = /^hold\s/i.test(trigger);
        if (hold) trigger = trigger.slice(4).trim();
        // No key is named "on" and a sequence needs a modifier, so this never shadows a trigger.
        const on = /^on(?:\s+(.*))?$/i.exec(trigger);
        if (on) {
            if (hold) return error(i + 1, `hold works only on a combo, not on "${trigger}"`);
            const event = (on[1] ?? "").toLowerCase();
            if (!isHookEvent(event)) {
                const events = Object.keys(HOOK_EVENTS).join(", ");
                return error(i + 1, event ? `no event "${on[1]}"; events: ${events}` : `"on" needs an event: ${events}`);
            }
            const steps = parseSteps(line.slice(eq + 1), byId);
            if (typeof steps === "string") return error(i + 1, steps);
            const earlier = hooks.get(event);
            if (earlier) return error(i + 1, `"on ${event}" is already set on line ${earlier.line}, which wins: put all its steps on one line, split by ;`);
            hooks.set(event, { line: i + 1, steps });
            return;
        }
        if (hold && /\s/.test(trigger)) return error(i + 1, `hold works only on a single combo, not "${trigger}"`);
        const keys = trigger.split(/\s+/);
        const parsed = keys.map(parseCombo);
        if (!parsed.every(c => c)) return error(i + 1, `can't read trigger "${trigger}"`);
        const combos = parsed as Combo[];
        const [leader] = combos;
        if (keys.length > 1 && !hasLeaderModifier(leader))
            return error(i + 1, `sequence "${trigger}" must start with ctrl, alt or meta, so typing never starts it`);
        const steps = parseSteps(line.slice(eq + 1), byId);
        if (typeof steps === "string") return error(i + 1, steps);
        if (hold && steps.length > 1) return error(i + 1, "hold works only on a single step, not a macro");
        if (hold && !byId.get(steps[0].actionId)!.holdable) return error(i + 1, `"${steps[0].actionId}" can't be held: it has no release`);
        // Mid-sequence Esc always cancels, whatever its modifiers, before any binding is looked at.
        if (combos.slice(1).some(c => c.key === "escape"))
            return error(i + 1, `"${trigger}" can never finish: Esc after the leader cancels the sequence`);
        const clash = checkConflicts(combos, trigger, i + 1, hold);
        if (clash) return error(i + 1, clash);
        bindings.push({ line: i + 1, combos, keys, trigger, hold, steps });
    });

    /** Hold bindings whose key is down. */
    const held = new Set<Binding>();

    /** Combos of the sequence under way, empty when idle. */
    let typed: string[] = [];

    /** Bindings whose trigger goes on past these combo ids. */
    const after = (ids: string[]) => bindings.filter(b =>
        b.combos.length > ids.length && ids.every((t, j) => comboId(b.combos[j]) === t));

    /** The hint for the typed combos: each distinct next combo, with its steps if it ends a sequence. */
    function hint(keys: string[]): Effect {
        const next = new Map<string, HintEntry>();
        for (const b of after(typed)) {
            const id = comboId(b.combos[typed.length]);
            if (!next.has(id)) next.set(id, { key: b.keys[typed.length], steps: b.combos.length === typed.length + 1 ? b.steps : null });
        }
        return { type: "hint", keys: keys.join(" "), next: [...next.values()] };
    }

    return {
        problems,
        bindings: bindings.map(b => ({ trigger: b.trigger, steps: b.steps.map(s => s.text), ...(b.hold ? { hold: true } : {}) })),
        hooks: [...hooks].map(([event, h]) => ({ event, steps: h.steps.map(s => s.text) })),
        hookSteps: event => hooks.get(event)?.steps,
        parseSteps: stepText => parseSteps(stepText, byId),
        feed(e) {
            const release = (bs: Binding[]): Effect[] => bs.map(b => {
                held.delete(b);
                return { type: "release", trigger: b.trigger };
            });
            const cancel = (): Effect[] => {
                typed = [];
                return e.type === "keydown" ? [{ type: "cancel" }, { type: "swallow" }] : [{ type: "cancel" }];
            };
            if (e.type === "blur") return [...release([...held]), ...(typed.length ? cancel() : [])];
            const key = eventKey(e);
            // A held key: its keyup releases, (auto-)repeats of it are swallowed. Modifiers may already be up.
            const heldHere = [...held].filter(b => b.combos[0].key === key);
            if (e.type === "keyup") return heldHere.length ? [...release(heldHere), { type: "swallow" }] : [];
            if (heldHere.length) return [{ type: "swallow" }];
            // No timeout mid-sequence: holding the last key or reaching for a modifier keeps it going.
            if (e.repeat) return typed.length ? [{ type: "swallow" }] : [];
            if (MODIFIER_KEYS.has(e.key)) return [];
            if (typed.length && key === "escape") return cancel();
            const id = comboId({ ctrl: e.ctrl, alt: e.alt, shift: e.shift, meta: e.meta, key });
            const hits = after(typed).filter(b => comboId(b.combos[typed.length]) === id);
            // Mid-sequence, a key that doesn't continue it is swallowed so it doesn't type a stray letter.
            if (!hits.length) return typed.length ? cancel() : [];
            // A bare key (no ctrl/alt/meta) shouldn't fire while typing.
            const [c] = hits[0].combos;
            if (!typed.length && !hasLeaderModifier(c) && e.inTextField) return [];
            const done = hits.find(b => b.combos.length === typed.length + 1);
            if (done) {
                typed = [];
                if (done.hold) {
                    held.add(done);
                    return [{ type: "hold", trigger: done.trigger, step: done.steps[0] }, { type: "swallow" }];
                }
                return [{ type: "run", trigger: done.trigger, steps: done.steps }, { type: "swallow" }];
            }
            typed.push(id);
            return [hint(hits[0].keys.slice(0, typed.length)), { type: "swallow" }];
        }
    };
}
