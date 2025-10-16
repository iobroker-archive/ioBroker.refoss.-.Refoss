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
        this.mergeChannelData = {}; // 存储合并通道数据
        this.mergeChannelList = []; // 存储合并通道列表
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
                const deviceStates = datapoints.getDeviceByClass(this.deveiceInfo.devName);
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
                this.objectHelper.processObjectQueue(async () => {
                    this.http = deviceStatesHttp;
                    this.device = deviceStates;
                    // this.adapter.log.debug(`[createObjects] Finished object creation of ${this.getLogInfo()}`);
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
            this.httpIoStateTimeout = setTimeout(async () => await this.httpState(), 15000);
            return;
        }
        
        // 首先处理合并通道HTTP请求（不创建数据点）
        await this.processChannelMergeRequest();
        
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
                
                // 处理单通道数据
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
     * *仅用于em06的电量处理（因固件不支持mConsumeX）
     * @param channel channel
     * @param type Electricity type
     * @returns value
     */
    getEm06Electricity(channel, type) {
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
                } else if (type !== 'factor') {
                    value = refossUtils.getNumFormate(this.httpData[i][type]);
                } else {
                    value = this.httpData[i][type];
                }
                return value;
            }
        }
    }
    /**
     * *em06P / em16P 处理电量小数点
     * @param channel channel
     * @param type Electricity type
     * @returns value
     */
    getElectricity(channel, type) {
        for (const i in this.httpData) {
            if (parseInt(i) + 1 == channel) {
                let value;
                if (type !== 'factor') {
                    // *转换单位（除factor外）
                    value = refossUtils.getNumFormate(this.httpData[i][type]);
                } else {
                    value = this.httpData[i][type];
                }
                return value;
            }
        }
    }
    /**
     * 获取电量数据点配置
     * @returns keysArr 电量数据点配置数组
     */
    getElectricityKeysArr() {
        // 从refossem06p.js导入keysArr，避免重复定义
        const refossem06p = require('../devices/refossem06p');
        return refossem06p.keysArr;
    }
    
    /**
     * 获取合并通道电量数据点配置（不包含voltage和power factor）
     * @returns mergedKeysArr 合并通道电量数据点配置数组
     */
    getMergedElectricityKeysArr() {
        // 从refossem06p.js导入mergedKeysArr，避免重复定义
        const refossem06p = require('../devices/refossem06p');
        return refossem06p.mergedKeysArr;
    }
    
    /**
     * 处理合并通道HTTP请求（不创建数据点）
     */
    async processChannelMergeRequest() {
        try {
            const httpInfo = {
                http_uuid: this.uuid,
                http_ip: this.ip,
                http_namespace: 'Appliance.Control.ChannelMerge',
                http_payload: {
                    control: [
                        {
                            channels: []
                        },
                    ],
                },
            };

            const httpAck = await refossHttp.createHttp(this.adapter, httpInfo);
            
            // 获取合并通道数据
            const mergeChannelData = httpAck['control'] || [];
            
            // 检查是否有合并通道数据
            if (mergeChannelData && mergeChannelData.length > 0) {
                // 存储合并通道列表
                this.mergeChannelList = mergeChannelData;
                // 存储合并通道数据
                this.mergeChannelData = mergeChannelData;
                
                // 动态创建合并通道数据点
                await this.createDynamicMergeChannelDataPoints();
                
                // 更新合并通道数据点值
                await this.updateDynamicMergeChannelDataPoints();
            } else {
                this.adapter.log.info(`[processChannelMergeRequest] No merge channels found`);
            }
        } catch (error) {
            this.adapter.log.error(`[processChannelMergeRequest] Error: ${error}`);
        }
    }
    
    /**
     * 动态创建合并通道数据点
     */
    async createDynamicMergeChannelDataPoints() {
        if (!this.mergeChannelList || this.mergeChannelList.length === 0) {
            return;
        }
        
        // 获取合并通道电量数据点配置（不包含voltage和power factor）
        const mergedKeysArr = this.getMergedElectricityKeysArr();
        
        // 为每个合并通道创建数据点
        for (const mergeChannel of this.mergeChannelList) {
            const mergeName = mergeChannel.mergeName;
            if (!mergeName) {
                this.adapter.log.warn(`[createDynamicMergeChannelDataPoints] Merge channel without name: ${JSON.stringify(mergeChannel)}`);
                continue;
            }
            
            // 清理可能存在的旧的Total-{mergeName}对象数据点
            const oldObjectStateId = `Total-${mergeName}`;
            const fullOldObjectStateId = `${this.deviceId}.${oldObjectStateId}`;
            const existingOldObject = await this.adapter.getObjectAsync(fullOldObjectStateId);
            if (existingOldObject) {
                await this.adapter.delObjectAsync(fullOldObjectStateId);
                this.adapter.log.info(`[createDynamicMergeChannelDataPoints] Cleaned up old merge channel object: ${fullOldObjectStateId}`);
            }
            
            // 为每个合并通道创建独立的属性数据点（不包含voltage和power factor）
            for (const item of mergedKeysArr) {
                const stateId = `Total-${mergeName}.${item.emKey}`;
                const fullStateId = `${this.deviceId}.${stateId}`;
                
                // 检查数据点是否已存在
                const existingObject = await this.adapter.getObjectAsync(fullStateId);
                if (!existingObject) {
                    // 创建新的数据点对象，与单通道结构一致
                    this.objectHelper.setOrUpdateObject(
                        fullStateId,
                        {
                            type: 'state',
                            common: {
                                name: `${mergeName} ${item.name}`,
                                type: 'number',
                                role: `value.${item.apiKey}`,
                                read: true,
                                write: false,
                                def: 0,
                                unit: item.unit || '',
                            },
                        },
                        ['name'],
                        0, // 初始值为0
                    );
                }
            }
        }
        
        // 等待所有对象创建完成
        return new Promise(resolve => {
            this.objectHelper.processObjectQueue(() => {
                resolve(true);
            });
        });
    }
    
    /**
     * 更新动态创建的合并通道数据点
     */
    async updateDynamicMergeChannelDataPoints() {
        if (!this.mergeChannelList || this.mergeChannelList.length === 0) {
            return;
        }
        
        // 获取合并通道电量数据点配置（不包含voltage和power factor）
        const mergedKeysArr = this.getMergedElectricityKeysArr();
        
        // 为每个合并通道更新数据点值
        for (const mergeChannel of this.mergeChannelList) {
            const mergeName = mergeChannel.mergeName;
            if (!mergeName) continue;
            
            // 为每个属性更新独立的数据点
            for (const item of mergedKeysArr) {
                const stateId = `Total-${mergeName}.${item.emKey}`;
                const fullStateId = `${this.deviceId}.${stateId}`;
                
                // 检查对象是否存在，如果不存在则跳过更新
                const existingObject = await this.adapter.getObjectAsync(fullStateId);
                if (!existingObject) {
                    this.adapter.log.warn(`Object ${fullStateId} does not exist, skipping update`);
                    continue;
                }
                
                // 计算该合并通道的特定属性值
                const value = this.getMergeElectricityByChannels(item.apiKey, mergeChannel.channels);
                
                // 更新数据点值
                await this.adapter.setStateAsync(fullStateId, { val: value, ack: true });
            }
        }
    }
    
    /**
     * 根据通道列表计算合并通道的电量数据
     * @param type Electricity type
     * @param channels 通道列表
     * @returns value
     */
    getMergeElectricityByChannels(type, channels) {
        if (!this.httpData || !channels || channels.length === 0) {
            return 0;
        }
        
        let totalValue = 0;
        let hasValidData = false;
        let validChannelCount = 0;
        
        // 遍历指定的通道列表
        for (const channel of channels) {
            // 在httpData中查找对应通道的数据
            for (const i in this.httpData) {
                if (parseInt(i) + 1 === channel) {
                    const channelData = this.httpData[i];
                    if (channelData && channelData[type] !== undefined) {
                        let value;
                        if (type !== 'factor') {
                            // 转换单位（除factor外）
                            value = refossUtils.getNumFormate(channelData[type]);
                            totalValue += value;
                            hasValidData = true;
                        } else {
                            // 对于功率因数，收集所有值用于计算平均值
                            value = channelData[type];
                            if (typeof value === 'number' && !isNaN(value)) {
                                totalValue += value;
                                validChannelCount++;
                                hasValidData = true;
                            }
                        }
                    }
                    break;
                }
            }
        }
        
        // 对于功率因数，返回平均值
        if (type === 'factor' && hasValidData && validChannelCount > 0) {
            return totalValue / validChannelCount;
        }
        
        return hasValidData ? totalValue : 0;
    }
    
    /**
     * 获取合并通道电量数据
     * @param type Electricity type
     * @param mergeName 合并通道名称（可选）
     * @returns value
     */
    getMergeElectricity(type, mergeName = null) {
        if (!this.mergeChannelData || Object.keys(this.mergeChannelData).length === 0) {
            return 0;
        }
        
        let totalValue = 0;
        let hasValidData = false;
        
        // 如果指定了mergeName，只处理该合并通道
        if (mergeName) {
            const mergeChannel = this.mergeChannelList.find(ch => ch.mergeName === mergeName);
            if (mergeChannel && mergeChannel[type] !== undefined) {
                let value;
                if (type !== 'factor') {
                    value = refossUtils.getNumFormate(mergeChannel[type]);
                    return value;
                } else {
                    return mergeChannel[type];
                }
            }
            return 0;
        }
        
        // 遍历所有合并通道数据
        for (const channelId in this.mergeChannelData) {
            const channelData = this.mergeChannelData[channelId];
            if (channelData && channelData[type] !== undefined) {
                let value;
                if (type !== 'factor') {
                    // 转换单位（除factor外）
                    value = refossUtils.getNumFormate(channelData[type]);
                    totalValue += value;
                    hasValidData = true;
                } else {
                    // 对于功率因数，计算平均值
                    value = channelData[type];
                    if (typeof value === 'number' && !isNaN(value)) {
                        totalValue += value;
                        hasValidData = true;
                    }
                }
            }
        }
        
        // 对于功率因数，返回平均值
        if (type === 'factor' && hasValidData) {
            const channelCount = Object.keys(this.mergeChannelData).length;
            return channelCount > 0 ? totalValue / channelCount : 0;
        }
        
        return hasValidData ? totalValue : 0;
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
        this.mergeChannelData = {};
        this.mergeChannelList = [];
        this.httpIoStateTimeout = null;
    }
}

module.exports = {
    Base,
};
