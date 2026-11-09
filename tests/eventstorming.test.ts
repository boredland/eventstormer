import { describe, it, expect } from 'vitest';
import {
  STICKY_DEFINITIONS,
  WORKSHOP_FORMATS,
  SAMPLE_TEMPLATES,
  StickyType,
} from '../src/shared/eventstorming';

describe('EventStorming Brandolini Grammar & Semantics', () => {
  it('defines all required sticky types according to Brandolini notation', () => {
    const requiredTypes: StickyType[] = [
      'domain-event',
      'hotspot',
      'actor',
      'system',
      'opportunity',
      'command',
      'policy',
      'readmodel',
      'constraint',
    ];

    for (const t of requiredTypes) {
      expect(STICKY_DEFINITIONS[t]).toBeDefined();
      expect(STICKY_DEFINITIONS[t].type).toBe(t);
      expect(STICKY_DEFINITIONS[t].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(STICKY_DEFINITIONS[t].geometry.width).toBeGreaterThan(0);
      expect(STICKY_DEFINITIONS[t].geometry.height).toBeGreaterThan(0);
    }
  });

  it('domain events are orange squares', () => {
    const eventDef = STICKY_DEFINITIONS['domain-event'];
    expect(eventDef.color.toUpperCase()).toBe('#FF9F1C');
    expect(eventDef.geometry.shape).toBe('square');
  });

  it('hotspots have neon pink color and -6 degree tilt', () => {
    const hotspotDef = STICKY_DEFINITIONS['hotspot'];
    expect(hotspotDef.color.toUpperCase()).toBe('#FF2E88');
    expect(hotspotDef.geometry.rotation).toBe(-6);
  });

  it('validates all three workshop formats and their phases', () => {
    expect(WORKSHOP_FORMATS['big-picture']).toBeDefined();
    expect(WORKSHOP_FORMATS['process-modelling']).toBeDefined();
    expect(WORKSHOP_FORMATS['software-design']).toBeDefined();

    for (const format of Object.values(WORKSHOP_FORMATS)) {
      expect(format.phases.length).toBeGreaterThan(0);
      format.phases.forEach((phase, idx) => {
        expect(phase.number).toBe(idx + 1);
        expect(phase.title.length).toBeGreaterThan(0);
        expect(phase.suggestedStickies.length).toBeGreaterThan(0);
      });
    }
  });

  it('validates pre-packaged templates contain valid coordinates and items', () => {
    const templateKeys = ['ecommerce-fulfillment', 'insurance-claims', 'ride-hailing-dispatch'];
    for (const key of templateKeys) {
      const tpl = SAMPLE_TEMPLATES[key];
      expect(tpl).toBeDefined();
      expect(tpl.stickies.length).toBeGreaterThan(5);
      expect(tpl.pivotalLines.length).toBeGreaterThan(1);
      expect(tpl.swimlanes.length).toBeGreaterThan(1);

      // Verify stickies have non-negative positions and valid types
      for (const s of tpl.stickies) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(STICKY_DEFINITIONS[s.type]).toBeDefined();
      }
    }
  });
});
