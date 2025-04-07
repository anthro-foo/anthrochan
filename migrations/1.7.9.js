'use strict';

const fs = require('fs-extra')
	, uploadDirectory = require(__dirname + '/../lib/file/uploaddirectory.js');

module.exports = async (db, redis) => {

	await db.collection('assets').updateOne(
		{ _id: 'assets' },
		{ $unset: { notfoundimages: '' } }
	);

	await Promise.all([
		fs.ensureDir(`${uploadDirectory}/boardad`),
	]);

	console.log('Clearing all cache');
	await redis.deletePattern('*');
};