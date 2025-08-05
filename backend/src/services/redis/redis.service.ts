import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import Redis from "ioredis"

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)

  constructor(private readonly configService: ConfigService) {
    const url = configService.get('redis.url')

    if (!url) {
      throw new Error('missing "redis.url" config')
    }

    super(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
      reconnectOnError: (err) => {
        const targetError = 'READONLY'
        return err.message.includes(targetError)
      },
      // Add some additional connection options for better stability
      connectTimeout: 10000,
      commandTimeout: 5000,
    })

    // Handle connection events
    this.on('connect', () => {
      this.logger.log('Redis connected')
    })

    this.on('ready', () => {
      this.logger.log('Redis ready')
    })

    this.on('error', (err) => {
      this.logger.error('Redis error:', err.message)
      // Don't throw the error, just log it to prevent application crash
    })

    this.on('close', () => {
      this.logger.warn('Redis connection closed')
    })

    this.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...')
    })

    this.on('end', () => {
      this.logger.warn('Redis connection ended')
    })

    // Connect on startup with retry logic
    this.connectWithRetry()
  }

  private async connectWithRetry(retries = 5) {
    try {
      await this.connect()
      this.logger.log('Redis connected successfully')
    } catch (err) {
      this.logger.error(`Failed to connect to Redis (attempt ${6 - retries}/5):`, err.message)
      if (retries > 1) {
        setTimeout(() => this.connectWithRetry(retries - 1), 5000)
      } else {
        this.logger.error('Max Redis connection retries reached. Application will continue without Redis.')
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.quit()
      this.logger.log('Redis connection closed gracefully')
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error)
    }
  }
}
