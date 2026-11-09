/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createRoot } from "@webpack/common";
import type { ReactNode } from "react";

/**
 * Our own overlay (ADR 0001): small boxes drawn into a given window's document, because Discord's
 * toasts and modals only show in the main window. Each window has three slots, stacked bottom up:
 * binding feedback, the which-key hint, and a panel (`help`, `palette`). Showing in one slot leaves the
 * others alone, so feedback arriving while the palette is open doesn't take it down.
 */

export type OverlayKind = "info" | "success" | "error";
export type OverlaySlot = "feedback" | "hint" | "panel";

/** Top to bottom on screen. */
const SLOTS: OverlaySlot[] = ["panel", "hint", "feedback"];

export interface OverlayOptions {
    kind?: OverlayKind;
    /** Milliseconds before it hides itself; `null` keeps it until hidden. Default 2.5 s, 5 s for errors. */
    duration?: number | null;
}

export interface Overlay {
    /** Replace whatever this slot shows. Returns a hide that only hides this content. */
    show(content: ReactNode, opts?: OverlayOptions): () => void;
    hide(): void;
}

interface Layer {
    root: ReturnType<typeof createRoot>;
    timer?: ReturnType<typeof setTimeout>;
    /** Bumped per show, so a stale hide or timer leaves newer content alone. */
    shown: number;
}

interface Host {
    el: HTMLElement;
    layers: Record<OverlaySlot, Layer>;
}

const hosts = new Map<Document, Host>();

const ACCENT: Record<OverlayKind, string> = {
    info: "var(--brand-500, #5865f2)",
    success: "var(--status-positive, #23a55a)",
    error: "var(--status-danger, #f23f43)"
};

function OverlayBox({ kind, children }: { kind: OverlayKind; children: ReactNode; }) {
    return (
        <div
            role={kind === "error" ? "alert" : "status"}
            style={{
                maxWidth: "min(640px, calc(100vw - 32px))",
                padding: "8px 14px",
                borderRadius: 8,
                borderLeft: `4px solid ${ACCENT[kind]}`,
                background: "var(--background-floating, #111214)",
                color: "var(--text-normal, #dbdee1)",
                boxShadow: "var(--elevation-high, 0 8px 16px rgba(0,0,0,.24))",
                font: "500 14px/1.4 var(--font-primary, sans-serif)",
                whiteSpace: "pre-wrap"
            }}
        >
            {children}
        </div>
    );
}

function hostFor(doc: Document): Host {
    // Closed pop-outs leave their documents behind; forget them.
    for (const [d, h] of hosts) if (!d.defaultView || d.defaultView.closed) drop(d, h);

    let host = hosts.get(doc);
    // Discord re-rendering the body could take our host with it; start over then.
    if (host && !host.el.isConnected) {
        drop(doc, host);
        host = undefined;
    }
    if (!host) {
        const el = doc.createElement("div");
        el.id = "quick-actions-overlay";
        Object.assign(el.style, {
            position: "fixed", left: "50%", bottom: "32px", transform: "translateX(-50%)", zIndex: "100000",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", pointerEvents: "none"
        });
        doc.body.appendChild(el);
        const layers = Object.fromEntries(SLOTS.map(slot => {
            const div = doc.createElement("div");
            el.appendChild(div);
            return [slot, { root: createRoot(div), shown: 0 }];
        })) as Record<OverlaySlot, Layer>;
        host = { el, layers };
        hosts.set(doc, host);
    }
    return host;
}

function drop(doc: Document, host: Host) {
    for (const layer of Object.values(host.layers)) {
        clearTimeout(layer.timer);
        try {
            layer.root.unmount();
        } catch { /* its window is gone */ }
    }
    host.el.remove();
    hosts.delete(doc);
}

/** One slot of the overlay of the window that owns `doc` (default: the main window's feedback). */
export function overlay(doc: Document = document, slot: OverlaySlot = "feedback"): Overlay {
    const hide = () => {
        const layer = hosts.get(doc)?.layers[slot];
        if (!layer) return;
        clearTimeout(layer.timer);
        layer.shown++;
        layer.root.render(null);
    };
    return {
        hide,
        show(content, { kind = "info", duration = kind === "error" ? 5000 : 2500 } = {}) {
            const host = hostFor(doc);
            const layer = host.layers[slot];
            clearTimeout(layer.timer);
            const id = ++layer.shown;
            layer.root.render(<OverlayBox kind={kind}>{content}</OverlayBox>);
            const hideThis = () => {
                if (hosts.get(doc) === host && layer.shown === id) hide();
            };
            if (duration !== null) layer.timer = setTimeout(hideThis, duration);
            return hideThis;
        }
    };
}

/** Remove every overlay from every window (plugin stop). */
export function disposeOverlays() {
    for (const [d, h] of hosts) drop(d, h);
}
