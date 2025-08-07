'use strict';

const refossUtils = require('../refoss-utils');

const refossdefaults = {
    hostname: {
        http: {
            init_funct: self => self.getIP(),
        },
        common: {
            name: {
                en: 'Device IP address or hostname',
                de: 'Geräte-IP-Adresse oder Hostname',
                ru: 'IP-адрес устройства или имя хоста',
                pt: 'Endereço IP do dispositivo ou nome de host',
                nl: 'IP-adres of gastnaam',
                fr: "Adresse IP ou nom d'hôte",
                it: 'Indirizzo IP del dispositivo o nome host',
                es: 'Dirección IP o nombre de host',
                pl: 'Adres IP lub hostname',
                uk: "Пристрої IP адреси або ім'я користувача",
                'zh-cn': '設備 IP 地址或主機名',
            },
            type: 'string',
            role: 'info.ip',
            read: true,
            write: false,
        },
    },
    online: {
        http: {
            init_funct: self => self.isOnline(),
        },
        common: {
            name: {
                en: 'Device online',
                de: 'Gerät online',
                ru: 'Устройство онлайн',
                pt: 'Dispositivo online',
                nl: 'Device online',
                fr: 'Appareil en ligne',
                it: 'Dispositivo online',
                es: 'Dispositivo en línea',
                pl: 'Device online',
                uk: 'Пристрої онлайн',
                'zh-cn': '设备在线',
            },
            type: 'boolean',
            role: 'indicator.reachable',
            read: true,
            write: false,
            icon: refossUtils.getIcon('wifi'),
        },
    },
};

module.exports = {
    refossdefaults,
};
