'use strict';

const datapoints = require('../datapoints');
const refossHttp = require('../protocol/http');
const refossUtils = require('../refoss-utils');

/**
 * Base main
 */
class Base {
    /**
     *
     * @param adapter adapter
     * @param objectHelper objectHelper
     * @param deveiceInfo device informatio
     */
    constructor(adapter, objectHelper, deveiceInfo) {
        this.deveiceInfo = deveiceInfo;
        this.adapter = adapter;
        this.objectHelper = objectHelper;
        this.deviceId = null;
        this.ip = deveiceInfo.ip;
        this.uuid = deveiceInfo.uuid;
        this.device = {};
        this.http = {};
        this.httpData = {};
        this.stateValueCache = {};
        this.httpIoStateTimeout = null;
        this.initObjects();
    }
    /**
     * init Objects
     */
    async initObjects() {
        this.getDeviceId(this.deveiceInfo);
        await this.createObjects();
        await this.httpState();
    }
    /**
     * createObjects
     *
     * @returns Promise object
     */
    async createObjects() {
        return new Promise(resolve => {
            try {
                const deviceStatesHttp = {};
                const deviceStates = datapoints.getDeviceByClass();
                if (deviceStates) {
                    for (const stateId in deviceStates) {
                        const state = deviceStates[stateId];
                        state.state = stateId;
                        this.objectHelper.setOrUpdateObject(
                            this.deviceId,
                            {
                                type: 'device',
                                common: {
                                    name: `Device ${this.deviceId}`,
                                    statusStates: {
                                        onlineId: `${this.adapter.namespace}.${this.deviceId}.online`,
                                    },
                                    deveiceInfo: this.deveiceInfo,
                                },
                                native: {},
                            },
                            ['name'],
                        );
                        const channel = stateId.split('.').slice(0, 1).join();
                        if (channel !== stateId) {
                            const channelId = `${this.deviceId}.${channel}`;
                            this.objectHelper.setOrUpdateObject(
                                channelId,
                                {
                                    type: 'channel',
                                    common: {
                                        name: `Channel ${channel}`,
                                    },
                                },
                                ['name'],
                            );
                        }
                        const fullStateId = `${this.deviceId}.${stateId}`;

                        let controlFunction;
                        // HTTP
                        if (state.http?.http_namespace) {
                            const key = state.http?.http_namespace;
                            const temp = {
                                stateId: stateId,
                                http_payload: state.http?.http_payload,
                                http_get_ack: state.http?.http_get_ack,
                            };
                            if (!deviceStatesHttp[key]) {
                                deviceStatesHttp[key] = [temp];
                            } else {
                                deviceStatesHttp[key].push(temp);
                            }
                        }

                        // Init value or funct
                        let value = undefined;
                        if (state.http?.init_funct) {
                            value = state.http.init_funct(this);
                        }
                        this.objectHelper.setOrUpdateObject(
                            fullStateId,
                            {
                                type: 'state',
                                common: state.common,
                            },
                            ['name'],
                            value,
                            controlFunction,
                            false,
                        );
                    }
                }
                this.objectHelper.processObjectQueue(() => {
                    this.http = deviceStatesHttp;
                    this.device = deviceStates;
                    this.adapter.log.debug(`[createObjects] Finished object creation of ${this.getLogInfo()}`);
                    resolve(true);
                });
            } catch (error) {
                this.adapter.log.debug(`[createObjects] Error ${error}`);
            }
        });
    }
    /**
     *
     * @returns httpState
     */
    async httpState() {
        if (!this.isOnline() || !this.getIP()) {
            this.adapter.log.debug(`[httpState] Device ${this.getLogInfo()} is offline (or IP is unknown) - waiting`);
            this.httpIoStateTimeout = setTimeout(async () => await this.httpState(), 15000);
            return;
        }
        for (const namespace in this.http) {
            const dps = this.http[namespace];
            try {
                const httpInfo = {
                    http_uuid: this.uuid,
                    http_ip: this.ip,
                    http_namespace: namespace,
                    http_payload: dps[0].http_payload,
                };

                const httpAck = await refossHttp.createHttp(this.adapter, httpInfo);
                this.httpData = httpAck[dps[0].http_get_ack];

                for (const i in dps) {
                    const dp = this.device[dps[i].stateId];
                    const fullStateId = `${this.deviceId}.${dps[i].stateId}`;

                    const value = dp.http?.init_funct(this);

                    this.objectHelper.setOrUpdateObject(
                        fullStateId,
                        {
                            type: 'state',
                            common: dp.common,
                        },
                        ['name'],
                        value,
                    );
                }
            } catch (error) {
                this.adapter.log.debug(`[httpState]-----${error}`);
            }
        }

        if (this.http && Object.keys(this.http).length > 0) {
            this.httpIoStateTimeout = setTimeout(async () => await this.httpState(), 15000); // poll
        }
    }
    /**
     *
     * @param deveiceInfo device information
     */
    getDeviceId(deveiceInfo) {
        const tempId = `refoss${deveiceInfo.devName}#${deveiceInfo.mac.replaceAll(':', '')}`;
        this.deviceId = this.name2id(tempId);
    }
    /**
     * Filter illegal characters
     *
     * @param pName Original name
     * @returns Filtered name
     */
    name2id(pName) {
        return (pName || '').toString().replace(this.adapter.FORBIDDEN_CHARS, '_');
    }
    /**
     *
     * @returns ip
     */
    getIP() {
        return this.ip;
    }
    /**
     *
     * @param channel channel
     * @param type Electricity type
     * @returns value
     */
    getElectricity(channel, type) {
        for (const i in this.httpData) {
            if (parseInt(i) + 1 == channel) {
                let value;
                if (type.indexOf('mConsume') > -1) {
                    value = refossUtils.getNumFormate(this.httpData[i]['mConsume']);
                    if (type == 'mConsume' && value < 0) {
                        value = 0;
                    }
                    if (type == 'mConsumeRe' && value > 0) {
                        value = 0;
                    }
                    value = value > 0 ? value : -value;
                    value = refossUtils.getNumFormate(value);
                } else {
                    value = refossUtils.getNumFormate(this.httpData[i][type]);
                }
                return value;
            }
        }
    }
    /**
     * Returns a string for logging with the IP address, name of device
     *
     * @returns ip + deviceId
     */
    getLogInfo() {
        return `${this.ip ?? ''} (${this.deviceId})`.trim();
    }

    /**
     * Check isonline
     */
    isOnline() {
        return this.adapter.isOnline(this.deviceId);
    }
    /**
     * destroy
     */
    destroy() {
        this.adapter.log.debug(`Destroying ${this.getLogInfo()}`);
        this.adapter.deviceStatusUpdate(this.deviceId, false); // Device offline

        if (this.httpIoStateTimeout) {
            clearTimeout(this.httpIoStateTimeout);
        }

        this.deviceId = null;
        this.ip = null;
        this.uuid = null;
        this.device = {};
        this.http = {};
        this.httpData = {};
        this.stateValueCache = {};
        this.httpIoStateTimeout = null;
    }
}

module.exports = {
    Base,
};
