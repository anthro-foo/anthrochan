'use strict';

const manageApproval = require(__dirname+'/../manage/approval.js');

module.exports = async (req, res, next) => {
	res.locals.noboard = true;
	try {
		await manageApproval(req, res, next);	
	} catch (err) {
		return next(err);
	}
};

