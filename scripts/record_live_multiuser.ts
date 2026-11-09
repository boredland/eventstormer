import { WebSocket } from 'ws';

// This script will be run within eval or bun with omp's browser automation.
export async function runMultiUserRecording(browser: any, outputPath: string) {
  const roomId = `live-demo-${Date.now().toString(36)}`;
  const url = `https://eventstormer.jonas-strassel.de/w/${roomId}`;
  console.log(`Starting live recording on ${url}...`);

  const tab = await browser.open({
    url,
    viewport: { width: 1280, height: 720 },
    persist: true
  });

  // Setup local user as Alex (Lead Architect)
  await tab.evaluate(() => {
    localStorage.setItem('eventstormer_user', JSON.stringify({
      clientId: 'alex-lead',
      name: 'Alex (Lead Architect)',
      color: '#0ea5e9'
    }));
  });
  await tab.reload();
  function delay(ms: number): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
  }
  await delay(1500);

  // Connect Sarah (Product Owner) and Elena (Domain Expert) via WebSocket
  const wsUrl = `wss://eventstormer.jonas-strassel.de/api/workspace/${roomId}/ws`;
  const wsSarah = new WebSocket(wsUrl);
  const wsElena = new WebSocket(wsUrl);

  const { promise: pSarah, resolve: rSarah } = Promise.withResolvers<void>();
  wsSarah.on('open', () => {
    wsSarah.send(JSON.stringify({
      type: 'join',
      clientId: 'sarah-po',
      name: 'Sarah (Product Lead)',
      color: '#f97316'
    }));
    rSarah();
  });

  const { promise: pElena, resolve: rElena } = Promise.withResolvers<void>();
  wsElena.on('open', () => {
    wsElena.send(JSON.stringify({
      type: 'join',
      clientId: 'elena-expert',
      name: 'Elena (Domain Expert)',
      color: '#a855f7'
    }));
    rElena();
  });

  await Promise.all([pSarah, pElena]);
  console.log('Sarah and Elena connected to workspace.');
  async function moveCursor(
    ws: WebSocket,
    clientId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationMs: number
  ) {
    const steps = Math.max(5, Math.floor(durationMs / 60));
    const stepTime = durationMs / steps;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const curX = Math.round(fromX + (toX - fromX) * ease);
      const curY = Math.round(fromY + (toY - fromY) * ease);
      ws.send(JSON.stringify({
        type: 'cursor',
        clientId,
        x: curX,
        y: curY,
      }));
      await delay(stepTime);
    }
  }

  async function typeRemoteSticky(
    ws: WebSocket,
    sticky: any,
    fullText: string,
    cursorX: number,
    cursorY: number,
    clientId: string
  ) {
    // Send initial empty sticky
    ws.send(JSON.stringify({
      type: 'sticky:upsert',
      sticky: { ...sticky, text: '' }
    }));
    await delay(250);

    // Type text in word-by-word chunks with safe delay (<= 5 msgs/sec)
    const words = fullText.split(' ');
    let currentText = '';
    for (const word of words) {
      currentText = (currentText + ' ' + word).trim();
      ws.send(JSON.stringify({
        type: 'sticky:upsert',
        sticky: { ...sticky, text: currentText, updatedAt: Date.now() }
      }));
      ws.send(JSON.stringify({
        type: 'cursor',
        clientId,
        x: cursorX + Math.min(100, currentText.length * 5),
        y: cursorY,
      }));
      await delay(220 + Math.random() * 80);
    }
  }

  // Active frame generator to guarantee 30 FPS screencast capture
  await tab.evaluate(() => {
    const ticker = document.createElement('div');
    ticker.style.position = 'fixed';
    ticker.style.bottom = '0px';
    ticker.style.right = '0px';
    ticker.style.width = '2px';
    ticker.style.height = '2px';
    ticker.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    ticker.style.pointerEvents = 'none';
    document.body.appendChild(ticker);
    let n = 0;
    function anim() {
      n = (n + 1) % 50;
      ticker.style.left = n + 'px';
      requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);
  });

  // START RECORDING
  console.log('Starting video recording...');
  await tab.recordStart(outputPath);
  await delay(1000);

  // ACT 1: Timer start & Cursors enter
  console.log('Act 1: Cursors entering...');
  // Click start timer button in header if present
  try {
    await tab.click('button[title*="Start Timer"]');
  } catch {
    // Timer may already be running
  }

  // Sarah and Elena move into view
  await Promise.all([
    moveCursor(wsSarah, 'sarah-po', 1200, 600, 480, 240, 1200),
    moveCursor(wsElena, 'elena-expert', 1100, 100, 780, 260, 1400)
  ]);
  await delay(400);

  // ACT 2: Sarah creates "Order Placed"
  console.log('Act 2: Sarah places Order Placed...');
  const orderPlacedId = 'event-order-placed';
  const orderPlacedSticky = {
    id: orderPlacedId,
    type: 'domain-event',
    text: '',
    x: 480,
    y: 220,
    votes: 0,
    authorName: 'Sarah (Product Lead)',
    authorColor: '#f97316',
    updatedAt: Date.now()
  };
  await typeRemoteSticky(wsSarah, orderPlacedSticky, 'Order Placed', 540, 260, 'sarah-po');
  await delay(500);

  // Alex selects Blue Command tool and creates "Submit Order"
  console.log('Act 2: Alex creates Command Submit Order...');
  // Move Alex cursor and click palette Command button
  await tab.click('button[title*="Command"]');
  await delay(300);
  await tab.clickAt(270, 220);
  await delay(400);

  // Alex double-clicks the created command sticky to edit
  const commandEl = await tab.evaluate(() => {
    const el = document.querySelector('[data-sticky-id]:not([data-sticky-id="event-order-placed"])');
    return el ? el.getAttribute('data-sticky-id') : null;
  });

  if (commandEl) {
    await tab.dblclick(`[data-sticky-id="${commandEl}"]`);
    await delay(300);
    const hasTextarea = await tab.evaluate(() => !!document.querySelector('textarea'));
    if (hasTextarea) {
      await tab.type('textarea', 'Submit Order', { delay: 60 });
      await delay(200);
      await tab.press('Enter');
      await delay(400);
    }
  }

  // ACT 3: Business Policy & Flow
  console.log('Act 3: Elena adds Policy...');
  await moveCursor(wsElena, 'elena-expert', 780, 260, 480, 370, 800);
  const policySticky = {
    id: 'policy-fraud-check',
    type: 'policy',
    text: '',
    x: 480,
    y: 370,
    votes: 0,
    authorName: 'Elena (Domain Expert)',
    authorColor: '#a855f7',
    updatedAt: Date.now()
  };
  await typeRemoteSticky(wsElena, policySticky, 'Whenever Order Placed -> Verify Fraud Score', 550, 410, 'elena-expert');
  await delay(400);

  // Elena adds "Payment Authorized"
  console.log('Act 3: Elena adds Payment Authorized...');
  await moveCursor(wsElena, 'elena-expert', 550, 410, 690, 220, 800);
  const paymentSticky = {
    id: 'event-payment-authorized',
    type: 'domain-event',
    text: '',
    x: 690,
    y: 220,
    votes: 0,
    authorName: 'Elena (Domain Expert)',
    authorColor: '#a855f7',
    updatedAt: Date.now()
  };
  await typeRemoteSticky(wsElena, paymentSticky, 'Payment Authorized', 750, 260, 'elena-expert');
  await delay(500);

  // Sarah adds "Parcel Dispatched"
  console.log('Act 3: Sarah adds Parcel Dispatched...');
  await moveCursor(wsSarah, 'sarah-po', 540, 260, 900, 220, 800);
  const dispatchSticky = {
    id: 'event-parcel-dispatched',
    type: 'domain-event',
    text: '',
    x: 900,
    y: 220,
    votes: 0,
    authorName: 'Sarah (Product Lead)',
    authorColor: '#f97316',
    updatedAt: Date.now()
  };
  await typeRemoteSticky(wsSarah, dispatchSticky, 'Parcel Dispatched to Carrier', 960, 260, 'sarah-po');
  await delay(500);

  // Alex adds a vertical Pivotal Milestone line
  console.log('Act 3: Alex adds Pivotal Line...');
  wsSarah.send(JSON.stringify({
    type: 'pivotal:upsert',
    line: {
      id: 'pivotal-order-confirmed',
      name: 'Order Confirmed',
      x: 650,
      color: '#FF9F1C'
    }
  }));
  await delay(600);

  // ACT 4: Hotspot & Dot Voting
  console.log('Act 4: Sarah adds Hotspot...');
  await moveCursor(wsSarah, 'sarah-po', 960, 260, 480, 80, 700);
  const hotspotSticky = {
    id: 'hotspot-webhook-delay',
    type: 'hotspot',
    text: '',
    x: 480,
    y: 70,
    votes: 0,
    authorName: 'Sarah (Product Lead)',
    authorColor: '#f97316',
    updatedAt: Date.now()
  };
  await typeRemoteSticky(wsSarah, hotspotSticky, 'Stripe Webhook Timeout Under Load!', 540, 110, 'sarah-po');
  await delay(600);

  // Alex turns on Voting Mode!
  console.log('Act 4: Alex toggles Voting Mode...');
  await tab.click('#tour-voting');
  await delay(500);

  // Sarah votes on Hotspot
  console.log('Act 4: Sarah votes...');
  await moveCursor(wsSarah, 'sarah-po', 540, 110, 580, 120, 500);
  wsSarah.send(JSON.stringify({
    type: 'sticky:vote',
    id: 'hotspot-webhook-delay',
    delta: 1
  }));
  await delay(600);

  // Elena votes on Hotspot
  console.log('Act 4: Elena votes...');
  await moveCursor(wsElena, 'elena-expert', 750, 260, 575, 115, 600);
  wsElena.send(JSON.stringify({
    type: 'sticky:vote',
    id: 'hotspot-webhook-delay',
    delta: 1
  }));
  await delay(600);

  // Alex votes on Hotspot via local click
  console.log('Act 4: Alex votes...');
  const voteBtnPos = await tab.evaluate(() => {
    const s = document.querySelector('[data-sticky-id="hotspot-webhook-delay"]');
    const b = s?.querySelector('button[title*="vote"]');
    if (b) {
      const rect = b.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }
    return null;
  });
  if (voteBtnPos) {
    await tab.clickAt(voteBtnPos.x, voteBtnPos.y);
  } else {
    wsSarah.send(JSON.stringify({
      type: 'sticky:vote',
      id: 'hotspot-webhook-delay',
      delta: 1
    }));
  }
  await delay(1000);

  // Elena adds an Opportunity card
  console.log('Act 5: Elena adds Opportunity...');
  await moveCursor(wsElena, 'elena-expert', 575, 115, 690, 370, 700);
  const oppSticky = {
    id: 'opp-idempotent-dlq',
    type: 'opportunity',
    text: '',
    x: 690,
    y: 370,
    votes: 0,
    authorName: 'Elena (Domain Expert)',
    authorColor: '#a855f7',
    updatedAt: Date.now()
  };
  await typeRemoteSticky(wsElena, oppSticky, 'Idempotent Webhook Queue with DLQ', 750, 410, 'elena-expert');
  await delay(800);

  // ACT 6: Export Modal & Summary
  console.log('Act 6: Alex opens Export Modal...');
  await tab.click('#tour-export');
  await delay(1200);

  // Hover over Copy button inside export modal
  const copyBtn = await tab.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Copy Markdown'));
    if (btn) {
      const rect = btn.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }
    return null;
  });

  if (copyBtn) {
    await tab.clickAt(copyBtn.x, copyBtn.y);
    await delay(1500);
  }

  // Close Export Modal
  try {
    await tab.click('button[title*="Close"]');
  } catch {
    await tab.press('Escape');
  }
  await delay(1000);
  // Subtle farewell cursor wave
  await Promise.all([
    moveCursor(wsSarah, 'sarah-po', 580, 120, 950, 480, 1000),
    moveCursor(wsElena, 'elena-expert', 750, 410, 1020, 520, 1000)
  ]);
  await delay(1200);

  // STOP RECORDING
  console.log('Stopping recording...');
  const recResult = await tab.recordStop();
  console.log('Recording finished:', recResult);

  // Clean up
  wsSarah.close();
  wsElena.close();
  await tab.close();

  return recResult;
}
