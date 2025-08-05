import { Body, Controller, HttpStatus, Post, Query, Get } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { DocumentCreateDto } from "../../dtos/document-create.dto"
import { DocumentVerifyProofDto } from "../../dtos/document-verify-proof.dto"
import { DocumentEntity } from "../../entities/document.entity"
import { DocumentService } from "../../services/document/document.service"
import { Public } from "../../services/auth/decorators/public.decorator"

@ApiBearerAuth()
@ApiTags('document')
@Controller('document')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @ApiOperation({ summary: 'Creates a new document' })
  @ApiResponse({ status: HttpStatus.OK, type: DocumentEntity })
  public async create(@Body() data: DocumentCreateDto) {
    return await this.documentService.createDocument(data)
  }

  @Get()
  @ApiOperation({ summary: 'Lists all documents by userId' })
  @ApiResponse({ status: HttpStatus.OK, type: [DocumentEntity] })
  public async listByUserId(@Query('userId') userId: string) {
    return await this.documentService.getDocumentsByUserId(userId)
  }

  @Post('verify-proof')
  @Public() // Make this endpoint public for now
  @ApiOperation({ summary: 'Verifies a document proof using zkVerify' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Proof verification result',
    schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        document: { $ref: '#/components/schemas/DocumentEntity' },
        verification: {
          type: 'object',
          properties: {
            verified: { type: 'boolean' },
            txHash: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid proof data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Verification failed' })
  public async verifyProof(@Body() data: DocumentVerifyProofDto) {
    return await this.documentService.verifyDocumentProof(data)
  }
} 