import * as TelegramBot from 'node-telegram-bot-api';
import { AdminService } from './admin/admin.service';
import { UserService } from './user/user.service';
import { config } from "dotenv";
import { Injectable, Logger } from '@nestjs/common';

config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CITY = process.env.CITY

interface WeatherResponse {
    weather: {
        description: string;
    }[];
    main: {
        temp: number;
    };
}

@Injectable()
export class TelegramBotService {
    private bot: TelegramBot;
    private subscribedUsers: Set<number> = new Set<number>();

    constructor(private readonly adminService: AdminService, private readonly userService: UserService) {

        this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
        this.registerCommands();
        this.loadSubscribedUsers();
    }

    private registerCommands() {
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const first_name = msg.from.first_name
            this.bot.sendMessage(chatId, `Hi ${first_name}, welcome to the weather bot, you can subscribe by using the /subscribe command, and unsubscribe using /unsubscribe command and /info for weather command.}`)
        })
        this.bot.onText(/\/subscribe/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const username = msg.from.first_name;

            const existingUser = await this.userService.getUserByChatId(chatId);

            if (existingUser) {
                if (existingUser.isBlock) {
                    this.bot.sendMessage(chatId, 'Sorry, you have been blocked by admin');
                } else {
                    this.bot.sendMessage(chatId, 'You are already registered.');
                }
            } else {
                const user = await this.userService.createUser(userId, username);
                if (user) {
                    this.bot.sendMessage(chatId, 'You have been registered.');
                    this.subscribedUsers.add(chatId);
                    this.sendWeatherUpdate(chatId);
                } else {
                    this.bot.sendMessage(chatId, 'Registration failed. Please try again.');
                }
            }
        })
        this.bot.onText(/\/info/, async (msg) => {
            const chatId = msg.chat.id;
            const existingUser = await this.userService.getUserByChatId(chatId);

            if (existingUser) {
                if (existingUser.isBlock) {
                    this.bot.sendMessage(chatId, 'Sorry, you have been blocked by admin');
                    return;
                } else {
                    this.subscribedUsers.add(chatId);
                    this.sendWeatherUpdate(chatId);
                }

            } else {
                this.bot.sendMessage(chatId, 'Sorry you are not subscribed. please subscribed by typing /subscribe');
            }
        })

        this.bot.onText(/\/unsubscribe/, async (msg) => {
            const chatId = msg.chat.id;

            const existingUser = await this.userService.getUserByChatId(chatId);
            if (existingUser) {
                const deletedUser = await this.userService.deleteUser(chatId);
                if (deletedUser) {
                    this.subscribedUsers.delete(chatId);
                    this.bot.sendMessage(chatId, 'You have been unregistered.');
                } else {
                    this.bot.sendMessage(chatId, 'Unregistration failed. Please try again.');
                }
            } else {
                this.bot.sendMessage(chatId, 'You are not registered.');
            }
        });
    }

    private async sendWeatherUpdate(chatId: string) {
        const apiKey = this.adminService.getApiKey();

        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${apiKey}`,
            );

            if (!response.ok) {
                this.bot.sendMessage(chatId, "Something went wrong!");
                Logger.error('Failed to fetch weather data');
                return;
            }
            const data: WeatherResponse = (await response.json()) as WeatherResponse;

            const weatherDescription = data.weather[0]?.description;
            const temperature = (data.main?.temp - 273.15)?.toFixed(2);
            const message = `Weather in ${CITY}:\n${weatherDescription}\nTemperature: ${temperature}°C`;

            this.bot.sendMessage(chatId, message);

        } catch (error) {

        }
    }

    private async loadSubscribedUsers() {
        const users = await this.userService.getUsers();
        users.forEach((user) => {
            this.subscribedUsers.add(user.chatId);
        });
    }

}