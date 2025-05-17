'use strict';

const { Assets } = require(__dirname + '/../../../db/index.js');

module.exports = async (req, res, next) => {

	let logos;
	let banners;
	let flags;
	let boardads;
	try {
		logos = await Assets.getLogos();
		banners = await Assets.getBanners();
		flags = await Assets.getFlags();
		boardads = await Assets.getBoardAds();
	} catch (err) {
		return next(err);
	}

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('globalmanageassets', {
			csrf: req.csrfToken(),
			logos: logos,
			banners: banners,
			flags: flags,
			boardads: boardads,
		});

};
