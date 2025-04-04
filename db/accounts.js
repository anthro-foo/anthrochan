'use strict';

const Mongo = require(__dirname+'/db.js')
	, db = Mongo.db.collection('accounts')
	, bcrypt = require('bcrypt')
	, cache = require(__dirname+'/../lib/redis/redis.js')
	, { MONTH } = require(__dirname+'/../lib/converter/timeutils.js')
	, { Permissions } = require(__dirname+'/../lib/permission/permissions.js');

module.exports = {

	db,

	countUsers: (usernames) => {
		return db.countDocuments({
			'_id': {
				'$in': usernames
			}
		});
	},

	count: (filter) => {
		if (filter) {
			return db.countDocuments(filter);
		} else {
			return db.estimatedDocumentCount();
		}
	},

	findOne: async (username) => {
		const account = await db.findOne({ '_id': username });
		//hmmm
		if (account != null) {
			account.permissions = account.permissions.toString('base64');
		}
		return account;
	},

	insertOne: async (original, username, password, permissions, web3=false) => {
		// hash the password
		let passwordHash;
		if (password) {
			passwordHash = await bcrypt.hash(password, 12);
		}
		//add to db
		const res = await db.insertOne({
			'_id': username,
			original,
			passwordHash,
			'permissions': Mongo.Binary(permissions.array),
			'twofactor': null,
			web3,
		});
		cache.del(`users:${username}`);
		return res;
	},

	changePassword: async (username, newPassword) => {
		const passwordHash = await bcrypt.hash(newPassword, 12);
		const res = await db.updateOne({
			'_id': username
		}, {
			'$set': {
				'passwordHash': passwordHash
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	setAccountPermissions: async (username, permissions) => {
		const res = await db.updateOne({
			'_id': username
		}, {
			'$set': {
				'permissions': Mongo.Binary(permissions.array),
			}
		});
		cache.del(`users:${username}`);
		return res;
	},
	
	setAccountPermissionsMany: async (usernames, permissionsToSet, originalPermissions=null) => {
		const filter = {
			_id: { $in: usernames }
		};
		if (originalPermissions) {
			filter.permissions = Mongo.Binary(originalPermissions.array);
		}
		const res = await db.updateMany(
			filter,
			{ $set: { permissions: Mongo.Binary(permissionsToSet.array)}}
		);
		if (usernames && usernames.length > 0) {
			for (let i = 0, len = usernames.length; i < len; i++) {
				const username = usernames[i];
				cache.del(`users:${username}`);
			}
		}
		return res;
	},

	setNewRolePermissions: async (oldPermissions, permissions) => {
		const res = await db.updateMany({
			'permissions': Mongo.Binary(oldPermissions.array),
		}, {
			'$set': {
				'permissions': Mongo.Binary(permissions.array),
			}
		});
		cache.deletePattern('users:*');
		return res;
	},

	updateLastActiveDate: (username) => {
		return db.updateOne({
			'_id': username
		}, {
			'$set': {
				lastActiveDate: new Date()
			}
		});
	},

	updateTwofactor: (username, secret) => {
		return db.updateOne({
			'_id': username
		}, {
			'$set': {
				'twofactor': secret
			}
		});
	},

	getInactive: (duration=(MONTH*3)) => {
		return db.find({
			'permissions': {
				'$not': {
					//exempts ROOT users from being returned
					'$bitsAllSet': [Permissions.ROOT],
				},
			},
			'lastActiveDate': {
				'$lt': new Date(Date.now() - duration),
			},
		}).toArray();
	},

	find: (filter, skip=0, limit=0) => {
		return db.find(filter, {
			'projection': {
				'passwordHash': 0
			}
		}).skip(skip).limit(limit).toArray();
	},

	deleteOne: async (username) => {
		const res = await db.deleteOne({
			'_id': username
		});
		cache.del(`users:${username}`);
		return res;
	},

	deleteMany: async (usernames) => {
		const res = await db.deleteMany({
			'_id': {
				'$in': usernames
			}
		});
		cache.del(usernames.map(n => `users:${n}`));
		return res;
	},

	deleteAll: () => {
		return db.deleteMany({});
	},

};
