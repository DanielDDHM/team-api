const errors = {
	// 500
	internal_error: {
		status: 500,
		code: 'INTERNAL_ERROR',
		message: {
			en: 'Internal Server Error.',
		},
	},
	// 404
	not_found: {
		status: 404,
		code: 'NOT_FOUND',
		message: {
			en: 'Not Found.',
		},
	},
	// 409
	duplicate_entry: {
		status: 409,
		code: 'DUPLICATE_ENTRY',
		message: {
			en: 'Duplicate Entry.',
		},
	},
	duplicate_email: {
		status: 409,
		code: 'DUPLICATE_EMAIL',
		message: {
			en: 'Duplicate Email.',
		},
	},
	duplicate_new_email: {
		status: 409,
		code: 'DUPLICATE_NEW_EMAIL',
		message: {
			en: 'The new email is already in use.',
		},
	},
	// 401
	invalid_token: {
		status: 401,
		code: 'INVALID_TOKEN',
		message: {
			en: 'Invalid Token.',
		},
	},
	token_expired: {
		status: 401,
		code: 'TOKEN_EXPIRED',
		message: {
			en: 'Token Expired.',
		},
	},
	no_token: {
		status: 401,
		code: 'NO_TOKEN',
		message: {
			en: 'No Token.',
		},
	},
	invalid_api_key: {
		status: 401,
		code: 'INVALID_API_KEY',
		message: {
			en: 'Invalid API KEY.',
		},
	},
	invalid_parameter: {
		status: 400,
		code: 'INVALID_PARAMETER',
		message: {
			en: 'Invalid parameter.',
		},
	},
	invalid_phone: {
		status: 400,
		code: 'INVALID_PHONE',
		message: {
			en: 'Invalid Phone',
		},
	},
	missing_fields: {
		status: 400,
		code: 'MISSING_FIELDS',
		message: {
			en: 'There are field that are missing.',
		},
	},
	order_in_transit: {
		status: 400,
		code: 'ORDER_IN_TRANSIT',
		message: {
			en: 'Order is being delivered',
		},
	},
	order_not_accepted: {
		status: 400,
		code: 'ORDER_NOT_ACCEPTED',
		message: {
			en: 'No Delivery Staff has accepted the order yet',
		},
	},
	no_api_key: {
		status: 401,
		code: 'NO_API_KEY',
		message: {
			en: 'No API KEY.',
		},
	},
	modifier_in_use: {
		status: 409,
		code: 'MODIFIER_IN_USE',
		message: {
			en: 'Modifier in Use',
		},
	},
	// 403
	no_permission: {
		status: 403,
		code: 'NO_PERMISSION',
		message: {
			en: 'No Permission.',
		},
	},
	chat_unavailable: {
		status: 403,
		code: 'CHAT_UNAVAILABLE',
		message: {
			en: 'This chat is no longer available.',
			pt: 'Este chat já não se encontra disponível.',
		},
	},
	chat_unavailable_review: {
		status: 403,
		code: 'CHAT_UNAVAILABLE_REVIEW',
		message: {
			en: 'This chat is not available for review.',
			pt: 'Este chat não se encontra disponível para avaliação.',
		},
	},
	chat_opened: {
		status: 403,
		code: 'CHAT_ALREADY_OPEN',
		message: {
			en: 'Already exist a chat opened, please use that chat.',
			pt: 'Já existe um chat aberto, por favor use esse chat.',
		},
	},
	chat_finished: {
		status: 403,
		code: 'CHAT_ALREADY_FINISHED',
		message: {
			en: 'This chat was already finished, please refresh your page.',
			pt: 'Este chat já se encontra fechado, por favor faça refresh à página.',
		},
	},
	call_unavailable: {
		status: 403,
		code: 'CALL_UNAVAILABLE',
		message: {
			en: 'This call is no longer available.',
			pt: 'Esta chamada já não se encontra disponível.',
		},
	},
	exceed_consultations: {
		status: 403,
		code: 'EXCEED_CONSULTATIONS',
		message: {
			en: 'You have exceeded the number of consultations allowed per month',
			pt: 'Excedeu o número de consultas permitido por mês',
		},
	},
	exceed_business_consultations: {
		status: 403,
		code: 'EXCEED_BUSINESS_CONSULTATIONS',
		message: {
			en: 'The number of consultation contracted by your entity have been exceeded',
			pt: 'Foram esgotados o número de consultas contratadas pela sua entidade',
		},
	},
	not_confirmed: {
		status: 403,
		code: 'NOT_CONFIRMED',
		message: {
			en: 'User not confirmed',
		},
	},
	//304
	not_modified: {
		status: 304,
		code: 'NOT_MODIFIED',
		message: {
			en: 'Not modified.',
		},
	},
	// 400
	invalid_credentials: {
		status: 400,
		code: 'INVALID_CREDENTIALS',
		message: {
			en: 'Invalid credentials. Please try again.',
		},
	},
	bad_request: {
		status: 400,
		code: 'BAD_REQUEST',
		message: {
			en: 'Bad Request. Please try again.',
		},
	},
	invalid_code: {
		status: 400,
		code: 'INVALID_CODE',
		message: {
			en: 'Invalid Confirmation Code. Please try again.',
		},
	},
	invalid_vat: {
		status: 400,
		code: 'INVALID_VAT',
		message: {
			en: 'Invalid Vat Number. Please try again.',
		},
	},
	invalid_iban: {
		status: 400,
		code: 'INVALID_IBAN',
		message: {
			en: 'Invalid IBAN. Please try again.',
		},
	},
	invalid_country: {
		status: 400,
		code: 'INVALID_COUNTRY',
		message: {
			en: 'Invalid Country. Please try again.',
		},
	},
	invalid_data_type: {
		status: 400,
		code: 'INVALID_DATA_TYPE',
		message: {
			en: 'Invalid data type.',
		},
	},
	invalid_delete_request: {
		status: 400,
		code: 'INVALID_DELETE_REQUEST',
		message: {
			en: 'Entity is being referenced.',
		},
	},
	invalid_file_extension: {
		status: 400,
		code: 'INVALID_FILE_EXTENSION',
		message: {
			en: 'Invalid file extension.',
		},
	},
	record_in_use: {
		status: 400,
		code: 'RECORD_IN_USE',
		message: {
			en: 'Record is in use.',
		},
	},
	file_in_use: {
		status: 400,
		code: 'FILE_IN_USE',
		message: {
			en: 'File is in use.',
		},
	},
	duplicate_file_name: {
		status: 400,
		code: 'DUPLICATE_FILE_NAME',
		message: {
			en: 'File name already in use.',
		},
	},
	duplicate_preRegister: {
		status: 400,
		code: 'DUPLICATE_PRE_REGISTER',
		message: {
			en: 'Duplicate Pre Register',
		},
	},
	no_update: {
		status: 400,
		code: 'WRONG_UPDATE',
		message: {
			en: 'Wrong version.',
		},
	},
	no_phone: {
		status: 400,
		code: 'NO_PHONE',
		message: {
			en: 'No Phone',
		},
	},
	db_failed_operation: {
		status: 402,
		code: 'OPERATION_FAILED',
		message: {
			en: 'The Operation could not be finalized',
		},
	},
	failed_email_sending: {
		status: 400,
		code: 'FAILED_EMAIL_SENDING',
		message: {
			en: 'Error while sending email.',
		},
	},
	failed_user_creation: {
		status: 400,
		code: 'FAILED_USER_CREATION',
		message: {
			en: 'The user could not be created.',
		},
	},
	db_failed_filtering: {
		status: 400,
		code: 'FAILED_FILTERING',
		message: {
			en: 'An error has been found when filtering.',
		},
	},
	failed_getting_Settings: {
		status: 400,
		code: 'FAILED_SETTINGS',
		message: {
			en: 'Failed to get settings.',
		},
	},
	invalid_header: {
		status: 400,
		code: 'INVALID_HEADER',
		message: {
			en: 'Invalid header.',
		},
	},
	required_fields_empty: {
		status: 400,
		code: 'REQUIRED_FIELDS_EMPTY',
		message: {
			en: 'Required fields are empty.',
		},
	},
	order_cancelled: {
		status: 400,
		code: 'ORDER_CANCELLED',
		message: {
			en: 'Order Cancelled',
		},
	},
	cant_deliver_order: {
		status: 400,
		code: 'CANT_DELIVER_ORDER',
		message: {
			en: `Can't deliver order`,
		},
	},
	user_banned: {
		status: 403,
		code: 'USER_BANNED',
		message: {
			en: 'User Banned',
		},
	},
	business_denied: {
		status: 403,
		code: 'BUSINESS_PENDING',
		message: {
			en: 'Business is not yet receiver Orders.',
		},
	},
	invalid_mbway_phone: {
		status: 400,
		code: 'INVALID_MBWAY_PHONE',
		message: {
			en: 'Phone Number invalid for MBWay operation',
			pt: 'Número de telefone inválido para operação de MBWay',
		},
	},
	// 500
	no_user: {
		status: 500,
		code: 'NO_USER',
		message: {
			en: 'No user',
		},
	},
	db_failed_setup: {
		status: 500,
		code: 'DATABASE_SETUP_FAILED',
		message: {
			en: 'Something went wrong when setting up the database.',
		},
	},
};

export default errors;