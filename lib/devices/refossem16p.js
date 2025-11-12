'use strict';

const Channels = Object.freeze({
    A1: 1,
    A2: 2,
    A3: 3,
    A4: 4,
    A5: 5,
    A6: 6,
    B1: 7,
    B2: 8,
    B3: 9,
    B4: 10,
    B5: 11,
    B6: 12,
    C1: 13,
    C2: 14,
    C3: 15,
    C4: 16,
    C5: 17,
    C6: 18,
});

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
        apiKey: 'mConsumeX',
        emKey: 'ThisMonthEnergyReturned',
        name: 'This Month Energy Returned',
        unit: 'kWh',
    },
];

// 合并通道数据点（不包含factor和voltage）
const mergedKeysArr = keysArr.filter(item => item.apiKey !== 'factor' && item.apiKey !== 'voltage');

let refossem16p = function () {
    let res = {};
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
let refossem16pMerged = function () {
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
    refossem16p: refossem16p(),
    refossem16pMerged: refossem16pMerged(),
    keysArr: keysArr,
    mergedKeysArr: mergedKeysArr,
};
