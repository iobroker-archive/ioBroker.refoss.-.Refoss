'use strict';

const icons = {
    wifi: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NDAgNTEyIj48IS0tISBGb250IEF3ZXNvbWUgUHJvIDYuMi4wIGJ5IEBmb250YXdlc29tZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tIExpY2Vuc2UgLSBodHRwczovL2ZvbnRhd2Vzb21lLmNvbS9saWNlbnNlIChDb21tZXJjaWFsIExpY2Vuc2UpIENvcHlyaWdodCAyMDIyIEZvbnRpY29ucywgSW5jLiAtLT48cGF0aCBkPSJNNTQuMiAyMDIuOUMxMjMuMiAxMzYuNyAyMTYuOCA5NiAzMjAgOTZzMTk2LjggNDAuNyAyNjUuOCAxMDYuOWMxMi44IDEyLjIgMzMgMTEuOCA0NS4yLS45czExLjgtMzMtLjktNDUuMkM1NDkuNyA3OS41IDQ0MC40IDMyIDMyMCAzMlM5MC4zIDc5LjUgOS44IDE1Ni43Qy0yLjkgMTY5LTMuMyAxODkuMiA4LjkgMjAyczMyLjUgMTMuMiA0NS4yIC45ek0zMjAgMjU2YzU2LjggMCAxMDguNiAyMS4xIDE0OC4yIDU2YzEzLjMgMTEuNyAzMy41IDEwLjQgNDUuMi0yLjhzMTAuNC0zMy41LTIuOC00NS4yQzQ1OS44IDIxOS4yIDM5MyAxOTIgMzIwIDE5MnMtMTM5LjggMjcuMi0xOTAuNSA3MmMtMTMuMyAxMS43LTE0LjUgMzEuOS0yLjggNDUuMnMzMS45IDE0LjUgNDUuMiAyLjhjMzkuNS0zNC45IDkxLjMtNTYgMTQ4LjItNTZ6bTY0IDE2MGMwLTM1LjMtMjguNy02NC02NC02NHMtNjQgMjguNy02NCA2NHMyOC43IDY0IDY0IDY0czY0LTI4LjcgNjQtNjR6Ii8+PC9zdmc+',
};

/**
 *
 * @param key icon key
 * @returns icon base64
 */
function getIcon(key) {
    return icons?.[key] ? `data:image/svg+xml;base64,${icons[key]}` : '';
}

/**
 * Millivolt to volt / Milliampere to ampere / Milliwatt to watt
 *
 * @param  electricity electricity
 */
function getNumFormate(electricity) {
    return Math.round(electricity / 1000 * 100) / 100;
}
/**
 * Generate a random 16/32 byte string
 *
 * @param  len string length
 */
function getRandomString(len) {
    len = len || 32;
    var $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var maxPos = $chars.length;
    var rand = '';
    for (let i = 0; i < len; i++) {
        rand += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return rand;
}

/**
 * Get the current timestamp
 */
function getTimestampNow() {
    return Math.round(new Date().getTime() / 1000).toString();
}

module.exports = {
    getIcon,
    getNumFormate,
    getRandomString,
    getTimestampNow,
};
