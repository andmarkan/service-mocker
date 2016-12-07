import { register } from './register';
import { connect } from './connect';
import { disconnect } from './disconnect';
import { getNewestReg } from './get-newest-reg';
import { clientStorage } from './storage';

import { debug } from '../utils/';
import { LegacyClient } from '../legacy-client/';

function isLegacyClient() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service worker is not supported in your browser, please check: http://caniuse.com/#feat=serviceworkers');

    return true;
  }

  if (location.protocol !== 'https' && location.hostname !== 'localhost') {
    console.warn('Service workers should be registered in secure pages, further information: https://github.com/w3c/ServiceWorker/blob/master/explainer.md#getting-started');

    return true;
  }

  return true;
}

export class Client {
  controller = null;
  ready = null;

  constructor(path, options) {
    const useLegacy = isLegacyClient();

    clientStorage.start(useLegacy);

    if (useLegacy) {
      console.warn('Switching to legacy mode...');
      return new LegacyClient(path);
    }

    Object.defineProperties(this, {
      _updateListeners: {
        value: [],
      },
    });

    this._setReady(this._init(path, options));
  }

  onUpdate(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('handler must be a function');
    }

    const {
      _updateListeners: listeners,
    } = this;

    listeners.push(fn);

    return {
      remove() {
        for (let i = 0, max = listeners.length; i < max; i++) {
          if (listeners[i] === fn) {
            return listeners.splice(i, 1);
          }
        }
      },
    };
  }

  async update() {
    return getNewestReg();
  }

  async getRegistration() {
    return this.ready;
  }

  async unregister() {
    const registration = await this.getRegistration();

    const result = await registration.unregister();

    if (!result) {
      throw new Error('this service worker has already been unregistered, you may need to close all relative tabs to remove it');
    }

    return result;
  }

  async _init(path, options) {
    if (this._hasInitialized()) {
      return this.getRegistration();
    }

    const registration = await register(path, options);

    this._autoSyncClient();
    this._handleUnload();

    return registration;
  }

  _hasInitialized() {
    return this.ready !== null;
  }

  _setReady(updater) {
    if (this._hasInitialized()) {
      return;
    }

    this.ready = new Promise(resolve => {
      updater
        .then(registration => {
          this.controller = registration.active;
          resolve(registration);
        })
        .catch(error => {
          this.controller = null;
          debug.error('mocker initialization failed: ', error);
        });
    });
  }

  _autoSyncClient() {
    const {
      serviceWorker,
    } = navigator;

    const updateLog = debug.scope('update');

    serviceWorker.addEventListener('controllerchange', async (evt) => {
      let error = null;
      let registration = null;

      try {
        registration = await connect(true);
        this.controller = registration.active;

        updateLog.color('crimson')
          .warn('mocker updated, reload your requests to take effect');
      } catch (e) {
        error = e;
        updateLog.error('connecting to new mocker failed', e);
      }

      this._updateListeners.forEach((fn) => {
        fn(error, registration);
      });
    });
  }

  _handleUnload() {
    window.addEventListener('beforeunload', disconnect);
  }
}
