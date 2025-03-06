'use strict';

const Approval = require(__dirname+'/../../../db/approval.js')
	, { Permissions } = require(__dirname+'/../../../lib/permission/permissions.js');

module.exports = async (req, res, next) => {
	let pending;
	try {
		pending = await Approval.getPending(res.locals.permissions);
	} catch (err) {
		return next(err);
	}

	res.set('Cache-Control', 'private, max-age=5');

	res.render('manageapproval', {
			csrf: req.csrfToken(),
			permissions: res.locals.permissions,
            noboard: res.locals.noboard ? true : false,
			viewRawIp: res.locals.permissions.get(Permissions.VIEW_RAW_IP),
			pending,
	});
};