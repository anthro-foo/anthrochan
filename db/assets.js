
'use strict';

const Mongo = require(__dirname+'/db.js')
	, cache = require(__dirname+'/../lib/redis/redis.js')
	, db = Mongo.db.collection('assets');

module.exports = {
	db,

	addToArray: (key, list) => {
		return db.updateOne(
			{
				'_id': 'assets'
			}, {
				'$push': {
					[key]: {
						'$each': list
					}
				}
			},
			{
				upsert: true
			}
		);

	},
	
	removeFromArray: (key, list) => {
		return db.updateOne(
			{
				'_id': 'assets',
			}, {
				'$pullAll': {
					[key]: list
				}
			}
		);
	},
	
	getBanners: async () => {
		let banners = await cache.sgetall('banners');
		if (banners.length === 0) {
			let assets = await db.findOne(
				{ _id: 'assets' },
				{ banners: 1, _id: 0}
			);
			
			if (assets && assets.banners) {
				cache.sadd('banners', assets.banners);
				banners = assets.banners;
			}
		}

		return banners;
	},
	
	randomBanner: async () => {
		let banner = await cache.srand('banners');
		if (!banner) {
			const banners = await module.exports.getBanners();
			if (banners.length > 0) {
				banner = banners[Math.floor(Math.random()*banners.length)];
			}
		}
		return banner;
	},

	addBanners: (filenames) => {
		cache.del('banners');
		return module.exports.addToArray('banners', filenames);
	},

	removeBanners: (filenames) => {
		cache.del('banners');
		return module.exports.removeFromArray('banners', filenames);
	},
	
	getFlags: async () => {
		let flags = await cache.sgetall('flags');
		if (flags.length === 0) {
			let assets = await db.findOne(
				{ _id: 'assets' },
				{ flags: 1, _id: 0}
			);
			
			if (assets && assets.flags) {
				cache.sadd('flags', assets.flags);
				flags = assets.flags;
			}
		}

		return flags;
	},
	
	addFlags: (files) => {
		cache.del('flags');
		return module.exports.addToArray('flags', files);
	},
	
	removeFlags: (files) => {
		cache.del('flags');
		return module.exports.removeFromArray('flags', files);
	},
	
	getNotFoundImages: async () => {
		let notfoundimages = await cache.sgetall('notfoundimages');
		if (notfoundimages.length === 0) {
			let assets = await db.findOne(
				{ _id: 'assets' },
				{ notfoundimages: 1, _id: 0}
			);
			
			if (assets && assets.notfoundimages) {
				cache.sadd('notfoundimages', assets.notfoundimages);
				notfoundimages = assets.notfoundimages;
			}
		}

		return notfoundimages;
	},
	
	randomNotFoundImage: async () => {
		let notfoundimage = await cache.srand('notfoundimages');
		if (!notfoundimage) {
			const notfoundimages = await module.exports.getNotFoundImages();
			if (notfoundimages.length > 0) {
				notfoundimage = notfoundimages[Math.floor(Math.random()*notfoundimages.length)];
			}
		}
		return notfoundimage;
	},

	addNotFoundImages: (filenames) => {
		cache.del('notfoundimages');
		return module.exports.addToArray('notfoundimages', filenames);
	},

	removeNotFoundImages: (filenames) => {
		cache.del('notfoundimages');
		return module.exports.removeFromArray('notfoundimages', filenames);
	},
	
	getCustomPages: async () => {
		return [];
	},
};
