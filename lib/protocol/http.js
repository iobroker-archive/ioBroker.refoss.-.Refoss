'use strict';

const axios = require('axios').default;
const refossUtils = require('../refoss-utils');

/**
 *
 * @param adapter adapter
 * @param httpInfo http information
 * @returns Promise object
 */
function createHttp(adapter, httpInfo) {
    return new Promise(resolve => {
        try {
            let data = {
                header: {
                    from: `/iob/${refossUtils.getRandomString(16)}/sub`,
                    messageId: refossUtils.getRandomString(32),
                    method: 'GET',
                    namespace: httpInfo.http_namespace,
                    payloadVersion: 1,
                    sign: refossUtils.getRandomString(32),
                    timestamp: refossUtils.getTimestampNow(),
                    triggerSrc: 'ioBroker',
                    uuid: httpInfo.http_uuid,
                },
                payload: httpInfo.http_payload,
            };
            axios
                .post(`http://${httpInfo.http_ip}/config`, data, { timeout: 15000 })
                .then(res => {
                    if (res && res.data && res.data.payload) {
                        adapter.log.debug(`[createHttp] Request success for ${httpInfo.http_ip}, namespace: ${httpInfo.http_namespace}`);
                        resolve(res.data.payload);
                        return res.data.payload;
                    } else {
                        adapter.log.warn(`[createHttp] Invalid response structure for ${httpInfo.http_ip}, namespace: ${httpInfo.http_namespace}`);
                        resolve(null);
                    }
                })
                .catch(error => {
                    if (error.code === 'ECONNABORTED') {
                        adapter.log.error(`[createHttp] Request timed out for ${httpInfo.http_ip}, namespace: ${httpInfo.http_namespace}`);
                    } else {
                        adapter.log.error(`[createHttp] Axios Error for ${httpInfo.http_ip}, namespace: ${httpInfo.http_namespace}: ${error.message || error}`);
                    }
                    // 确保Promise总是resolve，返回null表示请求失败
                    resolve(null);
                });
        } catch (error) {
            adapter.log.error(`[createHttp] Error for ${httpInfo.http_ip}: ${error.message || error}`);
            // 确保Promise总是resolve，返回null表示请求失败
            resolve(null);
        }
    });
}

module.exports = { createHttp };
