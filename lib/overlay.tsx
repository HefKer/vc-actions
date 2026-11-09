/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createRoot } from "@webpack/common";
import type { ReactNode } from "react";

/**
 * Our own overlay (ADR 0001): one small box drawn into a given window's document, because Discord's
 * toasts and modals only show in the main window. Used for binding feedback; meant to also carry the
 * which-key hint, `help` and `palette`.
 */

export type OverlayKind = "info" | "success" | "error";

export interface OverlayOptions {
    kind?: OverlayKind;
    /** Milliseconds before it hides itself; `null` keeps it until hidden. Default 2.5 s, 5 s for errors. */
    duration?: number | null;
}

export interface Overlay {
    /** Replace whatever this window's overlay shows. Returns a hide that only hides this content. */
    show(content: ReactNode, opts?: OverlayOptions): () => void;
    hide(): void;
}

interface Slot {
    host: HTMLElement;
    root: ReturnType<typeof createRoot>;
    timer?: ReturnType<typeof setTimeout>;
    /** Bumped per show, so a stale hide or timer leaves newer content alone. */
    shown: number;
}

const slots = new Map<Document, Slot>();

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
                position: "fixed",
                left: "50%",
                bottom: 32,
                transform: "translateX(-50%)",
                zIndex: 100000,
                maxWidth: "min(640px, calc(100vw - 32px))",
                padding: "8px 14px",
                borderRadius: 8,
                borderLeft: `4px solid ${ACCENT[kind]}`,
                background: "var(--background-floating, #111214)",
                color: "var(--text-normal, #dbdee1)",
                boxShadow: "var(--elevation-high, 0 8px 16px rgba(0,0,0,.24))",
                font: "500 14px/1.4 var(--font-primary, sans-serif)",
                whiteSpace: "pre-wrap",
                pointerEvents: "none"
            }}
        >
            {children}
        </div>
    );
}

function slotFor(doc: Document): Slot {
    // Closed pop-outs leave their documents behind; forget them.
    for (const [d, s] of slots) if (!d.defaultView || d.defaultView.closed) drop(d, s);

    let slot = slots.get(doc);
    // Discord re-rendering the body could take our host with it; start over then.
    if (slot && !slot.host.isConnected) {
        drop(doc, slot);
        slot = undefined;
    }
    if (!slot) {
        const host = doc.createElement("div");
        host.id = "vc-actions-overlay";
        doc.body.appendChild(host);
        slot = { host, root: createRoot(host), shown: 0 };
        slots.set(doc, slot);
    }
    return slot;
}

function drop(doc: Document, slot: Slot) {
    clearTimeout(slot.timer);
    try {
        slot.root.unmount();
    } catch { /* its window is gone */ }
    slot.host.remove();
    slots.delete(doc);
}

/** The overlay of the window that owns `doc` (default: the main window). */
export function overlay(doc: Document = document): Overlay {
    const hide = () => {
        const slot = slots.get(doc);
        if (!slot) return;
        clearTimeout(slot.timer);
        slot.shown++;
        slot.root.render(null);
    };
    return {
        hide,
        show(content, { kind = "info", duration = kind === "error" ? 5000 : 2500 } = {}) {
            const slot = slotFor(doc);
            clearTimeout(slot.timer);
            const id = ++slot.shown;
            slot.root.render(<OverlayBox kind={kind}>{content}</OverlayBox>);
            const hideThis = () => {
                if (slots.get(doc) === slot && slot.shown === id) hide();
            };
            if (duration !== null) slot.timer = setTimeout(hideThis, duration);
            return hideThis;
        }
    };
}

/** Remove every overlay from every window (plugin stop). */
export function disposeOverlays() {
    for (const [d, s] of slots) drop(d, s);
}
