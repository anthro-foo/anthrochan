'use strict';

module.exports = {
	manageReports: require(__dirname + '/reports.js'),
	manageRecent: require(__dirname + '/recent.js'),
	manageSettings: require(__dirname + '/settings.js'),
	manageBans: require(__dirname + '/bans.js'),
	manageLogs: require(__dirname + '/logs.js'),
	manageBoard: require(__dirname + '/board.js'),
	manageCatalog: require(__dirname + '/catalog.js'),
	manageThread: require(__dirname + '/thread.js'),
	editCustomPage: require(__dirname + '/editcustompage.js'),
	editFilter: require(__dirname + '/editfilter.js'),
	editPost: require(__dirname + '/editpost.js'),
};
