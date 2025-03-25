'use strict';

const express  = require('express')
	, router = express.Router({ caseSensitive: true })
	, Boards = require(__dirname+'/../db/boards.js')
//middlewares
	, geoIp = require(__dirname+'/../lib/middleware/ip/geoip.js')
	, processIp = require(__dirname+'/../lib/middleware/ip/processip.js')
	, calcPerms = require(__dirname+'/../lib/middleware/permission/calcpermsmiddleware.js')
	, { Permissions } = require(__dirname+'/../lib/permission/permissions.js')
	, hasPerms = require(__dirname+'/../lib/middleware/permission/haspermsmiddleware.js')
	, numFiles = require(__dirname+'/../lib/middleware/file/numfiles.js')
	, imageHashes = require(__dirname+'/../lib/middleware/file/imagehash.js')
	, banCheck = require(__dirname+'/../lib/middleware/permission/bancheck.js')
	, isLoggedIn = require(__dirname+'/../lib/middleware/permission/isloggedin.js')
	, verifyCaptcha = require(__dirname+'/../lib/middleware/captcha/verify.js')
	, csrf = require(__dirname+'/../lib/middleware/misc/csrfmiddleware.js')
	, useSession = require(__dirname+'/../lib/middleware/permission/usesession.js')
	, sessionRefresh = require(__dirname+'/../lib/middleware/permission/sessionrefresh.js')
	, dnsblCheck = require(__dirname+'/../lib/middleware/ip/dnsbl.js')
	, blockBypass = require(__dirname+'/../lib/middleware/captcha/blockbypass.js')
	, fileMiddlewares = require(__dirname+'/../lib/middleware/file/filemiddlewares.js')
	, { setBoardLanguage, setQueryLanguage } = require(__dirname+'/../lib/middleware/locale/locale.js')
//controllers
	, { deleteBoardController, editBansController, appealController, globalActionController, twofactorController,
		actionController, addCustomPageController, deleteCustomPageController, addNewsController,
		editNewsController, deleteNewsController, uploadBannersController, deleteBannersController, addFlagsController,
		deleteFlagsController, boardSettingsController, addAssetsController, deleteAssetsController,
		deleteAccountController, loginController, registerController, changePasswordController,
		deleteAccountsController, editAccountController, addFilterController, editFilterController, deleteFilterController, 
		globalSettingsController, createBoardController, makePostController,
		editCustomPageController, editPostController, editRoleController, newCaptchaForm, 
		blockBypassForm, logoutForm, deleteSessionsController, globalClearController, addTrustedController,
		deleteTrustedController, addNotFoundImagesController, deleteNotFoundImagesController } = require(__dirname+'/forms/index.js');

//make new post
router.post('/board/:board/post', geoIp, processIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, calcPerms, banCheck, fileMiddlewares.posts,
	makePostController.paramConverter, verifyCaptcha, numFiles, blockBypass.middleware, dnsblCheck, imageHashes, makePostController.controller);
router.post('/board/:board/modpost', geoIp, processIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, calcPerms, banCheck, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GENERAL), fileMiddlewares.posts, makePostController.paramConverter, csrf, numFiles, blockBypass.middleware, dnsblCheck, imageHashes, makePostController.controller); //mod post has token instead of captcha

//post actions
router.post('/board/:board/actions', geoIp, processIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, calcPerms, banCheck, actionController.paramConverter, verifyCaptcha, actionController.controller); //public, with captcha
router.post('/board/:board/modactions', geoIp, processIp, useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, banCheck, isLoggedIn,
	hasPerms.one(Permissions.VIEW_MANAGE), actionController.paramConverter, actionController.controller); //board manage page

router.post('/global/actions', geoIp, processIp, useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.VIEW_MANAGE), globalActionController.paramConverter, globalActionController.controller); //global manage page

//appeal ban
router.post('/appeal', geoIp, processIp, useSession, sessionRefresh, appealController.paramConverter, verifyCaptcha, appealController.controller);
//edit post
router.post('/editpost', geoIp, processIp, useSession, sessionRefresh, csrf, editPostController.paramConverter, Boards.bodyExists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.VIEW_RAW_IP), editPostController.controller);

//board management forms
router.post('/board/:board/settings', geoIp, processIp, useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), boardSettingsController.paramConverter, boardSettingsController.controller);
router.post('/board/:board/editbans', geoIp, processIp, useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BANS), editBansController.paramConverter, editBansController.controller); //edit bans
router.post('/board/:board/addfilter', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), addFilterController.paramConverter, addFilterController.controller); //add new filter
router.post('/board/:board/editfilter', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), editFilterController.paramConverter, editFilterController.controller); //edit filter
router.post('/board/:board/deletefilter', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), deleteFilterController.paramConverter, deleteFilterController.controller); //delete filter
router.post('/board/:board/deleteboard', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARDS), deleteBoardController.paramConverter, deleteBoardController.controller); //delete board

// CRUD banners, flags, assets, custompages
router.post('/addbanners', geoIp, useSession, sessionRefresh, fileMiddlewares.banner, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), numFiles, uploadBannersController.controller); //add banners
router.post('/deletebanners', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), deleteBannersController.paramConverter, deleteBannersController.controller); //delete banners
router.post('/addflags', geoIp, useSession, sessionRefresh, fileMiddlewares.flag, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), numFiles, addFlagsController.controller); //add flags
router.post('/deleteflags', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), deleteFlagsController.paramConverter, deleteFlagsController.controller); //delete flags
router.post('/addnotfoundimages', geoIp, useSession, sessionRefresh, fileMiddlewares.asset, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), numFiles, addNotFoundImagesController.controller); // add ban images
router.post('/deletenotfoundimages', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), deleteNotFoundImagesController.paramConverter, deleteNotFoundImagesController.controller); // delete ban images
router.post('/addcustompages', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), addCustomPageController.paramConverter, addCustomPageController.controller); //add custom pages
router.post('/deletecustompages', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), deleteCustomPageController.paramConverter, deleteCustomPageController.controller); //delete custom pages
router.post('/editcustompage', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), editCustomPageController.paramConverter, editCustomPageController.controller); //edit custom page

/*
router.post('/addassets', geoIp, useSession, sessionRefresh, fileMiddlewares.asset, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), numFiles, addAssetsController.controller); //add assets
router.post('/deleteassets', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ASSETS), deleteAssetsController.paramConverter, deleteAssetsController.controller); //delete assets
*/

//global management forms
router.post('/global/editbans', geoIp, processIp, useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BANS), editBansController.paramConverter, editBansController.controller); //remove bans
router.post('/global/deleteboard', useSession, sessionRefresh, csrf, deleteBoardController.paramConverter, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARDS), deleteBoardController.controller); //delete board from global management panel
router.post('/global/addnews', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_NEWS), addNewsController.paramConverter, addNewsController.controller); //add new newspost
router.post('/global/editnews', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_NEWS), editNewsController.paramConverter, editNewsController.controller); //add new newspost
router.post('/global/deletenews', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_NEWS), deleteNewsController.paramConverter, deleteNewsController.controller); //delete news
router.post('/global/deleteaccounts', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ACCOUNTS), deleteAccountsController.paramConverter, deleteAccountsController.controller); //account deleting
router.post('/global/editaccount', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ACCOUNTS), editAccountController.paramConverter, editAccountController.controller); //account editing
router.post('/global/editrole', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_ROLES), editRoleController.paramConverter, editRoleController.controller); //role editing
router.post('/global/addfilter', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), addFilterController.paramConverter, addFilterController.controller); //add new filter
router.post('/global/editfilter', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), editFilterController.paramConverter, editFilterController.controller); //edit filter
router.post('/global/deletefilter', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), deleteFilterController.paramConverter, deleteFilterController.controller); //delete filter
router.post('/global/settings', geoIp, processIp, useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), globalSettingsController.paramConverter, globalSettingsController.controller); //global settings
router.post('/global/clear', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), globalClearController.paramConverter, globalClearController.controller); //global clear
router.post('/global/addtrusted', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_TRUSTED), addTrustedController.paramConverter, addTrustedController.controller); // edit trusted
router.post('/global/deletetrusted', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_TRUSTED), deleteTrustedController.paramConverter, deleteTrustedController.controller); // edit trusted

//create board
router.post('/create', geoIp, processIp, useSession, sessionRefresh, isLoggedIn, calcPerms, verifyCaptcha, createBoardController.paramConverter, createBoardController.controller);

//accounts
router.post('/login', useSession, loginController.paramConverter, loginController.controller);
router.post('/twofactor', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, twofactorController.paramConverter, twofactorController.controller);
router.post('/logout', useSession, logoutForm);
router.post('/register', geoIp, processIp, useSession, sessionRefresh, calcPerms, verifyCaptcha, registerController.paramConverter, registerController.controller);
router.post('/changepassword', geoIp, processIp, useSession, sessionRefresh, verifyCaptcha, changePasswordController.paramConverter, changePasswordController.controller);
router.post('/deleteaccount', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, deleteAccountController.paramConverter, deleteAccountController.controller);
router.post('/deletesessions', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, deleteSessionsController.paramConverter, deleteSessionsController.controller);

//removes captcha cookie, for refreshing for noscript users
router.post('/newcaptcha', newCaptchaForm);
//solve captcha for block bypass
router.post('/blockbypass', geoIp, processIp, useSession, sessionRefresh, calcPerms, setQueryLanguage, verifyCaptcha, blockBypassForm);

module.exports = router;

