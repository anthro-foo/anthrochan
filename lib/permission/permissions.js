'use strict';

const Permissions = Object.seal(Object.freeze(Object.preventExtensions({
	ROOT: 0,

	// Sensitive data
	VIEW_RAW_IP: 1,
	VIEW_MANAGE: 2,

	// Creation
	CREATE_BOARD: 3,
	CREATE_ACCOUNT: 4,

	// Bypasses
	BYPASS_BANS: 5,
	BYPASS_SPAMCHECK: 6,
	BYPASS_RATELIMITS: 7,
	BYPASS_FILTERS: 8,
	BYPASS_CAPTCHA: 9,
	BYPASS_FILE_APPROVAL: 10,
	BYPASS_DNSBL: 11,
	BYPASS_ANONYMIZER_RESTRICTIONS: 12,
	
	// Mod permissions
	MANAGE_FILE_APPROVAL: 13, // approve/deny files
	MANAGE_GENERAL: 14, // delete/ban/move posts
	MANAGE_LOGS: 15, // view logs
	MANAGE_NEWS: 16, // add/edit/delete news
	MANAGE_BOARDS: 17, // search/filter boards
	MANAGE_GLOBAL_SETTINGS: 18, // edit site settings
	MANAGE_BOARD_SETTINGS: 19, // edit board settings
	MANAGE_ACCOUNTS: 20, // add/edit/delete accounts
	MANAGE_ROLES: 21, // edit roles
	MANAGE_BANS: 22, // edit bans
	MANAGE_TRUSTED: 23, // add/delete trusted users
	MANAGE_ASSETS: 24, // add/edit/delete assets
	
	USE_MARKDOWN_GENERAL: 25,
	USE_MARKDOWN_IMAGE: 26,
})));

const Metadata = Object.seal(Object.freeze(Object.preventExtensions({

	[Permissions.ROOT]: { title: 'Root', label: 'Root', desc: 'Full control. Use with caution!', parents: [Permissions.ROOT] },

	[Permissions.VIEW_RAW_IP]: { title: 'Sensitive information', label: 'View Raw IPs', desc: 'Ability to see raw IPs in moderation interfaces.' },
	[Permissions.VIEW_MANAGE]: { label: 'View manage panel', desc: 'Ability to enter moderation interface.' },

	[Permissions.CREATE_BOARD]: { title: 'Create', label: 'Create Board', desc: 'Ability to create new boards.' },
	[Permissions.CREATE_ACCOUNT]: { label: 'Create Account', desc: 'Ability to register an account.' },

	[Permissions.BYPASS_BANS]: { title: 'Bypasses', label: 'Bypass Bans', desc: 'Bypass all bans.' },
	[Permissions.BYPASS_SPAMCHECK]: { label: 'Bypass Spamcheck', desc: 'Bypass the basic anti-flood spamcheck for too frequent similar posting.' },
	[Permissions.BYPASS_RATELIMITS]: { label: 'Bypass Ratelimits', desc: 'Bypass ratelimits for getting new captchas, editing posts, editing board settings, etc.' },
	[Permissions.BYPASS_FILTERS]: { label: 'Bypass Filters', desc: 'Bypass all post filters.' },
	[Permissions.BYPASS_CAPTCHA]: { label: 'Bypass Captcha', desc: 'Bypass captcha.' },
	[Permissions.BYPASS_FILE_APPROVAL]: { label: 'Bypass File Approval', desc: 'Ability to bypass the file approval process.' },
	[Permissions.BYPASS_DNSBL]: { label: 'Bypass DNSBL', desc: 'Bypass DNSBL.' },
	[Permissions.BYPASS_ANONYMIZER_RESTRICTIONS]: { label: 'Bypass Anonymizer Restrictions', desc: 'Bypass anonymizer restrictions e.g. disabled file posting.' },

	[Permissions.MANAGE_FILE_APPROVAL]: { title: 'Management', label: 'File approval', desc: 'Ability to approve and deny files.' },
	[Permissions.MANAGE_GENERAL]: { label: 'General', desc: 'General staff permission. Access to recent posts and reports. Ability to submit mod actions.' },
	[Permissions.MANAGE_LOGS]: { label: 'Logs', desc: 'Access logs. Ability to search/filter' },
	[Permissions.MANAGE_NEWS]: { label: 'News', desc: 'Access news posting. Ability to add, edit, or delete newsposts.' },
	[Permissions.MANAGE_BOARDS]: { label: 'Boards', desc: 'Access the global board list. Ability to search/filter. Also grants the ability to transfer or delete any board.' },
	[Permissions.MANAGE_GLOBAL_SETTINGS]: { label: 'Global Settings', desc: 'Access global settings. Ability to change any settings.' },
	[Permissions.MANAGE_BOARD_SETTINGS]: { label: 'Board Settings', desc: 'Access board settings. Ability to change any board settings.' },
	[Permissions.MANAGE_ACCOUNTS]: { label: 'Accounts', desc: 'Access the accounts list. Ability to search/sort. Ability to edit permissions of any user.', parents: [Permissions.ROOT] },
	[Permissions.MANAGE_ROLES]: { label: 'Roles', desc: 'Access roles list. Ability to edit roles', parents: [Permissions.ROOT] },
	[Permissions.MANAGE_BANS]: { label: 'Bans', desc: 'Access bans. Ability to unban, edit, or deny appeals.' },
	[Permissions.MANAGE_TRUSTED]: { label: 'Trusted', desc: 'Access trusted list. Ability to edit trusted users' },
	[Permissions.MANAGE_ASSETS]: { label: 'Assets', desc: 'Access assets list. Ability to add/edit/delete assets' },

	[Permissions.USE_MARKDOWN_GENERAL]: { title: 'Post styling', label: 'Markdown', desc: 'Use markdown' },
	[Permissions.USE_MARKDOWN_IMAGE]: { label: 'Embed Images', desc: 'Embed images', parents: [Permissions.ROOT] }, //TODO: add a new permission bit to manage each board inherited perm and use them as additional parents
})));

module.exports = {

	Permissions,

	Metadata,

};
