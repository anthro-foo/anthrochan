'use strict';

const { Accounts } = require(__dirname+'/../../db/')
	, roleManager = require(__dirname+'/../../lib/permission/rolemanager.js')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js');

module.exports = async (req, res, next) => {

	const { __ } = res.locals;
	
	const updated = await Accounts.setAccountPermissionsMany(req.body.checkedtrusted, roleManager.roles.ANON, roleManager.roles.TRUSTED).then(r => r.matchedCount);
	
	if (updated === 0) {
		return dynamicResponse(req, res, 400, 'message', {
			'title': __('Bad request'),
			'message': __('Accounts don\'t exist'),
			'redirect': req.headers.referer || '/globalmanage/trusted.html',
		});
	}

	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'message': __('Deleted user'),
		'redirect': '/globalmanage/trusted.html',
	});

};