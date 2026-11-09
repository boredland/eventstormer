/**
 * WebRTC Diagnostic Harness (real evidence capture)
 *
 * Captures per page:
 *  - console errors/warnings (exact text)
 *  - every RTCPeerConnection: signalingState, connectionState, iceConnectionState,
 *    transceiver layout (kind/direction/sender/receiver)
 *  - SDP offer/answer m-line count + ordering
 *  - every <video>: srcObject, track states, DOM muted, paused, videoWidth/Height
 *  - getStats() framesReceived/framesDecoded/framesSent
 *
 * Exposes PCs via injection: hooks into RTCPeerConnection constructor.
 *
 * Usage: node scripts/diag-webrtc.mjs <baseUrl> <scenario>
 *   scenario: forward | reverse | screenshare | leave-rejoin | devices
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5173';
const SCENARIO = process.argv[3] || 'forward';
const OUT = `diag-out/${SCENARIO}-${Date.now().toString(36)}`;
mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 15000, intervalMs = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fn(); if (r) return r; } catch {}
    await sleep(intervalMs);
  }
  return null;
}

let browser = null;
function cleanup() {
  try { browser?.process() && process.kill(-browser.process().pid, 'SIGKILL'); } catch {}
}
process.once('exit', cleanup);
process.once('SIGINT', () => { cleanup(); process.exit(130); });

// Injected before any page script: capture PCs + console
const INJECT = `
window.__pcs = new Map();
window.__pcSeq = 0;
window.__logs = [];
(function () {
  const orig = window.RTCPeerConnection;
  const mline = (sdp) => sdp ? (sdp.match(/^m=/gm) || []).length + ':' + sdp.split('\\r\\n').filter((l) => l.startsWith('m=')).map((l) => l.split(' ')[0].slice(2) + (l.includes(' 9 ') ? '' : ' ACTIVE')).join(',') : 'null';
  function Wrapped(cfg) {
    const pc = new orig(cfg);
    const id = 'pc' + (++window.__pcSeq);
    window.__pcs.set(id, pc);
    const log = (evt, extra) => window.__logs.push({ t: Date.now(), pc: id, evt, ...(extra || {}) });
    log('created');
    pc.addEventListener('signalingstatechange', () => log('signaling', { state: pc.signalingState }));
    pc.addEventListener('connectionstatechange', () => log('connection', { state: pc.connectionState }));
    pc.addEventListener('iceconnectionstatechange', () => log('ice', { state: pc.iceConnectionState }));
    pc.addEventListener('icecandidateerror', (e) => log('icecandidateerror', { url: e.url, errorCode: e.errorCode, errorText: e.errorText }));
    pc.addEventListener('negotiationneeded', () => log('negotiationneeded'));
    let candCount = 0;
    pc.addEventListener('icecandidate', (e) => {
      if (e.candidate) candCount++;
      else log('icegathering-complete', { total: candCount });
    });
    const co = pc.createOffer.bind(pc);
    pc.createOffer = async (o) => { const offer = await co(o); log('createOffer', { m: mline(offer.sdp), dir: offer.sdp.split('\\r\\n').filter((l) => l.startsWith('a=send') || l.startsWith('a=recv')).join(',') }); return offer; };
    const ca = pc.createAnswer.bind(pc);
    pc.createAnswer = async () => { const a = await ca(); log('createAnswer', { m: mline(a.sdp), dir: a.sdp.split('\\r\\n').filter((l) => l.startsWith('a=send') || l.startsWith('a=recv')).join(',') }); return a; };
    const sld = pc.setLocalDescription.bind(pc);
    pc.setLocalDescription = async (d) => { log('setLocal', { type: d && d.type, m: d && d.sdp ? mline(d.sdp) : '-' }); return sld(d); };
    const srd = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = async (d) => { log('setRemote', { type: d && d.type, m: d && d.sdp ? mline(d.sdp) : '-' }); return srd(d); };
  const at = pc.addTransceiver.bind(pc);
  pc.addTransceiver = (...args) => {
      log('addTransceiver', { kind: typeof args[0] === 'string' ? args[0] : args[0]?.kind, stack: (new Error().stack || '').split(String.fromCharCode(10)).slice(2, 8).join(' <- ') });
      const t = at(...args);
      log('tstate', { when: 'after-addTransceiver', s: pc.getTransceivers().map((x, i) => i + '[' + (x.mid ?? '-') + ' ' + x.direction + ' ' + (x.sender.track ? 'T' : '-') + ']').join(' ') });
      return t;
    };
    const tstate = () => pc.getTransceivers().map((t, i) => i + '[' + (t.mid ?? '-') + ' ' + t.direction + ' ' + (t.sender.track ? 'T:' + t.sender.track.id.slice(-4) : '-') + ']').join(' ');
  // Track direction changes and replaceTrack calls (prototype-level, installed once)
  if (!RTCRtpTransceiver.prototype.__dirWrapped) {
    const d = Object.getOwnPropertyDescriptor(RTCRtpTransceiver.prototype, 'direction');
    if (d && d.set && d.get) {
      const origSet = d.set, origGet = d.get;
      Object.defineProperty(RTCRtpTransceiver.prototype, 'direction', {
        configurable: true,
        get() { return origGet.call(this); },
        set(v) {
          const old = origGet.call(this);
          if (old !== v) {
            window.__logs.push({ t: Date.now(), evt: 'direction-set', from: old, to: v, kind: this.receiver.track.kind, stack: (new Error().stack || '').split(String.fromCharCode(10)).slice(3, 7).join(' <- ') });
          }
          return origSet.call(this, v);
        },
      });
    }
    RTCRtpTransceiver.prototype.__dirWrapped = true;
  }
  if (!RTCRtpSender.prototype.__rtWrapped) {
    const rd = Object.getOwnPropertyDescriptor(RTCRtpSender.prototype, 'replaceTrack');
    if (rd && rd.value) {
      const orig = rd.value;
      const wrapped = function (track) {
        window.__logs.push({ t: Date.now(), evt: 'replaceTrack', track: track ? track.kind + ':' + track.id.slice(-4) : 'null', stack: (new Error().stack || '').split(String.fromCharCode(10)).slice(3, 7).join(' <- ') });
        return orig.call(this, track);
      };
      Object.defineProperty(RTCRtpSender.prototype, 'replaceTrack', { configurable: true, writable: true, value: wrapped });
    }
    RTCRtpSender.prototype.__rtWrapped = true;
  }
    const origCO2 = pc.createOffer.bind(pc);
    pc.createOffer = async (o) => { const r = await origCO2(o); log('tstate', { when: 'after-createOffer', s: tstate() }); return r; };
    const origCA2 = pc.createAnswer.bind(pc);
    pc.createAnswer = async () => { const r = await origCA2(); log('tstate', { when: 'after-createAnswer', s: tstate() }); return r; };
    const origSRD2 = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = async (d) => { const r = await origSRD2(d); log('tstate', { when: 'after-setRemote', s: tstate() }); return r; };
    const origSLD2 = pc.setLocalDescription.bind(pc);
    pc.setLocalDescription = async (d) => { const r = await origSLD2(d); log('tstate', { when: 'after-setLocal', s: tstate() }); return r; };
    return pc;
  }
  Wrapped.prototype = orig.prototype;
  Object.defineProperty(Wrapped, 'name', { value: 'RTCPeerConnection' });
  window.RTCPeerConnection = Wrapped;
  // Log all websocket sends of webrtc messages
  const wsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      if (typeof data === 'string' && data.includes('webrtc')) {
        const p = JSON.parse(data);
        const s = p.signal ? p.signal.type + (p.signal.data && p.signal.data.sdp ? ' m=' + mline(p.signal.data.sdp) : '') : '';
        window.__logs.push({ t: Date.now(), evt: 'ws.send', text: p.type + ' target=' + (p.targetClientId || '').slice(0, 8) + ' ' + s });
      }
    } catch {}
    return wsSend.call(this, data);
  };
  const wsAdd = WebSocket.prototype.addEventListener;
  WebSocket.prototype.addEventListener = function (type, fn, opts) {
    if (type === 'message') {
      const wrapped = (ev) => {
        try {
          const p = JSON.parse(ev.data);
          if (p.type && p.type.startsWith('webrtc')) {
            const s = p.signal ? p.signal.type + (p.signal.data && p.signal.data.sdp ? ' m=' + mline(p.signal.data.sdp) : '') : '';
            window.__logs.push({ t: Date.now(), evt: 'ws.recv', text: p.type + ' from=' + (p.fromClientId || p.clientId || '').toString().slice(0, 8) + ' ' + s });
          }
        } catch {}
        return fn(ev);
      };
      return wsAdd.call(this, type, wrapped, opts);
    }
    return wsAdd.call(this, type, fn, opts);
  };
  // App assigns ws.onmessage property — intercept via setter
  const _om = Symbol('onmessage');
  Object.defineProperty(WebSocket.prototype, 'onmessage', {
    get() { return this[_om]; },
    set(fn) {
      const wrapped = (function (handler) {
        return function (ev) {
          try {
            const p = JSON.parse(ev.data);
            if (p.type && p.type.startsWith('webrtc')) {
              const s = p.signal ? p.signal.type + (p.signal.data && p.signal.data.sdp ? ' m=' + mline(p.signal.data.sdp) : '') : '';
              window.__logs.push({ t: Date.now(), evt: 'ws.recv', text: p.type + ' from=' + (p.fromClientId || p.clientId || '').toString().slice(0, 8) + ' ' + s });
            }
          } catch {}
          return handler ? handler.call(this, ev) : undefined;
        };
      })(fn);
      this[_om] = wrapped;
      wsAdd.call(this, 'message', wrapped);
    },
    configurable: true,
  });
  // Capture console.error/warn to see exact browser errors
  for (const level of ['error', 'warn']) {
    const origLog = console[level].bind(console);
    console[level] = (...args) => {
      window.__logs.push({ t: Date.now(), evt: 'console.' + level, text: args.map(String).join(' ') });
      origLog(...args);
    };
  }
  window.addEventListener('unhandledrejection', (e) => {
    window.__logs.push({ t: Date.now(), evt: 'unhandledrejection', text: String(e.reason && e.reason.stack || e.reason) });
  });
})();
`;

async function launch() {
  return puppeteer.launch({
    headless: 'new',
    executablePath: CHROME,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

async function openWorkspace(browser, url, name, color) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((n, c, inject) => {
    localStorage.setItem('eventstormer_user', JSON.stringify({ name: n, color: c }));
    eval(inject);
  }, name, color, INJECT);
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`   [console.${msg.type()}][${name}]`, msg.text().slice(0, 300));
    }
  });
  page.on('pageerror', (err) => console.log(`   [pageerror][${name}]`, String(err).slice(0, 300)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#tour-video-call', { timeout: 15000 });
  return page;
}

async function snapshot(page, label) {
  const data = await page.evaluate(async () => {
    const out = { videos: [], pcs: [], logs: window.__logs };
    document.querySelectorAll('video').forEach((v, i) => {
      const so = v.srcObject;
      out.videos.push({
        i,
        srcObjectId: so ? so.id : null,
        srcObjectActive: so ? so.active : null,
        videoTracks: so ? so.getVideoTracks().map((t) => ({
          id: t.id, kind: t.kind, readyState: t.readyState, enabled: t.enabled, muted: t.muted, label: t.label,
        })) : [],
        audioTracks: so ? so.getAudioTracks().map((t) => ({
          id: t.id, readyState: t.readyState, enabled: t.enabled, label: t.label,
        })) : [],
        domMuted: v.muted, paused: v.paused, videoWidth: v.videoWidth, videoHeight: v.videoHeight,
        readyState: v.readyState,
      });
    });
    for (const [id, pc] of window.__pcs) {
      const stats = {};
      try {
        const report = await pc.getStats();
        report.forEach((r) => {
          if (r.type === 'inbound-rtp' && (r.kind === 'video' || r.kind === 'audio')) {
            stats[`in-${r.kind}-${r.id.slice(-4)}`] = {
              framesReceived: r.framesReceived, framesDecoded: r.framesDecoded,
              bytesReceived: r.bytesReceived, packetsLost: r.packetsLost,
              trackIdentifier: r.trackIdentifier,
            };
          }
          if (r.type === 'outbound-rtp' && (r.kind === 'video' || r.kind === 'audio')) {
            stats[`out-${r.kind}-${r.id.slice(-4)}`] = {
              framesSent: r.framesSent, bytesSent: r.bytesSent,
            };
          }
        });
      } catch (e) { stats.error = String(e); }
      let localMlines = 0, remoteMlines = 0, mlineKinds = [];
      try {
        if (pc.localDescription) {
          localMlines = (pc.localDescription.sdp.match(/^m=/gm) || []).length;
          mlineKinds = pc.localDescription.sdp.split('\r\n').filter((l) => l.startsWith('m=')).map((l) => l.split(' ')[0] + '/' + l.split(' ')[1]);
        }
        if (pc.remoteDescription) remoteMlines = (pc.remoteDescription.sdp.match(/^m=/gm) || []).length;
      } catch {}
      out.pcs.push({
        id,
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        localMlines, remoteMlines, mlineKinds,
        localSdp: pc.localDescription ? pc.localDescription.sdp.split('\r\n').filter((l) => l.startsWith('m=') || l.startsWith('a=mid') || l.startsWith('a=send') || l.startsWith('a=recv') || l.startsWith('a=inactive') || l.startsWith('a=msid')) : null,
        remoteSdp: pc.remoteDescription ? pc.remoteDescription.sdp.split('\r\n').filter((l) => l.startsWith('m=') || l.startsWith('a=mid') || l.startsWith('a=send') || l.startsWith('a=recv') || l.startsWith('a=inactive') || l.startsWith('a=msid')) : null,
        transceivers: pc.getTransceivers().map((t) => ({
          kind: t.receiver.track.kind,
          direction: t.direction,
          senderTrack: t.sender.track ? `${t.sender.track.kind}:${t.sender.track.readyState}:${t.sender.track.id.slice(-4)}` : null,
          receiverTrack: `${t.receiver.track.readyState}:${t.receiver.track.id.slice(-4)}`,
          currentDirection: t.currentDirection,
        })),
        stats,
      });
    }
    const btn = document.querySelector('#tour-video-call');
    out.callText = btn?.textContent?.trim();
    return out;
  });
  writeFileSync(`${OUT}/${label}.json`, JSON.stringify(data, null, 2));
  // Compact console print
  for (const l of data.logs) {
    if (l.evt === 'ws.send' || l.evt === 'ws.recv') {
      console.log(`   [${label}][${l.evt === 'ws.send' ? '>>' : '<<'}]`, (l.text || '').slice(0, 200));
    } else if (['createOffer', 'createAnswer', 'setLocal', 'setRemote', 'negotiationneeded', 'icecandidateerror', 'unhandledrejection', 'addTransceiver', 'tstate', 'direction-set', 'replaceTrack'].includes(l.evt) || l.evt.startsWith('console.')) {
      console.log(`   [${label}]`, l.pc || '', l.evt, (l.text || l.state || l.s || `${l.type || ''} m=${l.m || ''} ${l.dir || ''} ${l.kind || ''} ${l.from || ''}->${l.to || ''} ${l.track || ''} ${l.stack || ''}` || '').slice(0, 400));
    }
  }
  return data;
}

async function startCall(page, label) {
  await page.evaluate(() => document.querySelector('#tour-video-call')?.click());
  await sleep(2500);
  console.log(`   ${label}: call clicked`);
}

async function shot(page, label) {
  await page.screenshot({ path: `${OUT}/${label}.png` });
}

const roomId = `diag-${SCENARIO}-${Date.now().toString(36)}`;
const url = `${BASE}/w/${roomId}`;

try {
  browser = await launch();
  console.log(`Diagnostic scenario: ${SCENARIO} room=${roomId} -> ${OUT}`);

  const page1 = await openWorkspace(browser, url, 'Alice', '#3b82f6');
  const page2 = await openWorkspace(browser, url, 'Bob', '#ef4444');

  if (SCENARIO === 'reverse') {
    await startCall(page2, 'Bob');
    await sleep(3000);
    await snapshot(page1, 'reverse-p1-bob-called').then((s) => printPCs('p1', s));
    await snapshot(page2, 'reverse-p2-bob-called').then((s) => printPCs('p2', s));
    await startCall(page1, 'Alice');
  } else {
    await startCall(page1, 'Alice');
    await sleep(3000);
    await startCall(page2, 'Bob');
  }

  await waitFor(async () => {
    const s1 = await snapshot(page1, 'tmp');
    const s2 = await snapshot(page2, 'tmp');
    return s1.callText?.includes('(2)') && s2.callText?.includes('(2)');
  }, 20000);

  const s1 = await snapshot(page1, 'connected-p1');
  const s2 = await snapshot(page2, 'connected-p2');
  printPCs('p1', s1); printPCs('p2', s2);
  printVideos('p1', s1); printVideos('p2', s2);

  await sleep(4000); // let frames flow
  const f1 = await snapshot(page1, 'frames-p1');
  const f2 = await snapshot(page2, 'frames-p2');
  printFrames('p1', f1); printFrames('p2', f2);
  await shot(page1, 'p1-connected'); await shot(page2, 'p2-connected');

  if (SCENARIO === 'screenshare') {
    console.log('\n--- Alice starts screen share ---');
    await page1.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title')?.includes('Share your screen'));
      if (btn) btn.click(); else console.error('screen share button not found');
    });
    await sleep(1500);
    const a1 = await snapshot(page1, 'share-p1-started');
    printPCs('p1', a1);
    await waitFor(async () => {
      const s = await page2.evaluate(() => {
        return Array.from(document.querySelectorAll('video')).some((v) =>
          v.srcObject && v.srcObject.getVideoTracks().some((t) => v.videoWidth > 640));
      });
      return s;
    }, 12000).then((r) => console.log('   Bob received >640px video:', !!r));
    const b2 = await snapshot(page2, 'share-p2-received');
    printPCs('p2', b2); printVideos('p2', b2); printFrames('p2', b2);
    const a2 = await snapshot(page1, 'share-p1-after');
    printFrames('p1', a2);
    await shot(page1, 'p1-sharing'); await shot(page2, 'p2-receiving-share');
    // stop share
    console.log('--- Alice stops screen share ---');
    await page1.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title')?.includes('Stop sharing'));
      if (btn) btn.click(); else console.error('stop share button not found');
    });
    await sleep(3000);
    const a3 = await snapshot(page1, 'share-stopped-p1');
    const b3 = await snapshot(page2, 'share-stopped-p2');
    printPCs('p1', a3); printPCs('p2', b3);
    printVideos('p2', b3); printFrames('p2', b3);
  }

  if (SCENARIO === 'leave-rejoin') {
    console.log('\n--- Bob leaves, rejoins ---');
    await page2.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title')?.includes('Leave call'));
      if (btn) btn.click(); else console.error('leave button not found');
    });
    await sleep(2500);
    const l1 = await snapshot(page1, 'leave-p1');
    printPCs('p1', l1); console.log('   p1 callText:', l1.callText);
    await startCall(page2, 'Bob-rejoin');
    await waitFor(async () => {
      const s = await page1.evaluate(() => document.querySelector('#tour-video-call')?.textContent?.includes('(2)'));
      return s;
    }, 20000);
    const r1 = await snapshot(page1, 'rejoin-p1');
    const r2 = await snapshot(page2, 'rejoin-p2');
    printPCs('p1', r1); printPCs('p2', r2); printFrames('p1', r1); printFrames('p2', r2);
    await sleep(3000);
    const r1b = await snapshot(page1, 'rejoin-frames-p1');
    printFrames('p1', r1b);
  }

  await page1.close().catch(() => {});
  await page2.close().catch(() => {});
  console.log(`\nSnapshots written to ${OUT}`);
  // Merged timeline (both pages share the browser clock)
  try {
    const merged = [];
    for (const [label, f] of [['p1', 'connected-p1.json'], ['p2', 'connected-p2.json']]) {
      const d = JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8'));
      for (const l of d.logs || []) merged.push({ ...l, page: label });
    }
    merged.sort((a, b) => a.t - b.t);
    const t0 = merged.length ? merged[0].t : 0;
    const lines = merged.map((l) => `${((l.t - t0) + 'ms').padStart(7)} [${l.page}] ${l.pc || ''} ${l.evt} ${l.text || l.state || l.s || (l.type ? l.type + ' m=' + (l.m || '') + ' ' + (l.dir || '') : '') || (l.from ? `${l.kind} ${l.from}->${l.to} ${l.stack || ''}` : '') || (l.track !== undefined ? `track=${l.track} ${l.stack || ''}` : '')}`.trimEnd());
    writeFileSync(`${OUT}/timeline.txt`, lines.join('\n'));
    console.log('--- merged timeline ---');
    console.log(lines.join('\n'));
  } catch {}
} catch (err) {
  console.error('Harness error:', err);
  process.exitCode = 1;
} finally {
  cleanup();
}

function printPCs(label, s) {
  for (const pc of s.pcs || []) {
    console.log(`   [${label}] ${pc.id} sig=${pc.signalingState} conn=${pc.connectionState} ice=${pc.iceConnectionState} mlines=${pc.localMlines}/${pc.remoteMlines}`);
    if (pc.localSdp) console.log(`      local:  ${pc.localSdp.join(' | ')}`);
    if (pc.remoteSdp) console.log(`      remote: ${pc.remoteSdp.join(' | ')}`);
    for (const t of pc.transceivers) {
      console.log(`      tx ${t.kind} dir=${t.direction} cur=${t.currentDirection} sender=${t.senderTrack} recv=${t.receiverTrack}`);
    }
  }
}
function printVideos(label, s) {
  for (const v of s.videos || []) {
    console.log(`   [${label}] video#${v.i} ${v.videoWidth}x${v.videoHeight} paused=${v.paused} muted=${v.domMuted} tracks=` +
      v.videoTracks.map((t) => `${t.kind}:${t.readyState}:${t.enabled ? 'en' : 'dis'}:${t.id.slice(-4)}`).join(',') +
      ` audio=` + v.audioTracks.map((t) => `${t.readyState}:${t.enabled ? 'en' : 'dis'}`).join(','));
  }
}
function printFrames(label, s) {
  for (const pc of s.pcs || []) {
    const parts = Object.entries(pc.stats || {}).map(([k, v]) => {
      if (v.framesReceived !== undefined) return `${k}:recv=${v.framesReceived}/dec=${v.framesDecoded}`;
      if (v.framesSent !== undefined) return `${k}:sent=${v.framesSent}`;
      return null;
    }).filter(Boolean);
    console.log(`   [${label}] ${pc.id} stats: ${parts.join(' ') || '(none)'}`);
  }
}
