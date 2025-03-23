'use strict';

const { Permissions } = require(__dirname+'/../lib/permission/permissions.js')
	, Permission = require(__dirname+'/../lib/permission/permission.js')
	, { Binary } = require('mongodb');

module.exports = async(db, redis) => {

	console.log('Creating new roles');
	const ANON = new Permission();
	ANON.setAll([
		Permissions.CREATE_ACCOUNT,
		Permissions.USE_MARKDOWN_GENERAL,
	]);

	const TRUSTED_USER = new Permission(ANON.base64);
	TRUSTED_USER.setAll([
		Permissions.BYPASS_CAPTCHA,
		Permissions.BYPASS_FILTERS,
		Permissions.BYPASS_FILE_APPROVAL,
	]);

	const APPROVER = new Permission(TRUSTED_USER.base64);
	APPROVER.setAll([
		Permissions.VIEW_MANAGE,

		Permissions.BYPASS_BANS,

		Permissions.MANAGE_FILE_APPROVAL,		
	]);
	
	const MOD = new Permission(APPROVER.base64);
	MOD.setAll([
		Permissions.MANAGE_GENERAL,
		Permissions.MANAGE_BANS,
		Permissions.MANAGE_LOGS,
		Permissions.MANAGE_TRUSTED,
	]);

	const ROOT = new Permission();
	ROOT.setAll(Permission.allPermissions);

	console.log('Clearing existing roles');
	await db.collection('roles').deleteMany({});

	console.log('Adding Anon, Trusted User, Approver, Mod, Root roles');
	await db.collection('roles').insertMany([
		{ name: 'ANON', permissions: Binary(ANON.array) },
		{ name: 'TRUSTED_USER', permissions: Binary(TRUSTED_USER.array) },
		{ name: 'APPROVER', permissions: Binary(APPROVER.array) },
		{ name: 'MOD', permissions: Binary(MOD.array) },
		{ name: 'ROOT', permissions: Binary(ROOT.array) },
	]);
	
	console.log('Updating previous accounts to new roles');
	console.log('Updating anon');
	await db.collection('accounts').updateMany(
		{ permissions: Binary(Buffer.from('CAAAQAAAIAA=', 'base64'), 0)},
		{ $set: 
			{
				permissions: Binary(ANON.array)
			}
		}
	);
	console.log('Updating trusted user');
	await db.collection('accounts').updateMany(
		{ permissions: Binary(Buffer.from('CuAAQAAAIAA=', 'base64'), 0)},
		{ $set: 
			{
				permissions: Binary(TRUSTED_USER.array)
			}
		}
	);
	console.log('Updating mod user');
	await db.collection('accounts').updateMany(
		{ permissions: Binary(Buffer.from('LecTWcCAIAA=', 'base64'), 0)},
		{ $set: 
			{
				permissions: Binary(MOD.array)
			}
		}
	);
	console.log('Updating root user');
	await db.collection('accounts').updateMany(
		{ permissions: Binary(Buffer.from('////8/yAMAA=', 'base64'), 0)},
		{ $set: 
			{
				permissions: Binary(ROOT.array)
			}
		}
	);
	
	console.log('Removing board staff');
	await db.collection('boards').updateMany({}, { $unset: { staff: '', owner: '' } });
	await db.collection('accounts').updateMany({}, { $unset: { ownedBoards: '', staffBoards: '' } });
	
	console.log('Clearing all cache');
	await redis.deletePattern('*');
};