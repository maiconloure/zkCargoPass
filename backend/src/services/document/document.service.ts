import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { ZkVerifyService } from "../zkverify/zkverify.service"
import { DocumentCreateDto } from "../../dtos/document-create.dto"
import { DocumentVerifyProofDto } from "../../dtos/document-verify-proof.dto"
import { DocumentEntity } from "../../entities/document.entity"

@Injectable()
export class DocumentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly zkVerifyService: ZkVerifyService
  ) {}

  public async createDocument(data: DocumentCreateDto) {
    const document = await this.prismaService.document.create({ data })
    return new DocumentEntity(document)
  }

  public async getDocumentsByUserId(userId: string) {
    const documents = await this.prismaService.document.findMany({ where: { userId } })
    return documents.map(doc => new DocumentEntity(doc))
  }

  public async verifyDocumentProof(data: DocumentVerifyProofDto) {
    // First, verify the document exists
    const document = await this.prismaService.document.findUnique({
      where: { id: data.documentId }
    })

    if (!document) {
      throw new NotFoundException(`Document with ID ${data.documentId} not found`)
    }

    console.log(data)

    // Verify the proof using zkVerify
    const verificationResult = await this.zkVerifyService.verifyProof(
      data.proof,
      data.vk,
      data.publicInputs,
      data.circuitType,
      data.numberOfPublicInputs || 1
    )

    // Optionally, you could save the verification result to the database
    // await this.prismaService.document.update({
    //   where: { id: data.documentId },
    //   data: { 
    //     status: verificationResult.verified ? 'verified' : 'verification_failed',
    //     // Could also save txHash or other verification details
    //   }
    // })

    return {
      documentId: data.documentId,
      document: new DocumentEntity(document),
      verification: verificationResult
    }
  }
} 