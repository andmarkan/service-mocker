export async function oneOffMessage({
  target,
  message,
  timeout = 3 * 1e3,
} = {}) {
  const { port1, port2 } = new MessageChannel();

  return new Promise((resolve, reject) => {
    const timer = timeout && setTimeout(() => {
      reject(new Error(`messaging timeout: ${JSON.stringify(message)}`));
    }, timeout);

    port1.onmessage = ({ data }) => {
      clearTimeout(timer);

      // avoid high transient memory usage
      // see <https://html.spec.whatwg.org/multipage/comms.html#message-channels>
      port1.onmessage = null;
      port1.close();
      port2.close();

      if (data.error) {
        reject(data);
      } else {
        resolve(data);
      }
    };

    if (target === self.window) {
      // posting message to self => legacy mode
      // add `origin` param to `window.postMessage(message, targetOrigin, [transfer])`
      target.postMessage(message, '*', [port2]);
    } else {
      target.postMessage(message, [port2]);
    }
  });
}
