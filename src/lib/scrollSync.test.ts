import { describe, it, expect } from 'vitest';
import { interpolateScrollPosition, resolvePreviewBlockElement, mapScrollPosition } from './scrollSync';

describe('interpolateScrollPosition', () => {
    it('maps proportionally within a span', () => {
        expect(interpolateScrollPosition(5, [0, 10], [0, 100])).toBeCloseTo(50);
    });

    it('clamps out-of-range positions', () => {
        expect(interpolateScrollPosition(-5, [0, 10], [0, 100])).toBe(0);
        expect(interpolateScrollPosition(99, [0, 10], [0, 100])).toBe(100);
    });

    it('handles multi-anchor segments', () => {
        // 0->0, 10->100, 20->120 : position 15 should map to 110
        expect(interpolateScrollPosition(15, [0, 10, 20], [0, 100, 120])).toBeCloseTo(110);
    });

    it('returns 0 on mismatched anchors', () => {
        expect(interpolateScrollPosition(5, [0], [0])).toBe(0);
        expect(interpolateScrollPosition(5, [0, 10], [0])).toBe(0);
    });
});

describe('resolvePreviewBlockElement', () => {
    it('keeps block-level nodes as-is', () => {
        const root = document.createElement('div');
        const li = document.createElement('li');
        li.setAttribute('data-md-index', '0');
        root.appendChild(li);
        expect(resolvePreviewBlockElement(li, root)).toBe(li);
    });

    it('climbs from inner span to card section', () => {
        const root = document.createElement('div');
        const card = document.createElement('section');
        const inner = document.createElement('span');
        inner.setAttribute('data-md-index', '0');
        card.appendChild(inner);
        root.appendChild(card);

        expect(resolvePreviewBlockElement(inner, root)).toBe(card);
    });

    it('stops at per-item row when parent wraps multiple blocks', () => {
        const root = document.createElement('div');
        const wrap = document.createElement('section');

        const row1 = document.createElement('section');
        const span1 = document.createElement('span');
        span1.setAttribute('data-md-index', '0');
        row1.appendChild(span1);

        const row2 = document.createElement('section');
        const span2 = document.createElement('span');
        span2.setAttribute('data-md-index', '1');
        row2.appendChild(span2);

        wrap.appendChild(row1);
        wrap.appendChild(row2);
        root.appendChild(wrap);

        expect(resolvePreviewBlockElement(span1, root)).toBe(row1);
        expect(resolvePreviewBlockElement(span2, root)).toBe(row2);
    });
});

describe('mapScrollPosition', () => {
    const uniform = {
        sourceMax: 4200,
        sourceViewport: 800,
        targetMax: 7200,
        targetViewport: 800,
        sourceTop: [0, 4200],
        targetTop: [0, 7200],
        sourceContent: [0, 5000],
        targetContent: [0, 8000],
    };

    it('pins top and bottom exactly', () => {
        expect(mapScrollPosition({ ...uniform, sourceScroll: 0 })).toBe(0);
        expect(mapScrollPosition({ ...uniform, sourceScroll: 4200 })).toBe(7200);
    });

    it('stays close to ratio mapping for uniform content', () => {
        // e2e 容差 0.12，这里要求更高：0.05 以内
        for (const ratio of [0.28, 0.5, 0.72]) {
            const s = ratio * uniform.sourceMax;
            const t = mapScrollPosition({ ...uniform, sourceScroll: s });
            expect(Math.abs(t / uniform.targetMax - ratio)).toBeLessThan(0.05);
        }
    });
});
