'use strict';

module.exports = async(db, redis) => {
	console.log('Clearning trusted users from boards.');
	console.log('Clearning trusted boards from users.');
	
	console.log('Clearing globalsettings cache');
	await redis.deletePattern('globalsettings');
	console.log('Clearing sessions and users cache');
	await redis.deletePattern('users:*');
	await redis.deletePattern('sess:*');
};