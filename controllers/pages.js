'use strict';

const express  = require('express')
	, router = express.Router({ caseSensitive: true })
	, Boards = require(__dirname+'/../db/boards.js')
	, Posts = require(__dirname+'/../db/posts.js')
	//middlewares
	, processIp = require(__dirname+'/../lib/middleware/ip/processip.js')
	, geoIp = require(__dirname+'/../lib/middleware/ip/geoip.js')
	, calcPerms = require(__dirname+'/../lib/middleware/permission/calcpermsmiddleware.js')
	, { Permissions } = require(__dirname+'/../lib/permission/permissions.js')
	, hasPerms = require(__dirname+'/../lib/middleware/permission/haspermsmiddleware.js')
	, isLoggedIn = require(__dirname+'/../lib/middleware/permission/isloggedin.js')
	, paramConverter = require(__dirname+'/../lib/middleware/input/paramconverter.js')
	, useSession = require(__dirname+'/../lib/middleware/permission/usesession.js')
	, sessionRefresh = require(__dirname+'/../lib/middleware/permission/sessionrefresh.js')
	, csrf = require(__dirname+'/../lib/middleware/misc/csrfmiddleware.js')
	, setMinimal = require(__dirname+'/../lib/middleware/misc/setminimal.js')
	, { setBoardLanguage, setQueryLanguage } = require(__dirname+'/../lib/middleware/locale/locale.js')
	//page models
	, { manageRecent, manageReports, manageSettings, manageBans, manageFilters, editFilter, editCustomPage,
		manageBoard, manageThread, manageLogs, manageCatalog, editPost } = require(__dirname+'/../models/pages/manage/')
	, { globalManageAssets, globalManageCustomPages, globalManageTrusted, globalManageApproval, globalManageSettings, globalManageReports, globalManageBans, globalManageBoards, globalManageFilters, globalEditFilter, editNews, editAccount, editRole,
		globalManageRecent, globalManageAccounts, globalManageNews, globalManageLogs, globalManageRoles } = require(__dirname+'/../models/pages/globalmanage/')
	, { bans, banned, changePassword, blockBypass, home, register, login, create, myPermissions, sessions, setupTwoFactor,
		board, catalog, banners, boardSettings, globalSettings, randombanner, randomnotfoundimage, news, captchaPage, overboard, overboardCatalog,
		captcha, thread, modlog, modloglist, account, boardlist, customPage, csrfPage, noncePage } = require(__dirname+'/../models/pages/')
	, threadParamConverter = paramConverter({ processThreadIdParam: true })
	, logParamConverter = paramConverter({ processDateParam: true })
	, filterParamConverter = paramConverter({ objectIdParams: ['filterid'] })
	, newsParamConverter = paramConverter({ objectIdParams: ['newsid'] })
	, roleParamConverter = paramConverter({ objectIdParams: ['roleid'] })
	, custompageParamConverter = paramConverter({ objectIdParams: ['custompageid'] });

//homepage
router.get('/index.html', home);

//news page
router.get('/news.html', news);

//banned page
router.get('/banned.html', geoIp, processIp, useSession, sessionRefresh, calcPerms, banned);

//bans page
router.get('/bans.html', bans);

//board list
router.get('/boards.(html|json)', boardlist);

//overboard
router.get('/overboard.(html|json)', overboard); //overboard
router.get('/catalog.(html|json)', overboardCatalog); //overboard catalog view

//assets
router.get('/banners.(html|json)', banners); //banners
router.get('/randombanner', randombanner); //random banner
router.get('/randomnotfoundimage', randomnotfoundimage); //random banner
router.get('/custompage/:page.(html|json)', customPage); //board custom page

//board pages
router.get('/:board/:page(1[0-9]{1,}|[2-9][0-9]{0,}|index).(html|json)', Boards.exists, setBoardLanguage, board); //index
router.get('/:board/thread/:id([1-9][0-9]{0,})(\\+50)?.(html|json)', Boards.exists, setBoardLanguage, threadParamConverter, Posts.threadExistsMiddleware, thread); //thread view
router.get('/:board/catalog.(html|json)', Boards.exists, setBoardLanguage, catalog); //catalog
router.get('/:board/logs.(html|json)', Boards.exists, setBoardLanguage, modloglist);//modlog list
router.get('/:board/logs/:date(\\d{2}-\\d{2}-\\d{4}).(html|json)', Boards.exists, setBoardLanguage, logParamConverter, modlog); //daily log
router.get('/:board/settings.json', Boards.exists, setBoardLanguage, boardSettings); //public board settings
router.get('/settings.json', globalSettings); //public global settings

//board manage pages
router.get('/:board/manage/catalog.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.VIEW_MANAGE), csrf, manageCatalog);
router.get('/:board/manage/:page(1[0-9]{1,}|[2-9][0-9]{0,}|index).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.VIEW_MANAGE), csrf, manageBoard);
router.get('/:board/manage/thread/:id([1-9][0-9]{0,})(\\+50)?.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, threadParamConverter, calcPerms,
	hasPerms.one(Permissions.VIEW_MANAGE), csrf, Posts.threadExistsMiddleware, manageThread);
router.get('/:board/manage/editpost/:id([1-9][0-9]{0,}).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, threadParamConverter, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), csrf, Posts.postExistsMiddleware, editPost);
router.get('/:board/manage/reports.(html|json)', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_GENERAL), csrf, manageReports);
router.get('/:board/manage/recent.(html|json)', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_GENERAL), csrf, manageRecent);
router.get('/:board/manage/logs.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_LOGS), csrf, manageLogs);
router.get('/:board/manage/bans.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BANS), csrf, manageBans);
router.get('/:board/manage/settings.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), csrf, manageSettings);
router.get('/:board/manage/editcustompage/:custompageid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_ASSETS), csrf, custompageParamConverter, editCustomPage);
router.get('/:board/manage/filters.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), csrf, manageFilters);
router.get('/:board/manage/editfilter/:filterid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), csrf, filterParamConverter, editFilter);

//global manage pages
router.get('/globalmanage/approval.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_FILE_APPROVAL), csrf, globalManageApproval);
router.get('/globalmanage/reports.(html|json)', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GENERAL), csrf, globalManageReports);
router.get('/globalmanage/recent.(html|json)', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GENERAL), csrf, globalManageRecent);
router.get('/globalmanage/globallogs.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_LOGS), csrf, globalManageLogs);
router.get('/globalmanage/bans.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_BANS), csrf, globalManageBans);
router.get('/globalmanage/boards.(html|json)', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARDS), globalManageBoards);
router.get('/globalmanage/news.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_NEWS), csrf, globalManageNews);
router.get('/globalmanage/accounts.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_ACCOUNTS), csrf, globalManageAccounts);
router.get('/globalmanage/roles.(html|json)', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_ROLES), csrf, globalManageRoles);
router.get('/globalmanage/filters.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), csrf, globalManageFilters);
router.get('/globalmanage/settings.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), csrf, globalManageSettings);
router.get('/globalmanage/assets.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_ASSETS), csrf, globalManageAssets);
router.get('/globalmanage/custompages.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_ASSETS), csrf, globalManageCustomPages);
router.get('/globalmanage/editnews/:newsid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_NEWS), csrf, newsParamConverter, editNews);
router.get('/globalmanage/editfilter/:filterid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), csrf, filterParamConverter, globalEditFilter);
router.get('/globalmanage/editaccount/:accountusername([a-zA-Z0-9]{1,50}).html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_ACCOUNTS), csrf, editAccount);
router.get('/globalmanage/editrole/:roleid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_ROLES), csrf, roleParamConverter, editRole);
router.get('/globalmanage/trusted.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_TRUSTED), csrf, globalManageTrusted);

//captcha
router.get('/captcha', geoIp, processIp, captcha); //get captcha image and cookie
router.get('/captcha.html', captchaPage); //iframed for noscript users
router.get('/bypass.html', blockBypass); //block bypass page
router.get('/bypass_minimal.html', setMinimal, setQueryLanguage, blockBypass); //block bypass page

//accounts
router.get('/account.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, account); //page showing boards you are mod/owner of, links to password rese, logout, etc
router.get('/mypermissions.html', useSession, sessionRefresh, isLoggedIn, calcPerms, myPermissions);
router.get('/twofactor.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, setupTwoFactor);
router.get('/sessions.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, sessions);
router.get('/nonce/:address([a-zA-Z0-9]{42}).json', noncePage); //nonce for web3 logins
router.get('/login.html', login);
router.get('/register.html', register);
router.get('/changepassword.html', changePassword);
router.get('/create.html', useSession, sessionRefresh, isLoggedIn, create); //create new board
router.get('/csrf.json', useSession, sessionRefresh, isLoggedIn, csrf, csrfPage); //just the token, for 3rd party stuff posting

module.exports = router;
