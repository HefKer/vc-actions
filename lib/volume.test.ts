/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { amplitudeToPercent, applyVolumeChange, parseVolumeChange, percentToAmplitude } from "./volume.ts";

test("a bare number sets the volume", () => {
    assert.deepEqual(parseVolumeChange("80"), { ok: true, change: { set: 80 } });
});

test("+n and -n adjust the volume", () => {
    assert.deepEqual(parseVolumeChange("+20"), { ok: true, change: { by: 20 } });
    assert.deepEqual(parseVolumeChange("-15"), { ok: true, change: { by: -15 } });
});

test("a trailing % and surrounding spaces are allowed", () => {
    assert.deepEqual(parseVolumeChange(" 150% "), { ok: true, change: { set: 150 } });
});

test("anything else is an error that shows the accepted forms", () => {
    for (const bad of ["", "loud", "+", "1e3", "--5", undefined]) {
        const r = parseVolumeChange(bad);
        assert.equal(r.ok, false, String(bad));
        assert.match((r as { error: string; }).error, /n.*\+n.*-n/);
    }
});

test("set replaces and adjust adds to the current volume", () => {
    assert.equal(applyVolumeChange(100, { set: 80 }, 200), 80);
    assert.equal(applyVolumeChange(100, { by: 20 }, 200), 120);
    assert.equal(applyVolumeChange(100, { by: -30 }, 200), 70);
});

test("the result is clamped to 0..max", () => {
    assert.equal(applyVolumeChange(190, { by: 20 }, 200), 200);
    assert.equal(applyVolumeChange(10, { by: -20 }, 200), 0);
    assert.equal(applyVolumeChange(100, { set: 300 }, 200), 200);
    assert.equal(applyVolumeChange(100, { set: 300 }, 400), 300);
});

test("adjusting from a slightly-off current value lands on a whole percent", () => {
    assert.equal(applyVolumeChange(99.98, { by: 20 }, 200), 120);
});

// Expected values are Discord's own slider conversion, evaluated live (module with M/w, 2026-11-08).
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test("slider percent converts to the stored amplitude the way Discord's slider does", () => {
    close(percentToAmplitude(0), 0);
    close(percentToAmplitude(50), 14.358729437462939);
    close(percentToAmplitude(100), 100);
    close(percentToAmplitude(150), 141.25375446227542);
    close(percentToAmplitude(200), 199.52623149688796);
    close(percentToAmplitude(400), 794.3282347242816);
});

test("stored amplitude converts back to the slider percent", () => {
    close(amplitudeToPercent(0), 0);
    close(amplitudeToPercent(50), 78.07091821557101);
    close(amplitudeToPercent(100), 100);
    close(amplitudeToPercent(150), 158.69708635189374);
    close(amplitudeToPercent(200), 200.34333188799374);
});

test("a stored max-slider volume reads back as 200%", () => {
    assert.equal(Math.round(amplitudeToPercent(199.52622985839844)), 200);
});
