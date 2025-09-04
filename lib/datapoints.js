'use strict';

const refossdefaults = require('./devices/default').refossdefaults;
const refossem06 = require('./devices/refossem06').refossem06;
const refossem16p = require('./devices/refossem16p').refossem16p;

const devices = {
    refossem06,
    refossem16p,
};

const deviceTypes = ['em06', 'em06p', 'em16p'];

/**
 *
 * @param devName device name
 * @returns all devices
 */
function getDeviceByClass(devName) {
    if (devName === 'em16p') {
        return { ...devices.refossem16p, ...refossdefaults };
    }
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
