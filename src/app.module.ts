import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminController } from './admin/admin.controller';
import { UserModule } from './user/user.module';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './admin/admin.module';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { AdminService } from './admin/admin.service';
import { TelegramBotService } from './telegram-bot';
config();
@Module({
  imports: [AdminModule, UserModule,DatabaseModule,MongooseModule.forRootAsync({
    useFactory: () => ({
      uri: process.env.DATABASE_CONNECTION_STRING,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }),
  }),
  UserModule,],
  controllers: [AppController, AdminController],
  providers: [AppService, AdminService, TelegramBotService],
})
export class AppModule { }
