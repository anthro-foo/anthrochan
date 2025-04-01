function detectIncognito() {
	return new Promise(function (resolve, reject) {
		let browserName = 'Unknown';

		function __callback(isPrivate) {
			resolve({
				isPrivate,
				browserName
			});
		}

		function identifyChromium() {
			const ua = navigator.userAgent;
			if (ua.match(/Chrome/)) {
				if (navigator.brave !== undefined) {
					return 'Brave';
				} else if (ua.match(/Edg/)) {
					return 'Edge';
				} else if (ua.match(/OPR/)) {
					return 'Opera';
				}
				return 'Chrome';
			} else {
				return 'Chromium';
			}
		}

		function assertEvalToString(value) {
			return value === eval.toString().length;
		}

		function feid() {
			let toFixedEngineID = 0;
			let neg = parseInt('-1');
			try {
				neg.toFixed(neg);
			} catch (e) {
				toFixedEngineID = e.message.length;
			}
			return toFixedEngineID;
		}

		function isSafari() {
			return feid() === 44;
		}

		function isChrome() {
			return feid() === 51;
		}

		function isFirefox() {
			return feid() === 25;
		}

		function isMSIE() {
			return (
				window.msSaveBlob !== undefined && assertEvalToString(39)
			);
		}

		// Safari
		function newSafariTest() {
			const tmp_name = String(Math.random());
			try {
				const db = window.indexedDB.open(tmp_name, 1);
				db.onupgradeneeded = function (i) {
					const res = i.target?.result;
					try {
						res.createObjectStore('test', {
							autoIncrement: true
						}).put(new Blob());
						__callback(false);
					} catch (e) {
						let message = e;
						if (e instanceof Error) {
							message = e.message ?? e;
						}
						if (typeof message !== 'string') {
							__callback(false); return;
						}
						const matchesExpectedError = message.includes('BlobURLs are not yet supported');
						__callback(matchesExpectedError); return;
					} finally {
						res.close();
						window.indexedDB.deleteDatabase(tmp_name);
					}
				};
			} catch (e) {
				__callback(false);
			}
		}

		function oldSafariTest() {
			const openDB = window.openDatabase;
			const storage = window.localStorage;
			try {
				openDB(null, null, null, null);
			} catch (e) {
				__callback(true); return;
			}
			try {
				storage.setItem('test', '1');
				storage.removeItem('test');
			} catch (e) {
				__callback(true); return;
			}
			__callback(false);
		}

		function safariPrivateTest() {
			if (navigator.maxTouchPoints !== undefined) {
				newSafariTest();
			} else {
				oldSafariTest();
			}
		}

		// Chrome
		function getQuotaLimit() {
			if (
				performance !== undefined &&
				performance.memory !== undefined &&
				performance.memory.jsHeapSizeLimit !== undefined
			) {
				return performance.memory.jsHeapSizeLimit;
			}
			return 1073741824;
		}

		function storageQuotaChromePrivateTest() {
			navigator.webkitTemporaryStorage.queryUsageAndQuota(
				function (_usedBytes, quota) {
					const quotaInMib = Math.round(quota / (1024 * 1024));
					const quotaLimitInMib = Math.round(getQuotaLimit() / (1024 * 1024)) * 2;
					__callback(quotaInMib < quotaLimitInMib);
				},
				function (e) {
					reject(
						new Error(
							'detectIncognito somehow failed to query storage quota: ' +
							e.message
						)
					);
				}
			);
		}

		function oldChromePrivateTest() {
			const fs = window.webkitRequestFileSystem;
			const success = function () {
				__callback(false);
			};
			const error = function () {
				__callback(true);
			};
			fs(0, 1, success, error);
		}

		function chromePrivateTest() {
			if (self.Promise !== undefined && Promise.allSettled !== undefined) {
				storageQuotaChromePrivateTest();
			} else {
				oldChromePrivateTest();
			}
		}

		// Firefox
		function firefoxPrivateTest() {
			__callback(navigator.serviceWorker === undefined);
		}

		// MSIE
		function msiePrivateTest() {
			__callback(window.indexedDB === undefined);
		}

		function main() {
			if (isSafari()) {
				browserName = 'Safari';
				safariPrivateTest();
			} else if (isChrome()) {
				browserName = identifyChromium();
				chromePrivateTest();
			} else if (isFirefox()) {
				browserName = 'Firefox';
				firefoxPrivateTest();
			} else if (isMSIE()) {
				browserName = 'Internet Explorer';
				msiePrivateTest();
			} else {
				reject(new Error('detectIncognito cannot determine the browser'));
			}
		}

		main();
	});
}

// Attach to window
if (typeof window !== 'undefined') {
	window.detectIncognito = detectIncognito;
}