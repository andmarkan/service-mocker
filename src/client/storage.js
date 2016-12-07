import localforage from 'localforage';

import {
  ACTION,
} from '../constants/';

const store = localforage.createInstance({
  name: 'ServiceMocker',
  description: 'storage space for service mocker',
});

export const clientStorage = {
  activated: false,
  async get(key) {
    return store.getItem(key);
  },
  async set(key, value) {
    return store.setItem(key, value);
  },
  async remove(key) {
    return store.removeItem(key);
  },
  async clear() {
    return store.clear();
  },
  start(useLegacy) {
    if (this.activated) {
      return;
    }

    this.activated = true;

    if (useLegacy) {
      self.addEventListener('message', ::this._handler);
    } else {
      navigator.serviceWorker.addEventListener('message', ::this._handler);
    }
  },
  async _handler(evt) {
    const {
      data,
      ports,
    } = evt;

    if (!ports.length) return;

    try {
      let result;

      switch (data.action) {
        case ACTION.GET_STORAGE:
          result = await this.get(data.key);
          break;
        case ACTION.SET_STORAGE:
          result = await this.set(data.key, data.value);
          break;
        case ACTION.REMOVE_STORAGE:
          result = await this.remove(data.key);
          break;
        case ACTION.CLEAR_STORAGE:
          result = await this.clear();
          break;
        default:
          return;
      }

      ports[0].postMessage({
        result,
        action: ACTION.SUCCESS,
        request: data.action,
      });
    } catch (e) {
      ports[0].postMessage({
        error: e,
        action: ACTION.FAILED,
        request: data.action,
      });
    }
  },
};
