'use strict';

const approval = require("./approval");

const Mongo = require(__dirname+'/db.js')
	, formatSize = require(__dirname+'/../lib/converter/formatsize.js')
	, approvalTypes = require(__dirname+'/../lib/approval/approvaltypes.js')
	, db = Mongo.db.collection('files');

module.exports = {

	db,

	increment: (file, user_uuid) => {
		return db.updateOne({
			_id: file.filename,
		}, {
			'$inc': {
				'count': 1
			},
			'$addToSet': {//save list of thumb exts incase config is changed to track old exts
				'exts': file.thumbextension,
			},
			'$setOnInsert': {
				'size': file.size,
				user_uuid: user_uuid
			}
		}, {
			'upsert': true
		});
	},

	decrement: (fileNames) => {
		const fileCounts = fileNames
			.reduce((acc, f) => {
				acc[f] = (acc[f] || 0) + 1;
				return acc;
			}, {});
		const commonCounts = Object.entries(fileCounts)
			.reduce((acc, entry) => {
				acc[entry[1]] = (acc[entry[1]] || []).concat(entry[0]);
				return acc;
			}, {});
		const bulkWrites = Object.entries(commonCounts)
			.map(entry => {
				return ({
					'updateMany': {
						'filter': {
							'_id': {
								'$in': entry[1]
							}
						},
						'update': {
							'$inc': {
								'count': -entry[0]
							}
						}
					}
				});
			});
		return db.bulkWrite(bulkWrites);
	},

	activeContent: () => {
		return db.aggregate([
			{
				'$group': {
					'_id': null,
					'count': {
						'$sum': 1
					},
					'size': {
						'$sum': '$size'
					}
				}
			}
		]).toArray().then(res => {
			const stats = res[0];
			if (stats) {
				return {
					count: stats.count,
					totalSize: stats.size,
					totalSizeString: formatSize(stats.size)
				};
			} else {
				return {
					count: 0,
					totalSize: 0,
					totalSizeString: '0B'
				};
			}
		});
	},

	updateModerationStatus: async (file, new_status) => {
		const query = {
			_id: file.filename,
		};
		const update = {
			$set: {
				moderation_status: new_status,
			},
		};

		return db.updateOne(query, update);
	},

	pruneDeniedFiles: () => {
		const query = {
			count: {
				$lte: 0
			},
			status: {
				$gte: approvalTypes.DENIED
			}
		};

		return db.deleteMany(query);
	},

	deleteAll: () => {
		return db.deleteMany({});
	}

};
