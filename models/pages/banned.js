'use strict';

const findBans = require(__dirname+'/../../lib/misc/findbans.js');

module.exports = async (req, res, next) => {

	let bans;
	try {
		bans = await findBans(req, res, next);
	} catch (err) {
		return next(err);
	}

	res.set('Cache-Control', 'private, max-age=60');
	res.render('ban', {
		bans
	});
};