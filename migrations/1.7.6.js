'use strict';

module.exports = async(db, redis) => {
	console.log('Clearning trusted users from boards.');
	await db.collection('accounts').updateMany({}, { $unset: { trustedBoards: '' } });
	console.log('Clearning trusted boards from users.');
	await db.collection('boards').updateMany({}, { $unset: { trusted: ''} });
	
	console.log('Clearing globalsettings cache');
	await redis.deletePattern('globalsettings');
	console.log('Clearing sessions and users cache');
	await redis.deletePattern('users:*');
	await redis.deletePattern('sess:*');
};