/**
 * PWS-AI-ENGINE-01R2-SAFETY-02 — a stand-in for `unpdf` whose parse never
 * finishes, used to prove the PDF worker is really terminated rather than
 * merely abandoned.
 *
 * The busy loop is deliberate: it blocks the worker's event loop completely,
 * which is exactly the case a `Promise.race` timeout could not handle. Only a
 * real `worker.terminate()` can stop this, so a test that observes the worker
 * thread exiting has proven termination and not just a rejected promise.
 *
 * Never imported by production code — the module path is passed explicitly by
 * the test through the `moduleEntry` option.
 */
export async function getDocumentProxy() {
  while (true) {
    // Spin forever. No await, no timer: nothing here can yield.
  }
}
