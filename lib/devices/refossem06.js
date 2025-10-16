'use strict';

const Channels = Object.freeze({
    A1: 1,
    A2: 4,
    B1: 2,
    B2: 5,
    C1: 3,
    C2: 6,
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
        apiKey: 'factor', // *没得unit
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

let refossem06 = function () {
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
                    init_funct: self => self.getEm06Electricity(Channels[channel], item.apiKey),
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

module.exports = {
    refossem06: refossem06(),
};
