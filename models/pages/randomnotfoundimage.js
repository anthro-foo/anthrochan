
'use strict';

const Assets = require(__dirname+'/../../db/assets.js');

module.exports = async (req, res, next) => {
	let notfoundimage;
	try {
		notfoundimage = await Assets.randomNotFoundImage();
	} catch (err) {
		return next(err);
	}

	if (!notfoundimage) {
		//non existing boards will show default banner, but it doesnt really matter.
		return res.redirect('/file/defaultbanner.png');
	}

	return res.redirect(`/notfoundimage/${notfoundimage}`);

};