/**
 * WebSocket reconnect recovery E2E
 *
 * Mid-call WebSocket drops are survivable only if the client re-announces call
 * presence after reconnecting: the server treats a reconnect as a fresh socket
 * (workspace join only) and broadcasts webrtc:peer-left for the old one, so
 * without a re-join the peer becomes invisible, remote connections die
 * one-sidedly, and Call (2)/Call (1) diverge permanently.
 *
 * Scenario: two peers connect a call, force-close one page's WebSocket, then
 * verify BOTH sides converge back to Call (2) with a connected peer connection
 * and fresh decoded frames.
 *
 * Usage: node scripts/e2e-reconnect.mjs [baseUrl]
 */

import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
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

let browser = null;
function cleanup() {
  try { browser?.process() && process.kill(-browser.process().pid, 'SIGKILL'); } catch { try { browser.process()?.kill('SIGKILL'); } catch {} }
}
process.once('exit', cleanup);
process.once('SIGINT', () => { cleanup(); process.exit(130); });
process.once('SIGTERM', () => { cleanup(); process.exit(143); });

const HOOK = `
window.__socks = [];
window.__pcs = [];
window.__wstraffic = [];
(function () {
  const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    if (window.__socks[window.__socks.length - 1] !== this) window.__socks.push(this);
    try { if (typeof data === 'string') window.__wstraffic.push('> ' + data.slice(0, 60)); } catch {}
    return send.call(this, data);
  };
  const OrigPC = window.RTCPeerConnection;
  function W(cfg) { const pc = new OrigPC(cfg); window.__pcs.push(pc); return pc; }
  W.prototype = OrigPC.prototype;
  window.RTCPeerConnection = W;
})();
`;

async function openPage(url, name, color) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((n, c, hook) => {
    localStorage.setItem('eventstormer_user', JSON.stringify({ name: n, color: c }));
    eval(hook);
  }, name, color, HOOK);
  page.on('console', (m) => console.log(`   [console.${m.type()}][${name}]`, m.text().slice(0, 200)));
  page.on('pageerror', (e) => console.log(`   [pageerror][${name}]`, String(e).slice(0, 200)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#tour-video-call', { timeout: 15000 });
  return page;
}

const callText = (page) => page.evaluate(() => document.querySelector('#tour-video-call')?.textContent?.trim());
const openSockets = (page) => page.evaluate(() => window.__socks.filter((s) => s.readyState === 1).length);

async function decodedFrames(page) {
  return page.evaluate(async () => {
    let n = 0;
    for (const pc of window.__pcs) {
      if (pc.connectionState === 'closed') continue;
      try {
        const rep = await pc.getStats();
        rep.forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'video') n += r.framesDecoded || 0; });
      } catch {}
    }
    return n;
  });
}

try {
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const roomId = `recon-${Date.now().toString(36)}`;
  const url = `${BASE}/w/${roomId}`;
  console.log(`WebSocket reconnect E2E → ${url}`);

  const p1 = await openPage(url, 'Alice', '#3b82f6');
  const p2 = await openPage(url, 'Bob', '#ef4444');

  await p1.evaluate(() => document.querySelector('#tour-video-call').click());
  await sleep(2500);
  await p2.evaluate(() => document.querySelector('#tour-video-call').click());
  const connected = await waitFor(async () => (await callText(p1))?.includes('(2)') && (await callText(p2))?.includes('(2)'), 20000);
  assert('Both peers in call before the drop', !!connected, `${await callText(p1)} / ${await callText(p2)}`);

  // ── Trigger a SERVER-side close: flood >30 messages in one second so the
  // workspace room closes this socket with 1008 (a real server-initiated drop;
  // client-initiated close() would wait for a Close reply that the connection
  // layers don't promptly provide, hanging in CLOSING without firing onclose)
  // ──
  console.log("Flooding Alice's socket to force a server-side close...");
  const flooded = await p1.evaluate(() => {
    const ws = window.__socks.filter((s) => s.readyState === 1).pop();
    if (!ws) return false;
    for (let i = 0; i < 45; i++) ws.send(JSON.stringify({ type: 'cursor', clientId: 'flood', x: i, y: i }));
    return true;
  });
  assert('Server-side close triggered (flood)', !!flooded);

  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    const state = await p1.evaluate(() => ({
      socks: window.__socks.map((s) => s.readyState),
      traffic: window.__wstraffic.length,
      tail: window.__wstraffic.slice(-3).map((t) => t.slice(0, 40)),
    }));
    console.log(`   [Alice t+${i + 1}s] socks=${JSON.stringify(state.socks)} traffic=${state.traffic} tail=${JSON.stringify(state.tail)}`);
  }

  const t1 = await callText(p1);
  const t2 = await callText(p2);
  const traffic1 = await p1.evaluate(() => window.__wstraffic.slice(-8));
  const traffic2 = await p2.evaluate(() => window.__wstraffic.slice(-8));
  console.log('   Alice traffic:', JSON.stringify(traffic1));
  console.log('   Bob traffic:', JSON.stringify(traffic2));
  assert('Alice reconnected (socket open)', (await openSockets(p1)) >= 1);
  assert('Both sides converge back to Call (2)', t1?.includes('(2)') && t2?.includes('(2)'), `Alice=${t1} Bob=${t2}`);

  const recovered = await waitFor(async () => {
    const s = await p1.evaluate(async () => {
      const pcs = window.__pcs.filter((pc) => pc.connectionState !== 'closed');
      return pcs.some((pc) => pc.connectionState === 'connected');
    });
    return s;
  }, 15000);
  assert('Alice has a connected peer connection after recovery', !!recovered);

  const before = await decodedFrames(p1);
  await sleep(3000);
  const after = await decodedFrames(p1);
  assert('Frames decode again after recovery', after - before >= 5, `${before} -> ${after}`);

  console.log('\n' + '═'.repeat(50));
  console.log(results.join('\n'));
  console.log('═'.repeat(50));
  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);

  await p1.close().catch(() => {});
  await p2.close().catch(() => {});
} catch (err) {
  console.error('Harness error:', err);
  failed++;
} finally {
  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}
