'use strict';

const { buildCustomPages } = require(__dirname+'/../../lib/build/tasks.js')
	, { CustomPages } = require(__dirname+'/../../db/index.js');

module.exports = async (req, res, next) => {

	let html, json;
	try {
		const custompages = await CustomPages.find();
		({ html, json } = await buildCustomPages({'custompages': custompages}));
	} catch (err) {
		return next(err);
	}

	if (req.path.endsWith('.json')) {
		return res.set('Cache-Control', 'public, max-age=60').json(json);
	} else {
		return res.set('Cache-Control', 'public, max-age=60').send(html);
	}

}