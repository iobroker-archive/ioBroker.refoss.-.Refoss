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
                // 验证消息类型
                if (!Buffer.isBuffer(msg)) {
                    this.adapter.log.warn(
                        `[UDP] Received non-Buffer message from ${rinfo.address}:${rinfo.port}, type: ${typeof msg}`,
                    );
                    return;
                }

                // 转换为字符串并验证是否为有效的JSON格式
                const msgString = msg.toString();
                if (!msgString || msgString.trim() === '') {
                    this.adapter.log.warn(`[UDP] Received empty message from ${rinfo.address}:${rinfo.port}`);
                    return;
                }

                // 检查字符串是否看起来像JSON（以{开头，以}结尾）
                if (!msgString.trim().startsWith('{') || !msgString.trim().endsWith('}')) {
                    this.adapter.log.warn(
                        `[UDP] Received non-JSON format message from ${rinfo.address}:${rinfo.port}: "${msgString}"`,
                    );
                    return;
                }

                let deveiceInfo;
                try {
                    deveiceInfo = JSON.parse(msgString);
                } catch (error) {
                    this.adapter.log.warn(
                        `[UDP] JSON parse failed from ${rinfo.address}:${rinfo.port}: "${msgString}"`,
                    );
                    this.adapter.log.debug(`[UDP] JSON parse error: ${error.toString()}`);
                    return;
                }

                // 验证解析后的对象是否为有效的对象类型
                if (typeof deveiceInfo !== 'object' || deveiceInfo === null || Array.isArray(deveiceInfo)) {
                    this.adapter.log.warn(
                        `[UDP] Parsed JSON is not a valid object from ${rinfo.address}:${rinfo.port}: ${JSON.stringify(deveiceInfo)}`,
                    );
                    return;
                }

                if (!deveiceInfo.devName || !deveiceInfo.uuid) {
                    this.adapter.log.warn(
                        `[UDP] Missing required fields in device info from ${rinfo.address}:${rinfo.port}: ${JSON.stringify(deveiceInfo)}`,
                    );
                    return;
                }
                // Verify devName and uuid
                const devName = this.sanitizeDevName(deveiceInfo.devName);
                if (!this.isValidUuid(deveiceInfo.uuid)) {
                    this.adapter.log.warn(
                        `[UDP] Invalid UUID from ${rinfo.address}:${rinfo.port}: ${deveiceInfo.uuid}`,
                    );
                    return;
                }
                // Init Objects
                if (this.deviceExists(devName) && !this.deviceUuidList.includes(deveiceInfo.uuid)) {
                    // Currently only supported, We will gradually support different models of devices in the future
                    this.adapter.log.info(
                        `[UDP] Adding new device: ${devName} (UUID: ${deveiceInfo.uuid}) from ${rinfo.address}:${rinfo.port}`,
                    );
                    this.deviceUuidList.push(deveiceInfo.uuid);
                    const bs = new base(this.adapter, this.objectHelper, deveiceInfo);
                    this.deviceBase.push(bs);
                } else if (!this.deviceExists(devName)) {
                    this.adapter.log.debug(
                        `[UDP] Unsupported device type: ${devName} from ${rinfo.address}:${rinfo.port}`,
                    );
                } else {
                    this.adapter.log.debug(
                        `[UDP] Device already exists: ${devName} (UUID: ${deveiceInfo.uuid}) from ${rinfo.address}:${rinfo.port}`,
                    );
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
