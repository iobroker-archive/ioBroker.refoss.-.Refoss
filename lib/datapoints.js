'use strict';

const refossdefaults = require('./devices/default').refossdefaults;
const refossem06 = require('./devices/refossem06').refossem06;

const devices = {
    refossem06,
};

const deviceTypes = ['em06', 'em06p'];

/**
 *
 * @returns all devices
 */
function getDeviceByClass() {
    return { ...devices.refossem06, ...refossdefaults };
}

/**
 *
 * @param deviceClass device name
 * @returns Determine whether the model is supported based on the device name
 */
function getDeviceTypeByClass(deviceClass) {
    return deviceTypes.includes(deviceClass);
}

module.exports = {
    getDeviceByClass,
    getDeviceTypeByClass,
};
