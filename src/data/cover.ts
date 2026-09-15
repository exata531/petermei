/* The words on the Playground cover.

   Everything the cover says out loud lives here, so changing what it says is
   changing this file and nothing else. It is three short lines, one for each
   thing the drawn screen can be doing, plus the word the phone's button
   carries when there is no screen to point at.

   Keep them short. The cover prints nothing else (Peter, 09-14). */

export const cover = {
  /* the screen is showing the desktop, which is almost always */
  on: { cue: 'the screen', verb: 'Look around' },
  /* after Shut Down */
  off: { cue: 'the screen to turn it on', verb: 'Turn on' },
  /* after the screen saver has put it to sleep */
  asleep: { cue: 'the screen to wake it', verb: 'Wake' },
};

/* the cue reads "Click …" on a machine with a mouse and "Tap …" on a phone,
   so the verb is added here rather than written into each line above */
export const cue = (s: keyof typeof cover, tapping: boolean) =>
  `${tapping ? 'Tap' : 'Click'} ${cover[s].cue}`;
