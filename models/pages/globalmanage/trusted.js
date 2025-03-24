'use strict';

const Mongo = require(__dirname+'/../../../db/db.js')
	, roleManager = require(__dirname+'/../../../lib/permission/rolemanager.js')
	, pageQueryConverter = require(__dirname+'/../../../lib/input/pagequeryconverter.js')
	, { Accounts } = require(__dirname+'/../../../db/')
	, limit = 20;

module.exports = async (req, res, next) => {
	const { page, offset, queryString } = pageQueryConverter(req.query, limit);

	let filter = {};
	const username = (typeof req.query.username === 'string' ? req.query.username : null);
	if (username) {
		filter['_id'] = username;
	}
	
	filter['permissions'] = Mongo.Binary(roleManager.roles.TRUSTED.array);

	let trusted, maxPage;
	try {
		[trusted, maxPage] = await Promise.all([
			Accounts.find(filter, offset, limit),
			Accounts.count(filter),
		]);
		maxPage = Math.ceil(maxPage/limit);
	} catch (err) {
		return next(err);
	}

	res
//	.set('Cache-Control', 'private, max-age=1')
		.render('globalmanagetrusted', {
			csrf: req.csrfToken(),
			trusted,
			username,
			page,
			maxPage,
		});

};