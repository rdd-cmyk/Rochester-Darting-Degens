// Own lifecycle wrapper around the unchanged, pinned upstream worker. The
// upstream createWorker promise exposes its worker only after initialization;
// this channel lets cancel/error cleanup also stop a worker during model load.
const channelName = new URL(self.location.href).searchParams.get('channel');
const control = new BroadcastChannel(channelName);
control.onmessage = event => {
  if (event.data === 'stop') {
    control.close();
    self.close();
  }
};
// Bound initialization even if cancellation happened before the worker's
// channel existed. A ready worker is owned/terminated by recognizeBoard.
const initializationDeadline = setTimeout(() => {
  control.close();
  self.close();
}, 60_000);
self.addEventListener('message', event => {
  if (event.data.action === 'recognize') clearTimeout(initializationDeadline);
});
importScripts('./v7/worker.min.js');
