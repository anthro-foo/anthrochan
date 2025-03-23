'use strict';

const { Permissions } = require(__dirname+'/permissions.js')
	, Permission = require(__dirname+'/permission.js')
	, roleManager = require(__dirname+'/rolemanager.js');

module.exports = (req, res) => {

	let calculatedPermissions;

	if (req.session && res.locals && res.locals.user) {

		//has a session and user, not anon, so their permissions from the db/user instead.
		const { user } = res.locals;
		
		calculatedPermissions = new Permission(user.permissions);

		//give ROOT all permission, MANAGE_BANS perms for VIEW_BOARD_GLOBAL_BANS, etc
		calculatedPermissions.applyInheritance();

	} else {
		//not logged in, gets default anon permission
		calculatedPermissions = new Permission(roleManager.roles.ANON.base64);
	}

	return calculatedPermissions;

};
