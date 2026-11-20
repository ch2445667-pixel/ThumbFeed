import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APPEARANCE,
  GLASS_STYLE_PRESETS,
  WALLPAPER_PRESETS,
  sanitizeAppearanceSettings,
  computeGlassCssVariables,
  getWallpaperPresetById,
  getGlassStylePresetById,
  type GlassStyleId,
} from './appearance';

test('sanitizeAppearanceSettings returns defaults for invalid inputs', () => {
  assert.deepEqual(sanitizeAppearanceSettings(null), DEFAULT_APPEARANCE);
  assert.deepEqual(sanitizeAppearanceSettings('bad'), DEFAULT_APPEARANCE);
  assert.deepEqual(sanitizeAppearanceSettings({}), DEFAULT_APPEARANCE);
  assert.equal(DEFAULT_APPEARANCE.wallpaperPreset, 'ember-void');
});

test('sanitizeAppearanceSettings clamps slider ranges and rejects invalid styles/presets', () => {
  const result = sanitizeAppearanceSettings({
    style: 'neon-invalid',
    glassBlur: 999,
    glassOpacity: -50,
    bgBlur: 80,
    bgDim: 150,
    wallpaperPreset: 'nonexistent-wallpaper',
    customBgImage: '',
  });

  assert.equal(result.style, DEFAULT_APPEARANCE.style);
  assert.equal(result.glassBlur, 48);
  assert.equal(result.glassOpacity, 0);
  assert.equal(result.bgBlur, 32);
  assert.equal(result.bgDim, 80);
  assert.equal(result.wallpaperPreset, DEFAULT_APPEARANCE.wallpaperPreset);
});

test('sanitizeAppearanceSettings blocks unsafe customBgImage URLs including SVGs and javascript:', () => {
  const jsUrl = sanitizeAppearanceSettings({
    customBgImage: 'javascript:alert(1)',
  });
  assert.equal(jsUrl.customBgImage, '');

  const svgData = sanitizeAppearanceSettings({
    customBgImage: 'data:image/svg+xml;base64,PHN2Zy8+',
  });
  assert.equal(svgData.customBgImage, '');

  const validHttps = sanitizeAppearanceSettings({
    customBgImage: 'https://images.example.com/backdrop.webp',
  });
  assert.equal(validHttps.customBgImage, 'https://images.example.com/backdrop.webp');

  const validPngData = sanitizeAppearanceSettings({
    customBgImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  });
  assert.ok(validPngData.customBgImage.startsWith('data:image/png;base64,'));
});

test('computeGlassCssVariables produces distinct dual-gradient liquid glass profiles for all 5 styles', () => {
  const styles: GlassStyleId[] = ['liquid', 'clear', 'frosted', 'smoked', 'prism'];
  const outputs = styles.map((style) =>
    computeGlassCssVariables({
      ...DEFAULT_APPEARANCE,
      style,
      glassBlur: 20,
      glassOpacity: 40,
      bgBlur: 8,
      bgDim: 20,
    })
  );

  for (const vars of outputs) {
    assert.equal(vars['--glass-blur'], '20px');
    assert.equal(vars['--bg-blur'], '8px');
    assert.equal(vars['--bg-dim'], '0.20');
    assert.ok(Number(vars['--bg-scale']) > 1);
    assert.ok(vars['--glass-bg-sidebar'].startsWith('rgba('));
    assert.ok(vars['--glass-border'].startsWith('rgba('));
    assert.ok(vars['--glass-grad-control'].includes('linear-gradient(180deg'));
    assert.ok(vars['--glass-grad-card'].includes('linear-gradient(180deg'));
    assert.ok(vars['--glass-grad-input'].includes('linear-gradient(180deg'));
    assert.ok(vars['--glass-grad-sidebar'].includes('linear-gradient(180deg'));
  }

  // Distinct sidebar surface recipes across styles
  const uniqueSidebars = new Set(outputs.map((v) => v['--glass-grad-sidebar']));
  assert.equal(uniqueSidebars.size, 5);

  // Clear glass should have lower sidebar alpha than smoked glass at identical opacity slider
  const clearVars = outputs[1];
  const smokedVars = outputs[3];
  const parseAlpha = (rgba: string) => Number(rgba.split(',')[3].replace(')', '').trim());
  assert.ok(parseAlpha(clearVars['--glass-bg-sidebar']) < parseAlpha(smokedVars['--glass-bg-sidebar']));
});

test('computeGlassCssVariables calibrates default white glows to 65% and scales with topGlow/buttonGlow', () => {
  const defaults = computeGlassCssVariables(DEFAULT_APPEARANCE);
  assert.equal(DEFAULT_APPEARANCE.topGlow, 65);
  assert.equal(DEFAULT_APPEARANCE.buttonGlow, 65);
  assert.equal(defaults['--glass-specular'], 'rgba(255, 255, 255, 0.156)');
  assert.equal(defaults['--glass-specular-control'], 'rgba(255, 255, 255, 0.156)');
  assert.equal(defaults['--glass-specular-workspace'], 'rgba(255, 255, 255, 0.117)');
  assert.equal(defaults['--glass-specular-header'], 'rgba(255, 255, 255, 0.091)');
  assert.equal(defaults['--glass-specular-card'], 'rgba(255, 255, 255, 0.104)');

  const zeroGlow = computeGlassCssVariables({
    ...DEFAULT_APPEARANCE,
    topGlow: 0,
    buttonGlow: 0,
  });
  assert.equal(zeroGlow['--glass-specular'], 'rgba(255, 255, 255, 0)');
  assert.equal(zeroGlow['--glass-specular-control'], 'rgba(255, 255, 255, 0)');
  assert.equal(zeroGlow['--glass-pill-active-bg'], 'rgba(255, 255, 255, 0)');

  const fullGlow = computeGlassCssVariables({
    ...DEFAULT_APPEARANCE,
    topGlow: 100,
    buttonGlow: 100,
  });
  assert.equal(fullGlow['--glass-specular'], 'rgba(255, 255, 255, 0.24)');
  assert.equal(fullGlow['--glass-specular-control'], 'rgba(255, 255, 255, 0.24)');
});

test('presets lookup helpers always resolve a valid preset', () => {
  assert.equal(WALLPAPER_PRESETS.length, 8);
  assert.equal(GLASS_STYLE_PRESETS.length, 5);
  assert.equal(getWallpaperPresetById('missing').id, 'ember-void');
  assert.equal(getGlassStylePresetById('frosted').name, 'Frosted');
});
