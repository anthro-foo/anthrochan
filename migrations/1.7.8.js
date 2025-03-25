'use strict';

module.exports = async(db, redis) => {
	
	await db.collection('boards').updateMany(
		{}, 
		{ $set: { 'settings.requireFileApproval':true } }
	);
	await db.collection('globalsettings').updateMany(
		{ _id: 'globalsettings' }, 
		{ $set: { 'boardDefaults.requireFileApproval':true } }
	);

	console.log('Clearing all cache');
	await redis.deletePattern('*');
};