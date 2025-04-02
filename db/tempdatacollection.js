'use strict';

const Mongo = require(__dirname + '/db.js')
	, db = Mongo.db.collection('tempdatacollection');

module.exports = {
	db,

	insertOne: async (board, thread, postId, data) => {
		await db.insertOne({
			board: board,
			thread: thread,
			postId: postId,
			browserUuid: data.browserUuid,
			browserName: data.browserName,
			browserIncognito: data.browserIncognito,
		});
	},
};
