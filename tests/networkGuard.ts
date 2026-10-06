// A component may catch a fixture error. Preserve it so teardown still fails
// the test instead of mistaking an unconfigured request for a valid error flow.
const unexpectedRequests: string[] = [];

export function recordUnexpectedRequest(message: string) {
  unexpectedRequests.push(message);
}

export function resetUnexpectedRequests() {
  unexpectedRequests.length = 0;
}

export function readUnexpectedRequests(): readonly string[] {
  return [...unexpectedRequests];
}
