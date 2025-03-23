'use strict';

const { buildBanners } = require(__dirname+'/../../lib/build/tasks.js')
	, { Assets } = require(__dirname+'/../../db/index.js');

module.exports = async (req, res, next) => {

	let html, json;
	try {
		const banners = await Assets.getBanners();
		({ html, json } = await buildBanners({'banners': banners}));
	} catch (err) {
		return next(err);
	}

	if (req.path.endsWith('.json')) {
		return res.set('Cache-Control', 'max-age=0').json(json);
	} else {
		return res.set('Cache-Control', 'max-age=0').send(html);
	}

};
