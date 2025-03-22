'use strict';

const { createHash, } = require('crypto')
	, ipTypes = require(__dirname+'/../middleware/ip/iptypes.js')
	, { createCIDR } = require('ip6addr');

module.exports = (salt, ip) => {
	let hrange;
	if (ip.type === ipTypes.IPV4) {
		hrange = createCIDR(ip.raw, 16).toString();
	} else {
		hrange = createCIDR(ip.raw, 48).toString();
	}
	
	const fullUserIdHash = createHash('sha256').update(salt + hrange).digest('hex');
	return fullUserIdHash.substring(fullUserIdHash.length-6);
};
