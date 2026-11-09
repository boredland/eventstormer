import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function startJoyrideTour() {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    steps: [
      {
        element: '#tour-sticky-palette',
        popover: {
          title: 'Brandolini Sticky Palette',
          description:
            'Alberto Brandolini’s color syntax: Orange for Domain Events (past tense), Neon Pink for Hotspots/Risks (-6° tilted), Yellow for Actors, Blue for Commands, and more. Use keyboard shortcuts [1] to [9] to spawn instantly!',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-canvas-controls',
        popover: {
          title: 'Infinite Canvas Navigation',
          description:
            'Hold Space + Drag or use Middle Mouse to pan freely. Scroll or pinch to zoom from 15% to 300%. Click the Maximize icon to fit all content on screen.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#tour-minimap',
        popover: {
          title: 'Live Minimap',
          description:
            'Shows an overview of all stickies across the infinite canvas. Click or drag the viewport rectangle to jump anywhere instantly.',
          side: 'left',
          align: 'end',
        },
      },
      {
        element: '#tour-phase-guide',
        popover: {
          title: 'Facilitator Phase Guide',
          description:
            'Guides your team through the proven EventStorming stages: Chaotic Event Generation, Reverse Narrative, Hotspots, and Swimlanes.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-timer',
        popover: {
          title: 'Synchronized Facilitator Timer',
          description:
            'Keep brainstorming sessions timeboxed! The countdown timer synchronizes in real-time across all attendees with an audio alert on zero.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-voting',
        popover: {
          title: 'Dot-Voting Mode',
          description:
            'Enable Dot-Voting mode to prioritize critical hotspots, contentious events, or key business bottlenecks as a team.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-templates',
        popover: {
          title: 'Sample Domain Templates',
          description:
            'Kick off quickly with real-world domains: E-Commerce Fulfillment, Insurance Claims, or Ride-Hailing architectures.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-share',
        popover: {
          title: 'Instant Multi-User Collaboration',
          description:
            'Copy the room URL and invite your team. Zero accounts, zero login barriers. Live peer cursors show where everyone is working!',
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  });

  driverObj.drive();
}
