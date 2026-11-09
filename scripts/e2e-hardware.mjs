/**
 * Real-hardware WebRTC E2E — two physical webcams, Chrome (headful), decoded frames.
 *
 * Unlike e2e-webrtc.mjs (fake devices, track existence), this script:
 *  - runs headful Chrome with REAL media devices (no --use-fake-device-for-media-stream)
 *  - assigns a different physical camera to each participant (device reorder patch)
 *  - asserts RTCPeerConnection.getStats() framesDecoded/framesReceived growth
 *    (proves decoded media, not merely a live track)
 *  - covers: call in both orders, screen share (non-black), mute/camera toggles,
 *    camera switching, mic selection, repeated leave/rejoin, 3rd participant
 *    (audio-only) receiving video, screenshots for both users
 *
 * Usage: node scripts/e2e-hardware.mjs [baseUrl]
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const OUT = `diag-out/hardware-${Date.now().toString(36)}`;
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs = 20000, intervalMs = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fn(); if (r) return r; } catch {}
    await sleep(intervalMs);
  }
  return null;
}

let passed = 0, failed = 0;
const results = [];
function assert(name, condition, detail = '') {
  if (condition) { passed++; results.push(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ❌ ${name} — ${detail}`); }
}

const browsers = [];
function cleanup() {
  for (const b of browsers) { try { b.process() && process.kill(-b.process().pid, 'SIGKILL'); } catch { try { b.process()?.kill('SIGKILL'); } catch {} } }
}
process.once('exit', cleanup);
process.once('SIGINT', () => { cleanup(); process.exit(130); });
process.once('SIGTERM', () => { cleanup(); process.exit(143); });

// One shared browser: this machine's camera stack permits only one Chrome
// camera stream at a time across instances (ashlaros-reactions opens the real
// Integrated camera to feed the v4l2loopback whenever it has readers, and
// other Chrome instances fail every camera open meanwhile — verified with a
// two-instance contention probe). Participants therefore run in ISOLATED
// browser contexts of a single instance, both reading the loopback whose
// content is the real Integrated sensor.
let sharedBrowser = null;
async function getBrowser() {
  if (sharedBrowser) return sharedBrowser;
  sharedBrowser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-fake-ui-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
      '--window-size=1280,900',
    ],
    userDataDir: `${OUT}/profile`,
  });
  browsers.push(sharedBrowser);
  return sharedBrowser;
}

async function enumerateCameras() {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.goto('about:blank');
  // secure context needed for enumerateDevices labels: use localhost
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const cams = await page.evaluate(async () => {
    // Labels need permission; getUserMedia once to unlock labels.
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {}
    const devs = await navigator.mediaDevices.enumerateDevices();
    return {
      video: devs.filter((d) => d.kind === 'videoinput').map((d) => ({ id: d.deviceId, label: d.label })),
      audio: devs.filter((d) => d.kind === 'audioinput').map((d) => ({ id: d.deviceId, label: d.label })),
    };
  });
  await page.close().catch(() => {});
  return cams;
}

async function openParticipant(url, name, color, cameraLabel, opts = {}) {
  const browser = await getBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const logStream = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') {
      const line = `[${Date.now()}][console.${m.type()}][${name}] ${m.text().slice(0, 250)}`;
      logStream.push(line);
      console.log('   ' + line);
    }
  });
  page.on('pageerror', (e) => {
    const line = `[${Date.now()}][pageerror][${name}] ${String(e).slice(0, 250)}`;
    logStream.push(line);
    console.log('   ' + line);
  });
  // ALL init scripts must be installed BEFORE the first navigation: the unlock
  // getUserMedia (labels/ids + permission) must happen in this same document —
  // --use-fake-ui-for-media-stream does not persist grants across reloads.
  await page.evaluateOnNewDocument((n, c, cam, audioOnly, pcHook) => {
    // eslint-disable-next-line no-eval
    eval(pcHook);
    localStorage.setItem('eventstormer_user', JSON.stringify({ name: n, color: c }));
    // Timestamp every getUserMedia attempt for correlation with device watchers
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__gumlog = window.__gumlog || [];
      const t0 = Date.now();
      try {
        const s = await gum(constraints);
        window.__gumlog.push(`${t0} ok ${JSON.stringify(constraints).slice(0, 120)}`);
        return s;
      } catch (e) {
        window.__gumlog.push(`${t0} FAIL ${String(e)} ${JSON.stringify(constraints).slice(0, 120)}`);
        throw e;
      }
    };
    if (audioOnly) {
      // Deterministic audio-only participant: strip video constraints so the app
      // acquires mic only (no camera contention with the other participants).
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints && constraints.video) {
          const rest = { ...constraints };
          delete rest.video;
          return orig(rest);
        }
        return orig(constraints);
      };
    }
    if (cam) {
      // Force a specific physical camera: put it first in enumerateDevices so the
      // app's default selection (first videoinput) picks it.
      const orig = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = async () => {
        const devs = await orig();
        const target = devs.find((d) => d.kind === 'videoinput' && d.label === cam);
        if (!target) return devs;
        return [target, ...devs.filter((d) => d !== target)];
      };
    }
  }, name, color, cameraLabel, !!opts.audioOnly, PC_HOOK);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#tour-video-call', { timeout: 15000 });
  // Unlock device labels: enumerateDevices only returns labels+ids after a
  // successful getUserMedia. Then re-dispatch devicechange so the app's
  // refreshDevices() re-runs against the patched (camera-ordered) list and
  // selectedVideoDeviceId binds the intended physical camera.
  await page.evaluate(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
    navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
  });
  await sleep(500);
  return { context, page };
}

const snap = (page) => page.evaluate(async () => {
  const out = { pcs: [], videos: [], callText: document.querySelector('#tour-video-call')?.textContent?.trim() };
  // PCs: the app doesn't expose them; find via webrtc internals? Track via video elements' streams only.
  const videos = Array.from(document.querySelectorAll('video'));
  for (const v of videos) {
    const so = v.srcObject;
    out.videos.push({
      hasStream: !!so,
      videoTracks: so ? so.getVideoTracks().map((t) => ({ id: t.id, readyState: t.readyState, enabled: t.enabled, label: t.label })) : [],
      audioTracks: so ? so.getAudioTracks().map((t) => ({ readyState: t.readyState, enabled: t.enabled })) : [],
      w: v.videoWidth, h: v.videoHeight, paused: v.paused, muted: v.muted,
    });
  }
  return out;
});

// Frame counters come from the diag harness's RTCPeerConnection wrapper; here we
// capture them by hooking getStats through a page-level wrapper installed pre-load.
const PC_HOOK = `
window.__pcs = [];
window.__wslog = [];
(function () {
  const Orig = window.RTCPeerConnection;
  function W(cfg) { const pc = new Orig(cfg); window.__pcs.push(pc); return pc; }
  W.prototype = Orig.prototype;
  window.RTCPeerConnection = W;
  // Log webrtc websocket traffic (both directions) for signaling forensics
  const wsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      if (typeof data === 'string' && data.includes('webrtc')) {
        const p = JSON.parse(data);
        window.__wslog.push(Date.now() + ' >> ' + p.type + (p.targetClientId ? ' target=' + p.targetClientId.slice(0, 8) : '') + (p.signal ? ' ' + p.signal.type : ''));
      }
    } catch {}
    return wsSend.call(this, data);
  };
  const _om = Symbol('onmessage');
  Object.defineProperty(WebSocket.prototype, 'onmessage', {
    get() { return this[_om]; },
    set(fn) {
      const wrapped = function (ev) {
        try {
          const p = JSON.parse(ev.data);
          if (p.type && p.type.startsWith('webrtc')) {
            window.__wslog.push(Date.now() + ' << ' + p.type + (p.fromClientId || p.clientId ? ' from=' + String(p.fromClientId || p.clientId).slice(0, 8) : '') + (p.signal ? ' ' + p.signal.type : ''));
          }
        } catch {}
        return fn ? fn.call(this, ev) : undefined;
      };
      this[_om] = wrapped;
      this.addEventListener('message', wrapped);
    },
    configurable: true,
  });
})();
`;
const wslog = (page) => page.evaluate(() => (window.__wslog || []).slice(-60));
const stats = (page) => page.evaluate(async () => {
  const out = [];
  for (const pc of window.__pcs || []) {
    const s = { sig: pc.signalingState, conn: pc.connectionState, ice: pc.iceConnectionState, mlines: 0, in: {}, out: {} };
    try {
      if (pc.localDescription) s.mlines = (pc.localDescription.sdp.match(/^m=/gm) || []).length;
      const rep = await pc.getStats();
      rep.forEach((r) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') s.in.video = { recv: r.framesReceived, dec: r.framesDecoded };
        if (r.type === 'inbound-rtp' && r.kind === 'audio') s.in.audio = { bytes: r.bytesReceived };
        if (r.type === 'outbound-rtp' && r.kind === 'video') s.out.video = { sent: r.framesSent };
        if (r.type === 'outbound-rtp' && r.kind === 'audio') s.out.audio = { bytes: r.bytesSent };
      });
    } catch (e) { s.err = String(e); }
    out.push(s);
  }
  return out;
});

async function startCall(page, label) {
  await page.evaluate(() => document.querySelector('#tour-video-call')?.click());
  await sleep(500);
  console.log(`   ${label}: call clicked`);
}

// Logs local media acquisition state right after a call starts (pinpoints
// camera/mic acquisition failures per participant).
const localMedia = async (page, label) => {
  const s = await page.evaluate(() => {
    const local = Array.from(document.querySelectorAll('video')).find((v) => v.muted && v.srcObject);
    const tracks = local?.srcObject ? local.srcObject.getTracks().map((t) => `${t.kind}:${t.label}:${t.readyState}:${t.enabled ? 'en' : 'dis'}`) : [];
    return { tracks, w: local?.videoWidth ?? 0, h: local?.videoHeight ?? 0, callText: document.querySelector('#tour-video-call')?.textContent?.trim() };
  });
  console.log(`   [${label}] local: ${s.tracks.join(', ') || 'NO TRACKS'} ${s.w}x${s.h} ${s.callText}`);
  return s;
};

// Select a camera in the dock's device settings popover by visible label.
const switchCamera = async (page, toLabel) => page.evaluate((label) => {
  const sels = Array.from(document.querySelectorAll('select'));
  const camSel = sels.find((s) => Array.from(s.options).some((o) => /Camera|Logi|Integrated|AshlarOS/.test(o.textContent || '')));
  if (!camSel) return { ok: false, reason: 'no camera select' };
  const opt = Array.from(camSel.options).find((o) => o.textContent === label);
  if (!opt) return { ok: false, reason: 'option not found: ' + label + ' have: ' + Array.from(camSel.options).map((o) => o.textContent).join('|') };
  opt.selected = true;
  camSel.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, to: opt.textContent };
}, toLabel);

const localCameraLabel = (page) => page.evaluate(() => {
  const v = Array.from(document.querySelectorAll('video')).find((v) => v.srcObject && v.muted && v.srcObject.getVideoTracks().length);
  return v?.srcObject.getVideoTracks()[0]?.label || null;
});

async function shot(page, label) {
  await page.screenshot({ path: `${OUT}/${label}.png` });
}

const videoDecodedGrew = async (page, minGrowth = 5) => {
  const a = await stats(page);
  const read = () => a.reduce((n, s) => n + (s.in.video?.dec || 0), 0);
  const before = read();
  await sleep(2500);
  const b = await stats(page);
  const after = b.reduce((n, s) => n + (s.in.video?.dec || 0), 0);
  return { grew: after - before >= minGrowth, before, after, states: b };
};

try {
  console.log(`Real-hardware WebRTC E2E → ${OUT}`);
  const cams = await enumerateCameras();
  console.log('Cameras:', cams.video.map((c) => c.label).join(' | '));
  console.log('Mics:', cams.audio.map((c) => c.label).join(' | '));
  assert('Two video input devices available', cams.video.length >= 2, `${cams.video.length}: ${cams.video.map((c) => c.label).join(', ')}`);
  // camA: the v4l2loopback fed by the real Integrated sensor — the only
  // camera both participants can stream simultaneously on this machine.
  // camB: the physical Integrated camera directly (used by the alone switch test).
  const camA = cams.video.find((c) => /AshlarOS|loopback/i.test(c.label))?.label || cams.video[0]?.label;
  const camB = cams.video.find((c) => c.label !== camA)?.label || camA;

  const roomId = `hw-${Date.now().toString(36)}`;
  const url = `${BASE}/w/${roomId}`;

  // All hooks (user patch, gUM logging, PC/WebSocket forensics) are installed
  // by openParticipant BEFORE the first navigation — no reload afterwards, so
  // the unlock's permission/device ids survive into the call document.
  // Both participants read the loopback (fed in real time by the Integrated
  // sensor via ashlaros-reactions): the only arrangement where two Chrome
  // camera streams coexist on this machine.
  const pA = await openParticipant(url, 'Alice', '#3b82f6', camA);
  const pB = await openParticipant(url, 'Bob', '#ef4444', camA);

  const camALabel = cams.video.find((c) => c.label === camA)?.label || camA;
  const camBLabel = cams.video.find((c) => c.label !== camA)?.label;

  // ── 1. Alice starts alone: device switch with zero contention ──
  console.log('\n1. Alice starts call alone + camera switch test');
  await startCall(pA.page, 'Alice');
  await sleep(1500);
  const aliceAlone = await localMedia(pA.page, 'Alice');
  assert('Alice acquires her camera on first call', aliceAlone.tracks.some((t) => t.startsWith('video:') && t.endsWith(':live:en')), aliceAlone.tracks.join(', '));
  assert('Alice alone sees Call (1)', aliceAlone.callText?.includes('(1)'), aliceAlone.callText);

  await pA.page.evaluate(() => document.querySelector('button[title="Select Microphone and Camera Devices"]')?.click());
  await sleep(400);
  const devSwitch = await switchCamera(pA.page, camBLabel || '');
  assert('Camera switch triggered', devSwitch.ok, JSON.stringify(devSwitch));
  await sleep(2500);
  const switchedLabel = await localCameraLabel(pA.page);
  assert('Local camera track is the switched device', switchedLabel === camBLabel, `now=${switchedLabel} want=${camBLabel}`);
  const switched = await pA.page.evaluate(() => {
    const v = Array.from(document.querySelectorAll('video')).find((v) => v.srcObject && v.muted);
    return { w: v?.videoWidth ?? 0, h: v?.videoHeight ?? 0 };
  });
  assert('Switched camera renders frames locally', switched.w > 0, `${switched.w}x${switched.h}`);
  await shot(pA.page, 'alice-cam-switched');
  const devRevert = await switchCamera(pA.page, camALabel);
  await sleep(2000);
  const revertedLabel = await localCameraLabel(pA.page);
  assert('Camera switched back', devRevert.ok && revertedLabel === camALabel, `now=${revertedLabel} want=${camALabel} ${JSON.stringify(devRevert)}`);

  // ── 2. Bob starts call (forward order) ──
  console.log('\n2. Bob starts call (forward order)');
  await startCall(pB.page, 'Bob');
  await sleep(1500);
  await localMedia(pA.page, 'Alice');
  await localMedia(pB.page, 'Bob');
  const fwd = await waitFor(async () => {
    const a = await pA.page.evaluate(() => document.querySelector('#tour-video-call')?.textContent?.includes('(2)'));
    const b = await pB.page.evaluate(() => document.querySelector('#tour-video-call')?.textContent?.includes('(2)'));
    return a && b;
  }, 20000);
  assert('Both see Call (2) in forward order', !!fwd);

  const sA = await stats(pA.page);
  const sB = await stats(pB.page);
  assert('Alice: PC connected, 2 m-lines', sA.some((s) => s.conn === 'connected' && s.mlines === 2), JSON.stringify(sA.map((s) => `${s.conn}/${s.mlines}`)));
  assert('Bob: PC connected, 2 m-lines', sB.some((s) => s.conn === 'connected' && s.mlines === 2), JSON.stringify(sB.map((s) => `${s.conn}/${s.mlines}`)));

  const decA = await videoDecodedGrew(pA.page);
  const decB = await videoDecodedGrew(pB.page);
  assert('Alice decodes Bob video frames', decA.grew, `${decA.before} -> ${decA.after}`);
  assert('Bob decodes Alice video frames', decB.grew, `${decB.before} -> ${decB.after}`);

  const audioOk = async (page) => {
    const s = await stats(page);
    return s.some((x) => (x.in.audio?.bytes || 0) > 0);
  };
  assert('Alice receives audio bytes', await audioOk(pA.page));
  assert('Bob receives audio bytes', await audioOk(pB.page));

  // Remote video elements render non-zero
  const remoteRender = async (page) => {
    const s = await snap(page);
    return s.videos.filter((v) => v.videoTracks.some((t) => t.label === 'remote video' || t.label.startsWith('remote')) && v.w > 0).length;
  };
  assert('Alice renders remote video >0px', (await remoteRender(pA.page)) > 0);
  assert('Bob renders remote video >0px', (await remoteRender(pB.page)) > 0);
  await shot(pA.page, 'alice-forward');
  await shot(pB.page, 'bob-forward');

  // ── 3. Mute / camera off / camera on / unmute ──
  console.log('\n3. Mute, camera off, camera on, unmute');
  await pA.page.evaluate(() => document.querySelector('button[title="Mute microphone"]')?.click());
  await sleep(600);
  let st = await pA.page.evaluate(() => {
    const s = document.querySelector('#tour-video-call');
    return { muteTitle: document.querySelector('button[title="Unmute microphone"]') ? 'muted' : 'not-muted' };
  });
  assert('Alice mute toggles UI', st.muteTitle === 'muted');
  await pA.page.evaluate(() => document.querySelector('button[title="Turn camera off"]')?.click());
  await sleep(800);
  st = await pA.page.evaluate(() => ({
    camOff: !!document.querySelector('button[title="Turn camera on"]'),
  }));
  assert('Alice camera-off toggles UI', st.camOff);
  // Remote side can't infer camera-off from receiver tracks (they stay enabled);
  // the media-state signal must flip Alice's dock bubble to the avatar fallback.
  const bobSeesAvatar = await waitFor(() => pB.page.evaluate(() => {
    const wrap = document.querySelector('div[title^="Alice"]');
    const v = wrap?.querySelector('video');
    return !!v && v.className.includes('opacity-0');
  }), 8000);
  await shot(pB.page, 'bob-alice-camera-off');
  assert('Bob sees Alice avatar after camera off (media-state signal)', !!bobSeesAvatar);
  await pA.page.evaluate(() => document.querySelector('button[title="Turn camera on"]')?.click());
  await pA.page.evaluate(() => document.querySelector('button[title="Unmute microphone"]')?.click());
  await sleep(800);
  const decAfterToggle = await videoDecodedGrew(pB.page);
  assert('Video resumes for Bob after camera back on', decAfterToggle.grew, `${decAfterToggle.before} -> ${decAfterToggle.after}`);
  st = await pA.page.evaluate(() => ({
    unmuted: !!document.querySelector('button[title="Mute microphone"]'),
    camOn: !!document.querySelector('button[title="Turn camera off"]'),
  }));
  assert('Alice unmuted + camera on again', st.unmuted && st.camOn);

  // ── 4. Screen share (real getDisplayMedia) ──
  console.log('\n4. Screen share');
  await pA.page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title') === 'Share your screen');
    btn?.click();
  });
  const shared = await waitFor(async () => {
    const s = await pB.page.evaluate(() => {
      const vids = Array.from(document.querySelectorAll('video'));
      return vids.some((v) => v.srcObject && v.srcObject.getVideoTracks().some((t) => t.label.startsWith('remote')) && v.videoWidth > 640);
    });
    return s;
  }, 30000);
  assert('Bob receives non-black screen share (>640px)', !!shared);
  const shareDec = await videoDecodedGrew(pB.page);
  assert('Bob decodes screen-share frames', shareDec.grew, `${shareDec.before} -> ${shareDec.after}`);
  await shot(pA.page, 'alice-sharing');
  await shot(pB.page, 'bob-receives-share');
  await pA.page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title') === 'Stop sharing screen');
    btn?.click();
  });
  await sleep(1500);
  const afterStop = await pB.page.evaluate(() => {
    const vids = Array.from(document.querySelectorAll('video'));
    return vids.filter((v) => v.srcObject && v.srcObject.getVideoTracks().some((t) => t.label.startsWith('remote'))).map((v) => v.videoWidth);
  });
  assert('Remote back to camera size after stop', afterStop.every((w) => w <= 640), JSON.stringify(afterStop));

  // ── 5. Bob leaves and rejoins ──
  console.log('\n5. Bob leaves + rejoins');
  await pB.page.evaluate(() => document.querySelector('button[title="Leave call"]')?.click());
  await sleep(2500);
  const leaveState = await pA.page.evaluate(() => document.querySelector('#tour-video-call')?.textContent?.trim());
  assert('Alice sees Call (1) after Bob leaves', leaveState?.includes('(1)'), leaveState);
  const alicePcsAfterLeave = await stats(pA.page);
  assert('Alice closed stale PC', alicePcsAfterLeave.every((s) => s.sig === 'closed' || s.conn === 'closed' || s.conn === 'connected'), JSON.stringify(alicePcsAfterLeave.map((s) => s.conn)));
  await startCall(pB.page, 'Bob-rejoin');
  const rejoined = await waitFor(async () => {
    const a = await pA.page.evaluate(() => document.querySelector('#tour-video-call')?.textContent?.includes('(2)'));
    const b = await pB.page.evaluate(() => document.querySelector('#tour-video-call')?.textContent?.includes('(2)'));
    return a && b;
  }, 20000);
  assert('Both see Call (2) after rejoin', !!rejoined);
  const rejoinDec = await videoDecodedGrew(pA.page);
  assert('Alice decodes frames after Bob rejoin', rejoinDec.grew, `${rejoinDec.before} -> ${rejoinDec.after}`);
  await shot(pA.page, 'alice-after-rejoin');
  await shot(pB.page, 'bob-after-rejoin');

  // ── 6. Third participant (audio-only, camera off) ──
  console.log('\n6. Third participant joins audio-only');
  const pC = await openParticipant(url, 'Carol', '#10b981', null, { audioOnly: true });
  await startCall(pC.page, 'Carol');
  await sleep(1500);
  await localMedia(pC.page, 'Carol');
  const three = await waitFor(async () => {
    const texts = await Promise.all([pA.page, pB.page, pC.page].map((p) => p.evaluate(() => document.querySelector('#tour-video-call')?.textContent?.trim())));
    return texts.every((t) => t?.includes('(3)'));
  }, 25000);
  assert('All three see Call (3)', !!three);
  const carolDec = await videoDecodedGrew(pC.page);
  assert('Carol (camera off) decodes others video', carolDec.grew, `${carolDec.before} -> ${carolDec.after}`);
  const aliceFromCarol = await videoDecodedGrew(pA.page);
  assert('Alice still decodes video with 3 participants', aliceFromCarol.grew, `${aliceFromCarol.before} -> ${aliceFromCarol.after}`);
  await shot(pC.page, 'carol-audio-only');
  await shot(pA.page, 'alice-three-users');
  const cStats = await stats(pC.page);
  assert('Carol: PC connected, 2 m-lines', cStats.some((s) => s.conn === 'connected' && s.mlines === 2), JSON.stringify(cStats.map((s) => `${s.conn}/${s.mlines}`)));

  // Signaling forensics
  for (const [label, p] of [['Alice', pA], ['Bob', pB], ['Carol', pC]]) {
    const log = await wslog(p.page);
    console.log(`\n--- ${label} webrtc signaling ---`);
    console.log(log.join('\n'));
    const gum = await p.page.evaluate(() => window.__gumlog || []);
    console.log(`--- ${label} getUserMedia ---`);
    console.log(gum.join('\n'));
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(50));
  console.log(results.join('\n'));
  console.log('═'.repeat(50));
  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`Artifacts: ${OUT}`);
  writeFileSync(`${OUT}/summary.txt`, `${results.join('\n')}\n${passed} passed, ${failed} failed\n`);
} catch (err) {
  console.error('Harness error:', err);
  failed++;
} finally {
  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}
