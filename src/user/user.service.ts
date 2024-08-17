/* eslint-disable prettier/prettier */
// user/user.service.ts

import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async createUser(chatId: number, username: string): Promise<User> {    
    const user = new this.userModel({ chatId, username });
    return user.save();
  }

  async blockUser(chatId: number): Promise<User | null> {    
    const user = await this.userModel.findOneAndUpdate({chatId: chatId}, {isBlock: true}).exec();
    return user;
  }

  async unBlockUser(chatId: number): Promise<User | null> {    
    const user = await this.userModel.findOneAndUpdate({chatId: chatId}, {isBlock: false}).exec();
    return user;
  }

  async deleteUser(chatId: number): Promise<User | null> {
    return this.userModel.findOneAndDelete({ chatId }).exec();
  }

  async getUsers(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async getUserByChatId(chatId: number): Promise<User | null> {
    return this.userModel.findOne({ chatId }).exec();
  }

}
