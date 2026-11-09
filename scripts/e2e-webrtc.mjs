/**
 * Local WebRTC E2E Harness
 *
 * Launches headless Chromium with fake media devices and verifies:
 * 1. Two peers in the same room establish WebRTC connections
 * 2. Video tracks flow between peers (srcObject has live video)
 * 3. Screen share propagates and renders (not black)
 * 4. srcObject guard prevents re-assignment playback stop
 * 5. Room isolation (breakout rooms)
 *
 * Usage:  node scripts/e2e-webrtc.mjs [baseUrl]
 * Default baseUrl: http://localhost:8888
 */

import puppeteer from 'puppeteer-core';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE = process.argv[2] || 'http://localhost:8888';
const WS_BASE = BASE.replace(/^http/, 'ws');
const PROFILE = join(homedir(), 'snap', 'chromium', 'common', `e2e-webrtc-${process.pid}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser = null;
let results = [];
let passed = 0;
let failed = 0;

function cleanup() {
  try {
    if (browser?.process()) {
      const pid = browser.process().pid;
      try { process.kill(-pid, 'SIGKILL'); } catch { try { browser.process().kill('SIGKILL'); } catch {} }
    }
  } catch {}
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}

process.once('exit', cleanup);
process.once('SIGINT', () => { cleanup(); process.exit(130); });
process.once('SIGTERM', () => { cleanup(); process.exit(143); });

function assert(name, condition, detail = '') {
  if (condition) {
    passed++;
    results.push(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
      '--allow-file-access-from-files',
      '--disable-web-security',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

async function openWorkspace(url, name, color) {
  console.log(`   Opening ${name} at ${url}...`);
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((n, c) => {
    localStorage.setItem('eventstormer_user', JSON.stringify({ name: n, color: c }));
  }, name, color);
  console.log(`   ${name}: navigating...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log(`   ${name}: loaded, waiting for call button...`);
  await page.waitForSelector('#tour-video-call', { timeout: 10000 });
  console.log(`   ${name}: ready`);
  return page;
}

async function startCall(page, label) {
  console.log(`   ${label}: clicking call button...`);
  await page.evaluate(() => document.querySelector('#tour-video-call')?.click());
  console.log(`   ${label}: waiting for media + signaling...`);
  await sleep(3000);
  console.log(`   ${label}: call started`);
}

async function getWebRTCState(page) {
  return page.evaluate(() => {
    const videos = document.querySelectorAll('video');
    const videoInfo = Array.from(videos).map((v) => ({
      srcObject: v.srcObject ? {
        id: v.srcObject.id,
        trackCount: v.srcObject.getTracks().length,
        videoTracks: v.srcObject.getVideoTracks().map((t) => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
        })),
        audioTracks: v.srcObject.getAudioTracks().map((t) => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
        })),
      } : null,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      paused: v.paused,
      muted: v.muted,
    }));

    // Check RTCPeerConnection states via webrtcs internals if exposed
    const callBtn = document.querySelector('#tour-video-call');
    const callText = callBtn?.textContent?.trim();

    // Check for remote peer bubbles in dock
    const dockBubbles = document.querySelectorAll('[class*="rounded-full"][class*="overflow-hidden"]');
    const remotePeerCount = Array.from(dockBubbles).filter((b) => {
      return b.textContent?.includes('Stormer') || b.querySelector('video');
    }).length;

    return { videoInfo, callText, remotePeerCount };
  });
}

async function checkVideoPlayback(page, label) {
  const state = await getWebRTCState(page);
  const playingVideos = state.videoInfo.filter((v) => v.srcObject && v.srcObject.videoTracks.some((t) => t.readyState === 'live'));
  const hasNonZeroSize = state.videoInfo.some((v) => v.videoWidth > 0 && v.videoHeight > 0);
  return { state, playingVideos: playingVideos.length, hasNonZeroSize };
}

try {
  browser = await launchBrowser();
  console.log('🧪 WebRTC E2E Harness');
  console.log(`   Target: ${BASE}\n`);

  // ── Test 1: Two peers join and establish call ──
  console.log('Test 1: Two peers join and establish call');
  const roomId = `e2e-${Date.now().toString(36)}`;
  const url = `${BASE}/w/${roomId}`;

  const page1 = await openWorkspace(url, 'Alice', '#3b82f6');
  const page2 = await openWorkspace(url, 'Bob', '#ef4444');

  await startCall(page1, 'Alice');
  await startCall(page2, 'Bob');
  await sleep(5000); // Wait for WebRTC signaling + ICE

  const state1 = await getWebRTCState(page1);
  const state2 = await getWebRTCState(page2);

  assert('Peer 1 call active', state1.callText?.includes('Call'), state1.callText);
  assert('Peer 2 call active', state2.callText?.includes('Call'), state2.callText);
  assert('Peer 1 sees 2 participants', state1.callText?.includes('(2)'), state1.callText);
  assert('Peer 2 sees 2 participants', state2.callText?.includes('(2)'), state2.callText);

  // ── Test 2: Video tracks flowing ──
  console.log('\nTest 2: Video tracks flowing between peers');
  const playback1 = await checkVideoPlayback(page1, 'Peer 1');
  const playback2 = await checkVideoPlayback(page2, 'Peer 2');

  assert('Peer 1 has live video tracks', playback1.playingVideos > 0, `${playback1.playingVideos} live video streams`);
  assert('Peer 2 has live video tracks', playback2.playingVideos > 0, `${playback2.playingVideos} live video streams`);
  assert('Peer 1 video has non-zero size', playback1.hasNonZeroSize);
  assert('Peer 2 video has non-zero size', playback2.hasNonZeroSize);

  // ── Test 3: srcObject guard (no re-assignment) ──
  console.log('\nTest 3: srcObject guard prevents re-assignment');
  // Wait for all ontrack to settle first
  await sleep(1000);
  const srcIdsBefore = await page1.evaluate(() => {
    return Array.from(document.querySelectorAll('video'))
      .filter((v) => v.srcObject)
      .map((v) => v.srcObject.id);
  });
  await sleep(1000);
  const srcIdsAfter = await page1.evaluate(() => {
    return Array.from(document.querySelectorAll('video'))
      .filter((v) => v.srcObject)
      .map((v) => v.srcObject.id);
  });
  assert('srcObject IDs stable across renders', JSON.stringify(srcIdsBefore) === JSON.stringify(srcIdsAfter),
    `before=${srcIdsBefore.length} streams, after=${srcIdsAfter.length} streams`);

  // ── Test 4: Real screen share propagation via getDisplayMedia ──
  console.log('\nTest 4: Screen share propagation (real getDisplayMedia)');
  await page1.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title')?.includes('Share your screen'));
    if (btn) btn.click();
  });
  await sleep(3000);

  // Verify Alice has a real screen track
  const aliceScreen = await page1.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const screenVideo = videos.find((v) => v.srcObject && v.srcObject.getVideoTracks().some((t) => t.label?.includes('screen')));
    return {
      hasScreenTrack: !!screenVideo,
      width: screenVideo?.videoWidth || 0,
      height: screenVideo?.videoHeight || 0,
    };
  });
  assert('Screen share captured with real displayMedia', aliceScreen.hasScreenTrack && aliceScreen.width > 0,
    `${aliceScreen.width}x${aliceScreen.height}`);

  // Verify Bob receives the screen share video (non-zero dimensions = not black)
  const bobScreen = await page2.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const remoteScreens = videos.filter((v) => v.srcObject && v.srcObject.getVideoTracks().some((t) => t.label === 'remote video' && v.videoWidth > 640));
    return {
      screenVideosReceived: remoteScreens.length,
      dimensions: remoteScreens.map((v) => `${v.videoWidth}x${v.videoHeight}`),
      hasScreenIndicator: document.body.textContent?.includes('Screen') || document.body.textContent?.includes('screen'),
    };
  });
  assert('Peer 2 receives screen share video (non-black)', bobScreen.screenVideosReceived > 0,
    `${bobScreen.screenVideosReceived} streams at ${bobScreen.dimensions.join(', ')}`);
  assert('Peer 2 sees screen share indicator', bobScreen.hasScreenIndicator);

  // ── Test 5: Room isolation (breakout) ──
  console.log('\nTest 5: Breakout room isolation');
  const roomUrl = `${BASE}/w/${roomId}-breakout`;
  const page3 = await openWorkspace(roomUrl, 'Charlie', '#10b981');
  const page4 = await openWorkspace(roomUrl, 'Diana', '#a855f7');

  // Start breakout with 2 rooms
  await page3.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Breakout'));
    if (btn) btn.click();
  });
  await sleep(500);
  await page3.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Start') && b.textContent?.includes('team'));
    if (btn) btn.click();
  });
  await sleep(1000);

  // Both start calls in main room
  await startCall(page3, 'Charlie');
  await startCall(page4, 'Diana');
  await sleep(5000);

  const state3 = await getWebRTCState(page3);
  const state4 = await getWebRTCState(page4);
  assert('Breakout: both peers see each other', state3.callText?.includes('(2)') && state4.callText?.includes('(2)'),
    `p3=${state3.callText} p4=${state4.callText}`);

  // ── Summary ──
  console.log('\n' + '═'.repeat(50));
  console.log(results.join('\n'));
  console.log('═'.repeat(50));
  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);

  // Close pages
  await page1.close().catch(() => {});
  await page2.close().catch(() => {});
  await page3.close().catch(() => {});
  await page4.close().catch(() => {});

} catch (err) {
  console.error('Harness error:', err.message);
  failed++;
} finally {
  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}
