'use strict';

const { Posts, Boards } = require(__dirname+'/../../db/')
	, config = require(__dirname+'/../../lib/misc/config.js')
	, { Permissions } = require(__dirname+'/../../lib/permission/permissions.js');

module.exports = async (req, res, next) => {

	const { forceActionTwofactor } = config.get;
	let globalReportCount = 0; //number of open global reports
	let globalApprovalCount = 0; // number of files pending approval
	let boards; //map of board perms

	try {
		([boards, globalReportCount, globalApprovalCount] = await Promise.all([
			Boards.getAll(),
			res.locals.permissions.get(Permissions.MANAGE_GENERAL) ? Posts.getGlobalReportsCount() : 0,
			res.locals.permissions.get(Permissions.MANAGE_FILE_APPROVAL) ? Posts.getFilesPendingCount() : 0,
		]));
	} catch (err) {
		return next(err);
	}

	res
		.set('Cache-Control', 'private, max-age=1')
		.render('account', {
			csrf: req.csrfToken(),
			user: res.locals.user,
			permissions: res.locals.permissions,
			boards: boards.map(board => board._id),
			globalReportCount,
			globalApprovalCount,
			forceActionTwofactor,
		});

};
