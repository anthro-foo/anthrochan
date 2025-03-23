'use strict';

const Assets = require(__dirname+'/../../db/assets.js');

module.exports = async (req, res, next) => {
	let banner;
	try {
		banner = await Assets.randomBanner();
	} catch (err) {
		return next(err);
	}

	if (!banner) {
		//non existing boards will show default banner, but it doesnt really matter.
		return res.redirect('/file/defaultbanner.png');
	}

	return res.redirect(`/banner/${banner}`);

};
