
'use strict';

const Mongo = require(__dirname+'/db.js')
	, db = Mongo.db.collection('custompages');

module.exports = {

	db,

	find: (limit=0) => {
		return db.find({})
			.sort({ '_id': -1 })
			.limit(limit)
			.toArray();
	},

	//browsing board
	findOne: (page) => {
		return db.findOne({
			'page': page
		});
	},

	//editing
	findOneId: (id) => {
		return db.findOne({
			'_id': id,
		});
	},

	boardCount: () => {
		return db.countDocuments({});
	},

	insertOne: (custompage) => {
		return db.insertOne(custompage);
	},

	findOneAndUpdate: (id, page, title, raw, markdown, edited) => {
		return db.findOneAndUpdate({
			'_id': id,
		}, {
			'$set': {
				'page': page,
				'title': title,
				'message.raw': raw,
				'message.markdown': markdown,
				'edited': edited,
			}
		}, {
			returnDocument: 'before',
		});
	},

	deleteMany: (pages) => {
		return db.deleteMany({
			'page': {
				'$in': pages
			},
		});
	},

	deleteAll: () => {
		return db.deleteMany({});
	},

};
