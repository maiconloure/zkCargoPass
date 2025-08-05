import { Module } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { ZkVerifyServiceModule } from "../zkverify/zkverify-service.module"
import { DocumentService } from "./document.service"

@Module({
  imports: [ZkVerifyServiceModule],
  providers: [DocumentService, PrismaService],
  exports: [DocumentService],
})
export class DocumentServiceModule {} 