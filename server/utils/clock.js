// The server's one reading of "now" for anything that decides what day it is:
// streaks, off days, today's plan, the undo window, the week ahead.
//
// Callers go through the module object (`clock.now()`, never a destructured
// `now`) so a test can pin the time with node:test's mock.method(clock, 'now')
// and land a request at exactly 23:59:59.999Z or 00:00:00.000Z. Without that,
// day-boundary cases could only be faked by back-dating documents, and any
// test that straddled UTC midnight saw "today" change under it.
const now = () => new Date();

module.exports = { now };
