class modMacroHandler {
	constructor(dropdown) {
		this.dropdown = dropdown;
		this.dropdown.selectedIndex = 0; // reset on page refresh, but let it stick
		
		// checks
		this.approve = document.getElementById('approvecheck');
		this.delete = document.getElementById('deletecheck');
		this.deleteipglobal = document.getElementById('deleteipglobalcheck');
		this.deletefile = document.getElementById('deletefilecheck');
		this.globalban = document.getElementById('globalbancheck');
		this.widerange = document.getElementById('widerangecheck');
		this.noappeal = document.getElementById('noappealcheck');
		this.preservepost = document.getElementById('preservepostcheck');
		this.untrust = document.getElementById('untrustcheck');
		this.trust = document.getElementById('trustcheck');

		// text
		this.banreason = document.getElementById('banreasontext');
		this.banduration = document.getElementById('bandurationtext');
		
		this.reset();
		dropdown.addEventListener('change', e => this.change(e));
	}
	
	reset() {
		this.approve.checked = false;
		this.delete.checked = false;
		this.deleteipglobal.checked = false;
		this.deletefile.checked = false;
		this.globalban.checked = false;
		this.widerange.checked = false;
		this.noappeal.checked = false;
		this.preservepost.checked = false;
		this.untrust.checked = false;
		this.trust.checked = false;
		
		this.banreason.value = '';
		this.banduration.value = '';
	}
	
	change(e) {
		let selectedValue = e.target.value;
		
		this.reset();

		switch (selectedValue) {
			case 'approvefile':
				this.approve.checked = true;
				break;
			case 'rule1':
				this.deleteipglobal.checked = true;
				this.deletefile.checked = true;
				this.globalban.checked = true;
				this.widerange.checked = true;
				this.noappeal.checked = true;
				this.banreason.value = 'Rule 1 (Illegal)';
				this.banduration.value = '1y';
				this.untrust.checked = true;
				break;
			case 'rule2':
				this.deletefile.checked = true;
				this.globalban.checked = true;
				this.banreason.value = 'Rule 2 (NSFW)';
				this.banduration.value = '1d';
				this.untrust.checked = true;
				break;
			case 'rule3':
				this.globalban.checked = true;
				this.preservepost.checked = true;
				this.banreason.value = 'Rule 3 (Hostility)';
				this.banduration.value = '1d';
				this.untrust.checked = true;
				break;
			case 'rule4':
				this.globalban.checked = true;
				this.widerange.checked = true;
				this.noappeal.checked = true;
				this.preservepost.checked = true;
				this.banreason.value = 'Rule 4 (Spam)';
				this.banduration.value = '4h';
				break;
			case 'rule5':
				this.globalban.checked = true;
				this.widerange.checked = true;
				this.noappeal.checked = true;
				this.preservepost.checked = true;
				this.banreason.value = 'Rule 5 (Underage)';
				this.banduration.value = '1y';
				this.untrust.checked = true;
				break;
			case 'banevasion':
				this.deletefile.checked = true;
				this.globalban.checked = true;
				this.preservepost.checked = true;
				this.banreason.value = 'ban evasion';
				this.banduration.value = '1y';
				this.untrust.checked = true;
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