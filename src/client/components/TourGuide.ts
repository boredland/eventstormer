import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function startJoyrideTour() {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    steps: [
      {
        popover: {
          title: 'Welcome',
          description:
            'This is a shared board. Your team puts a business process on it using colored sticky notes, all at the same time. This tour takes about a minute.',
        },
      },
      {
        element: '#tour-sticky-palette',
        popover: {
          title: 'Sticky notes: one color, one meaning',
          description:
            'Each color is a different kind of thing. Orange = something that happened. Blue = an action someone takes. Pink = a problem or question. Hover any color to see what it means, an example, and a question to ask yourself. Click one, then click the board to place it.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-canvas-controls',
        popover: {
          title: 'Move around',
          description:
            'The board is huge. Scroll or pinch to zoom. Hold Space and drag to move around. The button with arrows fits everything on screen.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#tour-minimap',
        popover: {
          title: 'Small map',
          description:
            'A tiny overview of the whole board. Click or drag in it to jump to another area.',
          side: 'left',
          align: 'end',
        },
      },
      {
        element: '#tour-phase-guide',
        popover: {
          title: 'Phases: what to do next',
          description:
            'A step-by-step guide for the workshop. It tells you what stage you are in, what to aim for, and which stickies to use. The person leading the session usually moves through the steps.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-timer',
        popover: {
          title: 'Shared timer',
          description:
            'Everyone sees the same countdown. It keeps each step short. A tone plays at zero.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-breakouts',
        popover: {
          title: 'Breakouts: small teams',
          description:
            'Split into small groups. Each group gets its own private board and only sees its own stickies. When the facilitator ends the breakout, each group becomes a lane on the main board so everything is together again.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-voting',
        popover: {
          title: 'Voting',
          description:
            'Turn this on and every sticky gets a 👍 button. Click it to add a vote (shown as ★ and a count). The stickies with the most votes are what the group cares about most. Usually used on the pink problem stickies.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-templates',
        popover: {
          title: 'Examples',
          description:
            'Load a finished board for a real scenario, such as an online shop or an insurance claim. Good for seeing what a result looks like. It replaces the current board.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-share',
        popover: {
          title: 'Invite people',
          description:
            'Copy the link and send it. Anyone who opens it joins the same board. No account needed. You will see their cursors move live.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-help',
        popover: {
          title: 'Stuck? Click Help',
          description:
            'Help explains every color, every button, and the keyboard shortcuts. Open it any time.',
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  });

  driverObj.drive();
}
