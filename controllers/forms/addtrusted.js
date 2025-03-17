'use strict';

const addTrusted = require(__dirname+'/../../models/forms/addtrusted.js')
	, roleManager = require(__dirname+'/../../lib/permission/rolemanager.js')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, { Accounts } = require(__dirname+'/../../db/')
	, paramConverter = require(__dirname+'/../../lib/middleware/input/paramconverter.js')
	, { checkSchema, lengthBody, existsBody } = require(__dirname+'/../../lib/input/schema.js');

module.exports = {
	paramConverter: paramConverter({
		trimFields: ['username'],
	}),

	controller: async (req, res, next) => {

		const { __ } = res.locals;
		
		const errors = await checkSchema([
			{ result: existsBody(req.body.username), expected: true, blocking: true, error: __('Missing username') },
			{ result: lengthBody(req.body.username, 0, 50), expected: false, blocking: true, error: __('Username must be 50 characters or less') },
			{ result: async () => {
				const numAccounts = await Accounts.countUsers([req.body.username]);
				return numAccounts > 0;
			}, expected: true, blocking: true, error: __('User does not exist') },
			{ result: async () => {
				res.locals.trustedAccount = await Accounts.findOne(req.body.username);
				return res.locals.trustedAccount.permissions === roleManager.roles.ANON.base64;
			}, expected: true, blocking: true, error: __('User must be an untrusted account')}
		]);

		if (errors.length > 0) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'errors': errors,
				'redirect': '/globalmanage/trusted.html',
			});
		}
		
		try {
			await addTrusted(req, res, next);
		} catch (error) {
			return next(error);
		}
	},

};
