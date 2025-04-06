
'use strict';

const Assets = require(__dirname + '/../../db/assets.js');

module.exports = async (req, res, next) => {
	let boardad;
	try {
		boardad = await Assets.randomBoardAd();
	} catch (err) {
		return next(err);
	}

	if (!boardad) {
		//non existing boards will show default banner, but it doesnt really matter.
		return res.redirect('/file/defaultbanner.png');
	}

	return res.redirect(`/boardad/${boardad}`);

};