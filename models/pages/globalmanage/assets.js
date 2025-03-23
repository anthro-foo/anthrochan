'use strict';

const { Assets } = require(__dirname+'/../../../db/index.js');

module.exports = async (req, res, next) => {
	
	let banners;
	try {
		banners = await Assets.getBanners();
	} catch (err) {
		return next(err);
	}

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('globalmanageassets', {
			csrf: req.csrfToken(),
			banners: banners,
		});

};
