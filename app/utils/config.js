const config = {
	keyEmails: {
		confirmAccountLink: 'CONFIRM_ACCOUNT_LINK',
		confirmAccountCode: 'CONFIRM_ACCOUNT_CODE',
		recoverPasswordLink: 'RECOVER_PASSWORD_LINK',
		recoverPasswordCode: 'RECOVER_PASSWORD_CODE',
		changeEmailLink: 'CHANGE_EMAIL_LINK',
		changeEmailCode: 'CHANGE_EMAIL_CODE',
		confirmStaffLink: 'CONFIRM_ACCOUNT_STAFF',
		recoverStaffLink: 'RECOVER_PASSWORD_STAFF',
		generalEmail: 'GENERAL_EMAIL',
	},
	emailTags: {
		company_name: 'team, Lda.',
		company_address: 'Lisboa, Portugal',
		company_email: 'info@team.pt',
		company_url: 'team.pt',
		app_name: 'team',
		app_color: '#3277A3',
		logo: 'https://team-dev.s3.eu-central-1.amazonaws.com/assets/logo_team.png',
		logo_small: 'https://team-dev.s3.eu-central-1.amazonaws.com/assets/icon_team.png',
	},
	storeLinks: {
		android: 'https://play.google.com/store/apps/details?id=com.yummysmart.app',
		ios: 'https://apps.apple.com/us/app/yummy-smart/id1610171410',
	},
	criticalVersions: ['1.0.0'],
	warningVersions: ['1.0.0'],
	minimumVersion: '1.0.0',
	apiKey: '$2b$10$c54Hnawxfvad21wLJ5H/BeoGsP0Fw6UrGWD8f3dAA2RJHABv7OQPW',
	tokenDuration: 90,
};

export default config;