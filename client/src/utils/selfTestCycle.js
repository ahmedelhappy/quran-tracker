// The hide-all self-test's per-verse cycle, in one place.
//
// Pressing a verse walks it through three steps: reveal → select → hide (+ deselect).
// A plain click runs it from MushafPage; while annotating, the ink layer covers the
// words and a RIGHT-click runs it instead (see MushafDrawLayer's secondary press).
// Both ask this function which step is next, so there is only ever one ladder.
//
// `concealed` is the pressed WORD's own state, not the verse's: after a drag-reveal
// stopped mid-verse the verse is partly shown, and a press on a still-hidden word
// of it has to reveal before anything else.
export const hideModeStep = ({ concealed, selected }) =>
  concealed ? 'reveal' : selected ? 'hide' : 'select';

// A press counts as SECONDARY — the one that reaches through the ink while annotating —
// when it is the right button, or a primary-button mouse press with Ctrl held:
// macOS turns Ctrl+click into a right-click but reports it as button 0, and
// treating it the same everywhere keeps it from ever leaving a dot of ink.
export const isSecondaryPress = (e) =>
  e.button === 2 || (e.button === 0 && e.pointerType === 'mouse' && e.ctrlKey);
