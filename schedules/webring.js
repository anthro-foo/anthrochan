'use strict';

const fetch = require('node-fetch')
	, { meta } = require(__dirname+'/../configs/main.json')
	, { logos, following, blacklist } = require(__dirname+'/../configs/webring.json')
	, { Boards, Webring } = require(__dirname+'/../db/')
	, { outputFile } = require('fs-extra')
	, cache = require(__dirname+'/../redis.js')
	, uploadDirectory = require(__dirname+'/../helpers/files/uploadDirectory.js')
	, timeDiffString = require(__dirname+'/../helpers/timediffstring.js');

module.exports = async () => {
	const label = `/webring.json`;
	const start = process.hrtime();
	//fetch stuff from others
	const fetchWebring = [...new Set((await cache.get('webring:sites') || []).concat(following))]
	let rings = await Promise.all(fetchWebring.map(url => {
		return fetch(url).then(res => res.json()).catch(e => console.error);
	}));
	let found = [];
	let webringBoards = [];
	for (let i = 0; i < rings.length; i++) {
		//this could really use some validation/sanity checking
		const ring = rings[i];
		if (!ring || !ring.name) {
			return;
		}
		if (ring.following && ring.following.length > 0) {
			found = found.concat(ring.following);
		}
		if (ring.known && ring.known.length > 0) {
			found = found.concat(ring.known);
		}
		if (ring.boards && ring.boards.length > 0) {
			ring.boards.forEach(board => board.siteName = ring.name);
			webringBoards = webringBoards.concat(ring.boards);
		}
	}
	const known = [...new Set(found.concat(fetchWebring))]
		.filter(site => !blacklist.some(x => site.includes(x)) && !site.includes(meta.url));
	cache.set('webring:sites', known);
	await Webring.deleteAll();
	await Webring.db.insertMany(webringBoards);
	//now update the webring json with board list and known sites
	const boards = await Boards.boardSort(0, 0); //does not include unlisted boards
	const json = {
		name: meta.siteName,
		url: meta.url,
		endpoint: `${meta.url}/webring.json`,
		logos,
		following,
		blacklist,
		known,
		boards: boards.map(b => {
			return {
				uri: b._id,
				title: b.settings.name,
				subtitle: b.settings.description,
				path: `${meta.url}/${b._id}/`,
				postsPerHour: b.pph,
				totalPosts: b.sequence_value-1,
				uniqueUsers: b.ips,
				nsfw: !b.settings.sfw
			};
		}),
	}
	await outputFile(`${uploadDirectory}/json/webring.json`, JSON.stringify(json));
	const end = process.hrtime(start);
	console.log(timeDiffString(label, end));
}
