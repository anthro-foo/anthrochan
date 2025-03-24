'use strict';

const { Accounts } = require(__dirname+'/../../../db/')
	, config = require(__dirname+'/../../../lib/misc/config.js')
	, roleManager = require(__dirname+'/../../../lib/permission/rolemanager.js')
	, pageQueryConverter = require(__dirname+'/../../../lib/input/pagequeryconverter.js')
	, limit = 20;

module.exports = async (req, res, next) => {

	const { forceActionTwofactor } = config.get;
	const { page, offset, queryString } = pageQueryConverter(req.query, limit);

	let filter = {};
	const username = (typeof req.query.username === 'string' ? req.query.username : null);
	if (username) {
		filter['_id'] = username;
	}

	let accounts, maxPage;
	try {
		[accounts, maxPage] = await Promise.all([
			Accounts.find(filter, offset, limit),
			Accounts.count(filter),
		]);
		maxPage = Math.ceil(maxPage/limit);
	} catch (err) {
		return next(err);
	}

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('globalmanageaccounts', {
			csrf: req.csrfToken(),
			permissions: res.locals.permissions,
			user: res.locals.user,
			queryString,
			username,
			accounts,
			page,
			maxPage,
			rolePermissionMap: roleManager.rolePermissionMap,
			roleNameMap: roleManager.roleNameMap,
			forceActionTwofactor,
		});

};
