class modMacroHandler {
	constructor(dropdown) {
		this.dropdown = dropdown;
		this.dropdown.selectedIndex = 0; // reset on page refresh, but let it stick

		this.inputMap = new Map();
		const inputs = document.querySelectorAll('.actions input');

		inputs.forEach(input => {
			this.inputMap.set(input.name, input);
			input.addEventListener('change', () => {
				if (!input.parentElement) {
					return;
				}
				const parent = input.parentElement;
				switch (input.type) {
					case 'text':
						if (input.value !== '') {
							parent.classList.add('modified');
						} else {
							parent.classList.remove('modified');
						}
						break;
					case 'checkbox':
						if (input.checked) {
							parent.classList.add('modified');
						} else {
							parent.classList.remove('modified');
						}
						break;
				}
			});
		});

		this.reset();
		dropdown.addEventListener('change', e => this.change(e));
	}

	reset() {
		for (const input of this.inputMap.values()) {
			switch (input.type) {
				case 'checkbox':
					input.checked = false;
					input.dispatchEvent(new Event('change', { bubbles: true }));
					break;
				case 'text':
					input.value = '';
					input.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}
	}

	set(name, value) {
		if (!name) {
			return;
		}
		const input = this.inputMap.get(name);
		if (!input) {
			return;
		}
		switch (input.type) {
			case 'checkbox':
				input.checked = value ? true : false;
				break;
			case 'text':
				input.value = value;
				break;
		}
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}

	change(e) {
		let selectedValue = e.target.value;
		this.reset();

		switch (selectedValue) {
			case 'clear':
				this.reset();
				break;
			case 'approvefiles':
				this.set('approve', true);
				break;
			case 'denyfiles':
				this.set('deny', true);
				break;
			case 'ban':
				this.set('global_ban', true);
				this.set('ban_h', true);
				this.set('preserve_post', true);
				break;
			case 'rule1':
				this.set('delete_file', true);
				this.set('global_ban', true);
				this.set('ban_h', true);
				this.set('ban_reason', 'rule 1');
				this.set('ban_duration', '10y');
				this.set('preserve_post', true);
				this.set('untrust', true);
				break;
			case 'rule2':
				this.set('delete_file', true);
				this.set('global_ban', true);
				this.set('ban_h', true);
				this.set('ban_reason', 'rule 2');
				this.set('ban_duration', '1h');
				this.set('preserve_post', true);
				this.set('untrust', true);
				break;
			case 'rule3':
				this.set('global_ban', true);
				this.set('ban_h', true);
				this.set('ban_reason', 'rule 3');
				this.set('ban_duration', '1d');
				this.set('preserve_post', true);
				break;
			case 'rule4':
				this.set('global_ban', true);
				this.set('ban_h', true);
				this.set('ban_reason', 'rule 4');
				this.set('ban_duration', '4h');
				this.set('preserve_post', true);
				break;
			case 'rule5':
				this.set('global_ban', true);
				this.set('ban_h', true);
				this.set('ban_reason', 'rule 5');
				this.set('ban_duration', '1y');
				this.set('preserve_post', true);
				break;
			case 'banevasion':
				this.set('global_ban', true);
				this.set('ban_h', true);
				this.set('ban_reason', 'ban evasion');
				this.set('ban_duration', '1h');
				this.set('preserve_post', true);
				break;
		}
	}
}

window.addEventListener('DOMContentLoaded', () => {
	let dropdown = document.getElementById('modmacros');
	if (dropdown) {
		new modMacroHandler(dropdown);
	}
});