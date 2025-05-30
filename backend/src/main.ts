import { ClassSerializerInterceptor, Logger, ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory, Reflector } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { HttpExceptionFilter } from "./utils/http-exception-filter"

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    snapshot: true,
    rawBody: true,
    bodyParser: true,
  })

  const UI_BASE_URL = process.env.UI_BASE_URL

  // Enable CORS for frontend
  app.enableCors({
    origin: [UI_BASE_URL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  })

  // Enable class interceptor and validation pipe
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))

  // Swagger configuration
  const options = new DocumentBuilder()
    .setTitle('zkCargoPass API')
    .setDescription(`The zkCargoPass API service used by [zkCargoPass](${UI_BASE_URL})`)
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('auth.sessionId')
    .build()

  const document = SwaggerModule.createDocument(app, options)
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      tagsSorter: 'alpha',
    },
  })

  app.useGlobalFilters(new HttpExceptionFilter())

  const port = process.env.PORT || 3001
  await app.listen(port)
  Logger.log(`🚀 zkCargoPass backend is running on: http://localhost:${port}/`)
}

bootstrap().catch((error) => console.error(error))
