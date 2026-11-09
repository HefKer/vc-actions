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
    /** Stop the event reaching Discord (preventDefault + stopPropagation). Absent means pass it through. */
    | { type: "swallow"; };

export interface Problem {
    severity: "error" | "warning";
    /** 1-based line of the bindings text. */
    line: number;
    message: string;
}

export interface BindingEngine {
    /** Problems found loading the bindings text; bad lines are skipped. */
    readonly problems: Problem[];
    feed(event: KeyInput): Effect[];
}

interface Combo {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
    key: string;
}

interface Binding {
    combo: Combo;
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

/** Build an engine from the bindings text (`[hold] trigger = step` per line, `#` comments) and the known actions. */
export function createBindingEngine(text: string, actions: ActionMeta[]): BindingEngine {
    const byId = new Map(actions.map(a => [a.id, a]));
    const bindings: Binding[] = [];
    const problems: Problem[] = [];
    const error = (line: number, message: string) => problems.push({ severity: "error", line, message });

    /** Line each trigger was first bound on, by canonical combo. */
    const seen = new Map<string, number>();
    /** Conflict checks for a parsed binding: returns an error (skip the line) or pushes warnings (still bound). */
    function checkConflicts(combo: Combo, trigger: string, line: number): string | undefined {
        const id = comboId(combo);
        const first = seen.get(id);
        if (first) return `"${trigger}" is already bound on line ${first}, which wins`;
        seen.set(id, line);
        const discord = discordById.get(id);
        if (discord) problems.push({ severity: "warning", line, message: `"${trigger}" overrides Discord's shortcut for ${discord}` });
    }

    text.split("\n").forEach((raw, i) => {
        const line = raw.replace(/#.*/, "").trim();
        if (!line) return;
        const eq = line.indexOf("=");
        if (eq < 0) return error(i + 1, `expected "trigger = action", got "${line}"`);
        let trigger = line.slice(0, eq).trim();
        const hold = /^hold\s/i.test(trigger);
        if (hold) trigger = trigger.slice(4).trim();
        if (hold && /\s/.test(trigger)) return error(i + 1, `hold works only on a single combo, not "${trigger}"`);
        const combo = parseCombo(trigger);
        if (!combo) return error(i + 1, `can't read trigger "${trigger}"`);
        const steps = parseSteps(line.slice(eq + 1), byId);
        if (typeof steps === "string") return error(i + 1, steps);
        if (hold && steps.length > 1) return error(i + 1, "hold works only on a single step, not a macro");
        if (hold && !byId.get(steps[0].actionId)!.holdable) return error(i + 1, `"${steps[0].actionId}" can't be held: it has no release`);
        const clash = checkConflicts(combo, trigger, i + 1);
        if (clash) return error(i + 1, clash);
        bindings.push({ combo, trigger, hold, steps });
    });

    /** Hold bindings whose key is down. */
    const held = new Set<Binding>();

    return {
        problems,
        feed(e) {
            const release = (bs: Binding[]): Effect[] => bs.map(b => {
                held.delete(b);
                return { type: "release", trigger: b.trigger };
            });
            if (e.type === "blur") return release([...held]);
            const key = eventKey(e);
            // A held key: its keyup releases, (auto-)repeats of it are swallowed. Modifiers may already be up.
            const heldHere = [...held].filter(b => b.combo.key === key);
            if (e.type === "keyup") return heldHere.length ? [...release(heldHere), { type: "swallow" }] : [];
            if (heldHere.length) return [{ type: "swallow" }];
            if (e.repeat) return [];
            const hit = bindings.find(({ combo: c }) =>
                c.ctrl === e.ctrl && c.alt === e.alt && c.shift === e.shift && c.meta === e.meta && c.key === key);
            if (!hit) return [];
            // A bare key (no ctrl/alt/meta) shouldn't fire while typing.
            const bare = !hit.combo.ctrl && !hit.combo.alt && !hit.combo.meta;
            if (bare && e.inTextField) return [];
            if (hit.hold) {
                held.add(hit);
                return [{ type: "hold", trigger: hit.trigger, step: hit.steps[0] }, { type: "swallow" }];
            }
            return [{ type: "run", trigger: hit.trigger, steps: hit.steps }, { type: "swallow" }];
        }
    };
}
