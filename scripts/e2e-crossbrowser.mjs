/**
 * Cross-Browser WebRTC E2E Test
 *
 * Launches Chromium AND Firefox with separate fake webcams to validate
 * real cross-browser WebRTC: signaling, video tracks, screen share.
 *
 * Usage: node scripts/e2e-crossbrowser.mjs [baseUrl]
 */

import { chromium, firefox } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8888';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 15000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await sleep(intervalMs);
  }
  return null;
}

let passed = 0, failed = 0;
const results = [];

function assert(name, condition, detail = '') {
  if (condition) { passed++; results.push(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

// Cleanup function for spawned processes
const cleanupFns = [];
function onCleanup(fn) { cleanupFns.push(fn); }
process.once('exit', () => cleanupFns.forEach((fn) => { try { fn(); } catch {} }));
process.once('SIGINT', () => { cleanupFns.forEach((fn) => { try { fn(); } catch {} }); process.exit(130); });
process.once('SIGTERM', () => { cleanupFns.forEach((fn) => { try { fn(); } catch {} }); process.exit(143); });

async function openWorkspace(browserType, url, name, color) {
  const context = await browserType.launchPersistentContext('', {
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    ...(browserType.name() === 'firefox' ? {
      firefoxUserPrefs: {
        'media.navigator.streams.fake': true,
        'media.navigator.video.fake': true,
        'media.navigator.permission.disabled': true,
        'media.getusermedia.insecure.enabled': true,
        'media.devices.insecure.enabled': true,
      },
    } : {}),
  });
  onCleanup(() => context.close().catch(() => {}));

  const page = await context.newPage();
  await page.addInitScript(({ n, c }) => {
    localStorage.setItem('eventstormer_user', JSON.stringify({ name: n, color: c }));
  }, { n: name, c: color });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#tour-video-call', { timeout: 15000 });
  return { context, page };
}

async function startCall(page) {
  await page.evaluate(() => document.querySelector('#tour-video-call')?.click());
}

async function getState(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('#tour-video-call');
    const videos = Array.from(document.querySelectorAll('video'));
    return {
      callText: btn?.textContent?.trim(),
      videoCount: videos.length,
      videosWithTracks: videos.filter((v) => v.srcObject && v.srcObject.getTracks().length > 0).length,
      videosWithNonZeroSize: videos.filter((v) => v.videoWidth > 0).length,
    };
  });
}

try {
  console.log('🌐 Cross-Browser WebRTC E2E (Chromium ↔ Firefox)');
  console.log(`   Target: ${BASE}\n`);

  const roomId = `xbr-${Date.now().toString(36)}`;
  const url = `${BASE}/w/${roomId}`;

  // ── Open Chromium (Alice) and Firefox (Bob) ──
  console.log('Opening Chromium (Alice) + Firefox (Bob)...');
  const { context: ctx1, page: page1 } = await openWorkspace(chromium, url, 'Alice (Chromium)', '#3b82f6');
  const { context: ctx2, page: page2 } = await openWorkspace(firefox, url, 'Bob (Firefox)', '#ef4444');
  console.log('Both browsers loaded.');

  // ── Test 1: Cross-browser call establishment ──
  console.log('\nTest 1: Cross-browser call establishment');
  await startCall(page1);
  await sleep(2000);
  await startCall(page2);

  await waitFor(async () => {
    const s1 = await getState(page1);
    const s2 = await getState(page2);
    return s1.callText?.includes('(2)') && s2.callText?.includes('(2)');
  }, 20000);

  const state1 = await getState(page1);
  const state2 = await getState(page2);
  assert('Chromium sees 2 participants', state1.callText?.includes('(2)'), state1.callText);
  assert('Firefox sees 2 participants', state2.callText?.includes('(2)'), state2.callText);

  // ── Test 2: Cross-browser video tracks flow ──
  console.log('\nTest 2: Cross-browser video tracks flowing');
  await waitFor(async () => {
    const s = await getState(page1);
    return s.videosWithTracks >= 2;
  }, 15000);

  const final1 = await getState(page1);
  const final2 = await getState(page2);
  assert('Chromium receives video tracks', final1.videosWithTracks >= 2, `${final1.videosWithTracks} streams with tracks`);
  assert('Firefox receives video tracks', final2.videosWithTracks >= 2, `${final2.videosWithTracks} streams with tracks`);
  assert('Chromium video has non-zero dimensions', final1.videosWithNonZeroSize > 0);
  assert('Firefox video has non-zero dimensions', final2.videosWithNonZeroSize > 0);

  // ── Test 3: Cross-browser screen share ──
  console.log('\nTest 3: Cross-browser screen share');
  await page1.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title')?.includes('Share your screen'));
    if (btn) btn.click();
  });

  await waitFor(async () => {
    const s = await page2.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      return videos.some((v) => v.srcObject && v.srcObject.getVideoTracks().some((t) => t.label === 'remote video' && v.videoWidth > 640));
    });
    return s;
  }, 20000);

  const bobScreen = await page2.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    return {
      screenStreams: videos.filter((v) => v.srcObject && v.srcObject.getVideoTracks().some((t) => t.label === 'remote video' && v.videoWidth > 640)).length,
      dimensions: videos.filter((v) => v.videoWidth > 640).map((v) => `${v.videoWidth}x${v.videoHeight}`),
    };
  });
  assert('Firefox receives Chromium screen share', bobScreen.screenStreams > 0,
    `${bobScreen.screenStreams} streams at ${bobScreen.dimensions.join(', ')}`);

  // ── Summary ──
  console.log('\n' + '═'.repeat(55));
  console.log(results.join('\n'));
  console.log('═'.repeat(55));
  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);

  await ctx1.close();
  await ctx2.close();
} catch (err) {
  console.error('Harness error:', err.message);
  failed++;
} finally {
  cleanupFns.forEach((fn) => { try { fn(); } catch {} });
  process.exit(failed > 0 ? 1 : 0);
}
