'use strict';

const Channels = Object.freeze({
    A1: 1,
    A2: 4,
    B1: 2,
    B2: 5,
    C1: 3,
    C2: 6,
});

// 单通道数据点
const keysArr = [
    {
        apiKey: 'current',
        emKey: 'Current',
        name: 'Current',
        unit: 'A',
    },
    {
        apiKey: 'power',
        emKey: 'Power',
        name: 'Power',
        unit: 'W',
    },
    {
        apiKey: 'factor',
        emKey: 'PowerFactor',
        name: 'Power Factor',
    },
    {
        apiKey: 'voltage',
        emKey: 'Voltage',
        name: 'Voltage',
        unit: 'V',
    },
    {
        apiKey: 'today',
        emKey: 'TodayEnergy',
        name: 'Today Energy',
        unit: 'kWh',
    },
    {
        apiKey: 'todayX',
        emKey: 'TodayEnergyReturned',
        name: 'Today Energy Returned',
        unit: 'kWh',
    },
    {
        apiKey: 'week',
        emKey: 'WeekEnergy',
        name: 'Week Energy',
        unit: 'kWh',
    },
    {
        apiKey: 'weekX',
        emKey: 'WeekEnergyReturned',
        name: 'Week Energy Returned',
        unit: 'kWh',
    },
    {
        apiKey: 'mConsume',
        emKey: 'ThisMonthEnergy',
        name: 'This Month Energy',
        unit: 'kWh',
    },
    {
        apiKey: 'mConsumeRe',
        emKey: 'ThisMonthEnergyReturned',
        name: 'This Month Energy Returned',
        unit: 'kWh',
    },
];

// 合并通道数据点（不包含factor和voltage）
const mergedKeysArr = keysArr.filter(item => item.apiKey !== 'factor' && item.apiKey !== 'voltage');


let refossem06p = function () {
    let res = {};
    // 添加单通道数据点
    Object.keys(Channels).forEach(channel => {
        keysArr.forEach(item => {
            res[`${channel}.${item.emKey}`] = {
                http: {
                    http_namespace: 'Appliance.Control.ElectricityX',
                    http_payload: {
                        electricity: [
                            {
                                channel: 0xffff,
                            },
                        ],
                    },
                    http_get_ack: 'electricity',
                    init_funct: self => self.getElectricity(Channels[channel], item.apiKey),
                },
                common: {
                    name: item.name,
                    type: 'number',
                    role: `value.${item.apiKey}`,
                    read: true,
                    write: false,
                    def: 0,
                    unit: item.unit || '',
                },
            };
        });
    });

    return res;
};

// 合并通道数据点（不包含factor和voltage）
let refossem06pMerged = function () {
    let res = {};
    mergedKeysArr.forEach(item => {
        res[`${item.emKey}`] = {
            http: {
                http_namespace: 'Appliance.Control.ElectricityX',
                http_payload: {
                    electricity: [
                        {
                            channel: 0xffff,
                        },
                    ],
                },
                http_get_ack: 'electricity',
                init_funct: self => self.getElectricity(0xffff, item.apiKey),
            },
            common: {
                name: item.name,
                type: 'number',
                role: `value.${item.apiKey}`,
                read: true,
                write: false,
                def: 0,
                unit: item.unit || '',
            },
        };
    });

    return res;
};

module.exports = {
    refossem06p: refossem06p(),
    refossem06pMerged: refossem06pMerged(),
    keysArr: keysArr,
    mergedKeysArr: mergedKeysArr,
};
