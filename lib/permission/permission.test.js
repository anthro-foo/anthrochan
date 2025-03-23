const Permission = require('./permission.js');
const { Permissions } = require('./permissions.js');

describe('testing permissions', () => {

	const NO_PERMISSION = new Permission();

	const ANON = new Permission();
	ANON.setAll([
		Permissions.USE_MARKDOWN_GENERAL,
	]);

	test('test a permission they dont have = false', () => {
		expect(ANON.get(Permissions.ROOT)).toBe(false);
	});

	const ROOT = new Permission();
	ROOT.setAll(Permission.allPermissions);

	test('root has all permissions', () => {
		expect(Permission.allPermissions.every(p => ROOT.get(p))).toBe(true);
	});

	test('applyInheritance() gives ROOT all permissions as long as they have Permissions.ROOT', () => {
		NO_PERMISSION.set(Permissions.ROOT);
		NO_PERMISSION.applyInheritance();
		expect(Permission.allPermissions.every(b => NO_PERMISSION.get(b))).toBe(true);
	});

	test('handleBody() by somebody with editorPermission NOT having Permissions.ROOT cannot set Permissions.ROOT', () => {
		const TEST_PERMISSION = new Permission();
		TEST_PERMISSION.handleBody({
			'permission_bit_0': 0,
		}, ANON);
		expect(TEST_PERMISSION.get(0)).toBe(false);
	});

	test('handleBody() by somebody with editorPermission having Permissions.ROOT CAN set Permissions.ROOT', () => {
		const TEST_PERMISSION = new Permission();
		TEST_PERMISSION.handleBody({
			'permission_bit_0': 0,
		}, ROOT);
		expect(TEST_PERMISSION.get(0)).toBe(true);
	});
});
