'use strict';

const { Bans } = require(__dirname+'/../../db/');

module.exports = async (req, res, next) => {
	let bans;
	try {
		const allbans = await Bans.getGlobalBans();
		bans = allbans.slice(0, 30);
	} catch (err) {
		return next(err);
	}

	res.set('Cache-Control', 'public, max-age=30');
	res.render('bans', {
		bans
	});
};