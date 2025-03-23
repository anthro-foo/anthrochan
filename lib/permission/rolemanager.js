'use strict';

const { Roles } = require(__dirname+'/../../db/')
	, redis = require(__dirname+'/../redis/redis.js')
	, Permission = require(__dirname+'/permission.js');

const load = async () => {
	//todo: take a message argument from callback
	//maybe make it a separate func just for reloading single role?

	let roles = await Roles.find();
	roles = roles.reduce((acc, r) => {
		acc[r.name] = new Permission(r.permissions.toString('base64'));
		return acc;
	}, {});

	module.exports.roles = roles;

	module.exports.rolePermissionMap = {
		[roles.ANON.base64]: 'Regular User',
		[roles.TRUSTED_USER.base64]: 'Trusted User',
		[roles.APPROVER.base64]: 'Approver',
		[roles.MOD.base64]: 'Mod',
		[roles.ROOT.base64]: 'Root',
	};

	//Note: kinda redundant, might remove/change how this works
	module.exports.roleNameMap = {
		ANON: 'Regular User',
		TRUSTED_USER: 'Trusted User',
		APPROVER: 'Approver',
		MOD: 'Mod',
		ROOT: 'Root',
	};

};

redis.addCallback('roles', load);

module.exports = {
	roles: {},
	roleNameMap: {},
	rolePermissionMap: {},
	load,
};
