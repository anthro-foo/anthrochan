'use strict';

const CustomPages = require(__dirname + '/../../../db/custompages.js');

module.exports = async (req, res, next) => {

	let customPages;
	try {
		customPages = await CustomPages.find();
	} catch (err) {
		return next(err);
	}

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('globalmanagecustompages', {
			csrf: req.csrfToken(),
			customPages,
		});

};
