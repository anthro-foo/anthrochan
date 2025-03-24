'use strict';

const { Accounts } = require(__dirname+'/../../db/')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, roleManager = require(__dirname+'/../../lib/permission/rolemanager.js');

module.exports = async (req, res) => {
	const { __,} = res.locals;
	
	const updated = await Accounts.setAccountPermissions(req.body.username, roleManager.roles.TRUSTED).then(r => r.matchedCount);
	
	if (updated === 0) {
		return dynamicResponse(req, res, 400, 'message', {
			'title': __('Bad request'),
			'errors': __('Account does not exist'),
			'redirect': req.headers.referer || '/globalmanage/trusted.html',
		});
	}
	
	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'message': __('Trusted user'),
		'redirect': '/globalmanage/trusted.html',
	});
};
