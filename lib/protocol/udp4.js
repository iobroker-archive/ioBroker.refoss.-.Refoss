'use strict';

const base = require('./base').Base;
var dgram = require('dgram');
var client = dgram.createSocket('udp4');
var server = dgram.createSocket('udp4');
const datapoints = require('../datapoints');

/**
 * Client sends UDP broadcast
 */
class BaseClient {
    /**
     *
     * @param adapter adapter
     */
    constructor(adapter) {
        this.adapter = adapter;
        client.bind(9988, () => {
            client.setBroadcast(true);
        });
        this.data = JSON.stringify({
            id: '48cbd88f969eb3c486085cfe7b5eb1e4',
            devName: '*',
        });
        const INTERVAL = 60 * 60 * 1000; // 60 min
        // start timer
        this.timer = setInterval(() => {
            this.adapter.log.debug(`Sending UDP broadcasts...`);
            this.start();
        }, INTERVAL);
        this.start(); // first call
    }
    /**
     * start
     */
    start() {
        for (let i = 0; i < 3; i++) {
            setTimeout(
                () => {
                    client.send(this.data, 0, this.data.length, 9988, '255.255.255.255', () => {
                        this.adapter.log.debug(`[UDP] broadcast port: 9988`);
                    });
                },
                1000 * (i + 1),
            );
        }
    }
    /**
     * destroy
     */
    destroy() {
        client.close();
        clearInterval(this.timer);
    }
}
/**
 * Server receiving device reply
 */
class BaseServer {
    /**
     *
     * @param adapter adapter
     * @param objectHelper objectHelper
     * @param devices devices
     */
    constructor(adapter, objectHelper, devices) {
        this.adapter = adapter;
        this.objectHelper = objectHelper;
        this.deviceBase = [];
        this.deviceUuidList = []; // e.g. 2310166363058874000134298f1f41e8
        this.adapter.log.info(`000000-----${JSON.stringify(devices)}`);

        // Add know devices without message
        for (const device of devices) {
            this.adapter.log.debug(`Add know device ${device['_id']}`);

            this.deviceUuidList.push(device['common']['deveiceInfo']['uuid']);
            const bs = new base(adapter, objectHelper, device['common']['deveiceInfo']);
            this.deviceBase.push(bs);
        }
        this.start();
    }
    /**
     * start
     */
    start() {
        server.on('error', err => {
            this.adapter.log.error(`[UDP] server error ${err.stack}`);
            server.close();
        });
        // Server receiving
        server.on('message', async (msg, rinfo) => {
            this.adapter.log.debug(`[UDP] server got ${msg} from ${rinfo.address}: ${rinfo.port}`);
            if (msg) {
                let deveiceInfo;
                try {
                    deveiceInfo = JSON.parse(msg.toString());
                } catch (error) {
                    this.adapter.log.error(error.toString());
                    return;
                }
                if (!deveiceInfo.devName || !deveiceInfo.uuid) {
                    this.adapter.log.error(`Missing required fields in deveiceInfo: ${JSON.stringify(deveiceInfo)}`);
                    return;
                }
                this.adapter.log.debug(`222222222----- ${JSON.stringify(deveiceInfo)}`);
                this.adapter.log.debug(`3333333 isvalid----- ${this.isValidUuid(deveiceInfo.uuid)}`);
                // Verify devName and uuid
                const devName = this.sanitizeDevName(deveiceInfo.devName);
                if (!this.isValidUuid(deveiceInfo.uuid)) {
                    this.adapter.log.error(`Invalid UUID: ${deveiceInfo.uuid}`);
                    return;
                }
                // Init Objects
                if (this.deviceExists(devName) && !this.deviceUuidList.includes(deveiceInfo.uuid)) {
                    // Currently only supported, We will gradually support different models of devices in the future
                    this.deviceUuidList.push(deveiceInfo.uuid);
                    const bs = new base(this.adapter, this.objectHelper, deveiceInfo);
                    this.deviceBase.push(bs);
                }
            }
        });
        // Server listening
        server.on('listening', () => {
            var address = server.address();
            this.adapter.log.debug(`[UDP] server listening${address.address}: ${address.port}`);
        });
        server.bind(9989);
    }
    /**
     *
     * @param devName device name
     * @returns boolean
     */
    deviceExists(devName) {
        return datapoints.getDeviceTypeByClass(devName) ? true : false;
    }
    /**
     *
     * Verify devName
     *
     * @param devName devName
     * @returns devName
     */
    sanitizeDevName(devName) {
        return (devName || '').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    /**
     *
     * Verify uuid
     *
     * @param uuid uuid
     * @returns uuidRegex
     */
    isValidUuid(uuid) {
        const uuidRegex = /^[0-9a-f]{32}$/i;
        return uuidRegex.test(uuid);
    }
    /**
     * destroy
     */
    destroy() {
        for (const i in this.deviceBase) {
            this.deviceBase[i].destroy();
        }
        server.close();
    }
}

module.exports = {
    BaseClient,
    BaseServer,
};
