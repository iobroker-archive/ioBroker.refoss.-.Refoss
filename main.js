'use strict';

const utils = require('@iobroker/adapter-core');
const objectHelper = require('@apollon/iobroker-tools').objectHelper;
const BaseClient = require('./lib/protocol/udp4').BaseClient;
const BaseServer = require('./lib/protocol/udp4').BaseServer;
const adapterName = require('./package.json').name.split('.').pop();

const tcpPing = require('tcp-ping');

class Refoss extends utils.Adapter {
    /**
     * @param [options] Adapter options
     */
    constructor(options) {
        super({
            ...options,
            name: adapterName,
        });
        this.isUnloaded = false;
        this.baseClient = null;
        this.baseServer = null;
        this.onlineCheckTimeout = null;
        this.onlineDevices = {};
        this.cachedDevices = [];
        this.on('ready', this.onReady.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    async onReady() {
        try {
            objectHelper.init(this);

            await this.initOnlineStatus();

            await this.onlineStatusCheck();

            this.setTimeout(async () => {
                // Create UDP broadcast
                this.clientServer = new BaseClient(this);

                const devices = await this.getDevicesAsync();
                this.server = new BaseServer(this, objectHelper, devices);
            }, 100);
        } catch (error) {
            this.log.error(error.toString());
        }
    }

    /**
     * @param callback onUnload callback
     */
    async onUnload(callback) {
        this.isUnloaded = true;

        if (this.onlineCheckTimeout) {
            this.clearTimeout(this.onlineCheckTimeout);
            this.onlineCheckTimeout = null;
        }

        this.initOnlineStatus();
        try {
            if (this.clientServer) {
                this.clientServer.destroy();
            }
            if (this.server) {
                await this.server.destroy();
            }
            callback();
        } catch (e) {
            this.log.error(e.toString());
            callback();
        }
    }
    async initOnlineStatus() {
        await this.getAllDeviceIds();
        for (const deviceId of this.cachedDevices) {
            const idOnline = `${deviceId}.online`;
            const stateHostname = await this.getStateAsync(`${deviceId}.hostname`);
            const valHostname = stateHostname ? stateHostname.val : undefined;
            let isAlive = false;
            if (valHostname) {
                // Wrap tcpPing.probe with Promise
                isAlive = await new Promise(resolve => {
                    tcpPing.probe(valHostname, 80, (error, alive) => {
                        resolve(alive);
                    });
                });
            }
            await this.setStateAsync(idOnline, { val: isAlive, ack: true });
            if (isAlive) {
                this.onlineDevices[deviceId] = true;
            }
        }
        // Update connection status
        const onlineDeviceCount = Object.keys(this.onlineDevices).length;
        await this.setStateAsync('info.connection', { val: onlineDeviceCount > 0, ack: true });
    }
    /**
     * Online-Check TCP ping
     */
    async onlineStatusCheck() {
        const valPort = 80;
        if (this.onlineCheckTimeout) {
            this.clearTimeout(this.onlineCheckTimeout);
            this.onlineCheckTimeout = null;
        }

        try {
            for (const deviceId of this.cachedDevices) {
                const stateHostaname = await this.getStateAsync(`${deviceId}.hostname`);
                const valHostname = stateHostaname ? stateHostaname.val : undefined;
                if (valHostname) {
                    this.log.debug(`[onlineStatusCheck] Checking ${deviceId} on ${valHostname}:${valPort}`);
                    tcpPing.probe(valHostname, valPort, (error, isAlive) => {
                        this.deviceStatusUpdate(deviceId, isAlive);
                    });
                }
            }
        } catch (error) {
            this.log.error(error.toString());
        }

        this.onlineCheckTimeout = this.setTimeout(() => {
            this.onlineCheckTimeout = null;
            this.onlineStatusCheck();
        }, 15 * 1000); // Restart online check in 15 seconds
    }
    async deviceStatusUpdate(deviceId, status) {
        if (this.isUnloaded) {
            return;
        }
        if (!deviceId) {
            return;
        }

        // Update online status
        const idOnline = `${deviceId}.online`;
        const stateOnline = await this.getStateAsync(idOnline);
        const prevValue = stateOnline ? stateOnline.val === true || stateOnline.val === 'true' : false;
        if (prevValue !== status) {
            await this.setStateAsync(idOnline, { val: status, ack: true });
            // If the device goes online again, trigger data update
            if (status && this.server) {
                const deviceBase = this.server.deviceBase.find(device => device.deviceId === deviceId);
                if (deviceBase) {
                    await deviceBase.httpState();
                }
            }
        }

        // Update connection state
        const oldOnlineDeviceCount = Object.keys(this.onlineDevices).length;

        if (status) {
            this.onlineDevices[deviceId] = true;
        } else if (Object.prototype.hasOwnProperty.call(this.onlineDevices, deviceId)) {
            delete this.onlineDevices[deviceId];
        }

        const newOnlineDeviceCount = Object.keys(this.onlineDevices).length;

        // Check online devices
        if (oldOnlineDeviceCount !== newOnlineDeviceCount) {
            this.log.debug(`[deviceStatusUpdate] Online devices: ${JSON.stringify(Object.keys(this.onlineDevices))}`);
            if (newOnlineDeviceCount > 0) {
                await this.setStateAsync('info.connection', { val: true, ack: true });
            } else {
                await this.setStateAsync('info.connection', { val: false, ack: true });
            }
        }
    }

    async getAllDeviceIds() {
        const devices = await this.getDevicesAsync();
        this.cachedDevices = devices.map(device => this.removeNamespace(device._id));
    }
    registerDeviceId(deviceId) {
        if (!deviceId) {
            return;
        }
        if (!this.cachedDevices.includes(deviceId)) {
            this.cachedDevices.push(deviceId);
        }
    }
    isOnline(deviceId) {
        return Object.prototype.hasOwnProperty.call(this.onlineDevices, deviceId);
    }

    removeNamespace(id) {
        const re = new RegExp(`${this.namespace}*\\.`, 'g');
        return id.replace(re, '');
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param [options] options
     */
    module.exports = options => new Refoss(options);
} else {
    // otherwise start the instance directly
    new Refoss();
}
