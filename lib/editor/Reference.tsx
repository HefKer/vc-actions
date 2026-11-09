/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Action } from "../../registry";
import { HOOK_EVENTS } from "../hooks";

/** The collapsible reference under the Hotkeys editor: the syntax, condensed from the README, and every action. */

const C = ({ children }: { children: string; }) => <code>{children}</code>;

function Syntax({ holdable }: { holdable: string[]; }) {
    return (
        <div className="vc-qa-ref-body">
            <p>
                One binding per line: <C>[hold] trigger = step; step</C>. <C>#</C> starts a comment, to the end of the line.
            </p>
            <p>
                <b>Trigger:</b> a combo (<C>ctrl+alt+p</C>) or a sequence of space-separated combos pressed one after another
                (<C>ctrl+space f n</C>). A sequence's first combo (the leader) needs <C>ctrl</C>, <C>alt</C> or <C>meta</C>;
                the keys after it may be bare. After the leader a hint lists the next keys; Esc cancels.
                Modifiers: <C>ctrl</C> (<C>control</C>, <C>mod</C>), <C>alt</C> (<C>option</C>), <C>shift</C>, <C>meta</C> (<C>super</C>, <C>win</C>, <C>cmd</C>).
                Keys are named as <C>KeyboardEvent.key</C> gives them, lowercased (<C>f8</C>, <C>arrowdown</C>, <C>enter</C>);
                aliases <C>esc</C>, <C>space</C>, <C>plus</C> (or <C>ctrl++</C>), <C>del</C>, <C>return</C>. Letters and digits match by physical key.
            </p>
            <p>
                <b>Step:</b> an action id, then its args in order; the last arg takes the rest of the step, spaces included
                (<C>stream My Preset</C>). Users and other names match exactly, then case-insensitively, then by unique prefix.
            </p>
            <p>
                <b>Macro:</b> several steps split by <C>;</C> run in order, each waiting for the last; the first failing step stops the rest.
                Args can't contain <C>;</C>.
            </p>
            <p>
                <b>Hold:</b> <C>hold ctrl+alt+m = unmute</C> runs on press and undoes it on release. One combo, one step, and only a
                holdable action: {holdable.map((id, i) => <span key={id}>{i ? ", " : ""}<C>{id}</C></span>)}.
            </p>
            <p>
                <b>Event hooks:</b> <C>on event = step; step</C> runs the steps when the event fires, in the main window. One line per event.
            </p>
            <table>
                <tbody>
                    {Object.entries(HOOK_EVENTS).map(([event, what]) => (
                        <tr key={event}>
                            <td className="vc-qa-ref-mono">{event}</td>
                            <td>{what}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p style={{ marginTop: 6 }}>
                <b>Problems:</b> a line that can't be read, a trigger bound twice, or one that also starts a longer sequence is an
                error and skipped (the earlier line wins). Overriding one of Discord's own shortcuts is a warning: still bound.
            </p>
        </div>
    );
}

/** `<required>` and `[optional]` arg names. */
const argsText = (a: Action) => (a.args ?? []).map(arg => arg.required ? `<${arg.name}>` : `[${arg.name}]`).join(" ");

function Actions({ actions, insert }: { actions: readonly Action[]; insert(text: string): void; }) {
    return (
        <div className="vc-qa-ref-body">
            <p>Click an action to insert it at the cursor.</p>
            <table>
                <thead>
                    <tr>
                        <th>id</th>
                        <th>args</th>
                        <th>what</th>
                    </tr>
                </thead>
                <tbody>
                    {actions.map(a => (
                        <tr
                            key={a.id}
                            className="vc-qa-ref-action"
                            // On press, not click: the editor keeps focus, and a blur's recheck can't move the row away before the click lands.
                            onMouseDown={e => {
                                if (e.button) return;
                                e.preventDefault();
                                insert(a.args?.length ? `${a.id} ` : a.id);
                            }}
                        >
                            <td className="vc-qa-ref-mono">{a.id}</td>
                            <td className="vc-qa-ref-mono" title={(a.args ?? []).map(arg => `${arg.name}: ${arg.description}`).join("\n")}>
                                {argsText(a)}
                            </td>
                            <td>{a.description}{a.holdable ? " (holdable)" : ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function Reference({ actions, insert }: { actions: readonly Action[]; insert(text: string): void; }) {
    return (
        <div className="vc-qa-ref">
            <details>
                <summary>Syntax</summary>
                <Syntax holdable={actions.filter(a => a.holdable).map(a => a.id)} />
            </details>
            <details>
                <summary>Actions</summary>
                <Actions actions={actions} insert={insert} />
            </details>
        </div>
    );
}
