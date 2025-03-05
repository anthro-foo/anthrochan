'use strict';

const Mongo = require(__dirname+'/db.js')
	, { Permissions } = require(__dirname+'/../lib/permission/permissions.js')
	, approvalTypes = require(__dirname+'/../lib/approval/approvaltypes.js')
	, db = Mongo.db.collection('approval');

module.exports = {

	db,

	getPending: async (permissions) => {
		const projection = {};
		if (!permissions.get(Permissions.VIEW_RAW_IP)) {
			projection['ip.raw'] = 0;
		}
		const posts = await db.find({'approved': approvalTypes.PENDING}, { projection }).toArray();
		return posts;
	},

	insertOne: async (data) => {
		const filter = {
			'_id': data.hash,
		};

		const update = {
			'$setOnInsert': data,
		};

		const options = {
			upsert: true,
		};

		await db.updateOne(
			filter,
			update,
			options,
		);
	},

	deleteAll: () => {
		return db.deleteMany({});
	}

};