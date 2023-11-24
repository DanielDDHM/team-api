const messages = {
	newConsultation: {
		title: {
			pt: `Nova consulta`,
			en: `New consultation`,
		},
		message: function(currentDay, userName) {
			return {
				pt: `Recebeu uma nova consulta para ${currentDay} para o paciente ${userName}`,
				en: `You've received a new consultation to ${currentDay} for the patient ${userName}`,
			};
		},
	},
	consultationChangeDate: {
		title: {
			pt: `Alteração à consulta`,
			en: `Consultation change`,
		},
		message: function(currentDay, newDay) {
			return {
				pt: `A consulta de dia ${currentDay} passou para o dia ${newDay}`,
				en: `The consultation on ${currentDay} have changed to the day ${newDay}`,
			};
		},
	},
	consultationCancelled: {
		title: {
			pt: `Consulta cancelada`,
			en: `Consultation cancelled`,
		},
		message: function(currentDay) {
			return {
				pt: `A consulta no dia ${currentDay} foi cancelada`,
				en: `The consultation on ${currentDay} was cancelled`,
			};
		},
	},
	consultationVideoStarted: {
		title: {
			pt: `Consulta Virtual Iniciada`,
			en: `Virtual Consultation Started`,
		},
		message: function(userName, userType) {
			return {
				pt: `O ${userType === 'user' ? 'paciente' : 'psicólogo'} ${userName} já iniciou a consulta virtual`,
				en: `The ${userType === 'user' ? 'user' : 'psychologist'} ${userName} already started the virtual consultation`,
			};
		},
	},
	consultationReminder: {
		title: {
			pt: `Consulta em breve`,
			en: `Consultation Soon`,
		},
		message: function(userName, userType, currentDay) {
			return {
				pt: `Irá ter uma consulta hoje às ${currentDay} com o ${userType === 'user' ? 'paciente' : 'psicólogo'} ${userName}`,
				en: `You will have a consultation today at ${currentDay} with the ${userType === 'user' ? 'user' : 'psychologist'} ${userName}`,
			};
		},
	},
};

export default messages;