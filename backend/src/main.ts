import { NestFactory } from "@nestjs/core";
import { json, urlencoded, type Request as ExpressRequest } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({
    limit: "8mb",
    verify(request, _response, buffer) {
      (request as ExpressRequest & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }));
  app.use(urlencoded({ extended: true, limit: "8mb" }));

  app.enableCors({
    origin: "https://www.jaipurstore.tech",
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix("api");

  await app.listen(process.env.PORT || 4000);

  console.log("");
  console.log("======================================");
  console.log("  HexaWave Backend");
  console.log("  http://localhost:4000");
  console.log("  API: http://localhost:4000/api");
  console.log("======================================");
  console.log("");
}

void bootstrap().catch((error: unknown) => {
  console.error("Failed to start HexaWave backend.", error);
  process.exitCode = 1;
});
