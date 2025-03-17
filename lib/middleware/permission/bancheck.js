'use strict';

const { Bans } = require(__dirname+'/../../../db/')
	, dynamicResponse = require(__dirname+'/../../misc/dynamic.js')
	, { Permissions } = require(__dirname+'/../../permission/permissions.js')
	, findBans = require(__dirname+'/../../misc/findbans.js');

module.exports = async (req, res, next) => {

	//bypass all bans, special permission
	if (res.locals.permissions.get(Permissions.BYPASS_BANS)) {
		return next();
	}

	const bans = await findBans(req, res, next);
	if (bans && bans.length > 0) {
		const unseenBans = bans.filter(b => !b.seen).map(b => b._id);
		await Bans.markSeen(unseenBans); //mark bans as seen
		bans.forEach(ban => {
			ban.note = null;
			ban.ip.raw = null;
			ban.issuer = ban.showUser === true ? ban.issuer : null;
			ban.seen = true;
		});
		return dynamicResponse(req, res, 403, 'ban', {
			bans,
		});
	}

	next(); //no bans found

};
