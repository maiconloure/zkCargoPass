import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { ZkVerifyService } from "./zkverify.service"

@Module({
  imports: [ConfigModule],
  providers: [ZkVerifyService],
  exports: [ZkVerifyService],
})
export class ZkVerifyServiceModule {}
