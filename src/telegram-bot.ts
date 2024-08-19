import * as TelegramBot from 'node-telegram-bot-api';
import { AdminService } from './admin/admin.service';
import { UserService } from './user/user.service';
import { config } from 'dotenv';
import { Injectable, Logger } from '@nestjs/common';

config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY;
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

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

    constructor(
        private readonly adminService: AdminService,
        private readonly userService: UserService,
    ) {
        this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
        this.registerCommands();
        this.loadSubscribedUsers();
        this.bot.on('polling_error', (error) => {
            Logger.error(`Polling error: ${error.code} - ${error.message}`);
        });
    }

    private registerCommands() {
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const firstName = msg.from.first_name;
            this.bot.sendMessage(
                chatId,
                `Hi ${firstName}, welcome to the weather bot! You can subscribe by using the /subscribe command, unsubscribe using /unsubscribe, and check the weather using /info.`
            );
        });

        this.bot.onText(/\/subscribe/, async (msg) => {
            const chatId = msg.chat.id;
            const existingUser = await this.userService.getUserByChatId(chatId);

            if (existingUser) {
                if (existingUser.isBlock) {
                    this.bot.sendMessage(chatId, 'Sorry, you have been blocked by the admin.');
                } else {
                    this.bot.sendMessage(chatId, 'You are already registered.');
                }
            } else {
                this.promptLocationSharing(chatId);
            }
        });

        this.bot.on('location', async (msg) => {
            const chatId = msg.chat.id;
            const { latitude, longitude } = msg.location;

            const city = await this.getCityFromCoordinates(latitude, longitude);
            if (city === 'Unknown location') {
                this.bot.sendMessage(chatId, 'Sorry, we could not determine your city from the location provided.');
                return;
            }

            const user = await this.userService.createUser(msg.from.id, msg.from.first_name);
            if (user) {
                this.bot.sendMessage(chatId, `You have been registered. Weather updates for ${city} will be provided.`);
                this.subscribedUsers.add(chatId);
                this.sendWeatherUpdate(chatId, city);
            } else {
                this.bot.sendMessage(chatId, 'Registration failed. Please try again.');
            }
        });

        this.bot.onText(/\/info/, async (msg) => {
            const chatId = msg.chat.id;
            const existingUser = await this.userService.getUserByChatId(chatId);

            if (existingUser) {
                if (existingUser.isBlock) {
                    this.bot.sendMessage(chatId, 'Sorry, you have been blocked by the admin.');
                } else {
                    this.promptLocationSharing(chatId);
                }
            } else {
                this.bot.sendMessage(chatId, 'Sorry, you are not subscribed. Please subscribe by typing /subscribe.');
            }
        });

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

    private async getCityFromCoordinates(lat: number, lon: number): Promise<string> {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat},${lon}&key=${GEOCODING_API_KEY}`;
        
        try {
            const response = await fetch(url);

            if (!response.ok) {
                Logger.error(`Failed to fetch city name. HTTP Status: ${response.status}`);
                throw new Error(`Failed to fetch city name. HTTP Status: ${response.status}`);
            }

            const data = await response.json();
            const cityName = data.results?.[0]?.components?.city || 'Unknown location';
            Logger.log(`City found: ${cityName}`);
            return cityName;
        } catch (error) {
            Logger.error(`Error fetching city name: ${error.message}`);
            return 'Unknown location';
        }
    }

    private async sendWeatherUpdate(chatId: number, city: string) {
        const apiKey = this.adminService.getApiKey();

        try {
            const response = await fetch(
                `${WEATHER_API_URL}?q=${city}&appid=${apiKey}`
            );

            if (!response.ok) {
                this.bot.sendMessage(chatId, "Something went wrong!");
                Logger.error('Failed to fetch weather data');
                return;
            }

            const data: WeatherResponse = await response.json();
            const weatherDescription = data.weather[0]?.description || 'No description available';
            const temperature = (data.main?.temp - 273.15)?.toFixed(2) || 'N/A';
            const message = `Weather in ${city}:\n${weatherDescription}\nTemperature: ${temperature}°C`;

            this.bot.sendMessage(chatId, message);
        } catch (error) {
            Logger.error('Error sending weather update: ', error.message);
            this.bot.sendMessage(chatId, "Failed to fetch weather data");
        }
    }

    private async loadSubscribedUsers() {
        try {
            const users = await this.userService.getUsers();
            users.forEach((user) => {
                this.subscribedUsers.add(user.chatId);
            });
        } catch (error) {
            Logger.error('Error loading subscribed users:', error.message);
        }
    }

    private promptLocationSharing(chatId: number) {
        this.bot.sendMessage(chatId, 'Please share your location to get the weather update.', {
            reply_markup: {
                one_time_keyboard: true,
                keyboard: [
                    [
                        {
                            text: 'Share Location',
                            request_location: true,
                        },
                    ],
                ],
            },
        });
    }
}
