// src/common/services/encryption.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('ENCRYPTION_SECRET_KEY');
  }

  /**
   * Encrypts any value (string, number, object) into a cipher string
   */
  encrypt<T = unknown>(value: T): string {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    return CryptoJS.AES.encrypt(stringValue, this.secretKey).toString();
  }

  /**
   * Decrypts a cipher string back to its original string form
   */
  decrypt(cipherText: string): string {
    const bytes = CryptoJS.AES.decrypt(cipherText, this.secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}