import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	const config = new DocumentBuilder()
		.setTitle('NEW SHINJI MEGA PONG ULTIMATE API')
		.setDescription('API reference sheet')
		.setVersion('0.1')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('/', app, document);

	await app.listen(3000);
}
bootstrap();
