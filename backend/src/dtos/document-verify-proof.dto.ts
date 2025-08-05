import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsString, IsObject, IsNumber, IsIn } from "class-validator"

export enum CircuitType {
  CARGO_VALIDATION = 'cargo_validation',
  DATE_VALIDATION = 'date_validation',
  TAX_VALIDATION = 'tax_validation'
}

export class DocumentVerifyProofDto {
  @ApiProperty({ description: 'The document ID to verify' })
  @IsNotEmpty()
  @IsString()
  documentId: string

  @ApiProperty({ description: 'The proof data as Uint8Array (array or object format)' })
  @IsNotEmpty()
  proof: number[] | Record<string, number>

  @ApiProperty({ description: 'The verification key as Uint8Array (array or object format)' })
  @IsNotEmpty()
  vk: number[] | Record<string, number>

  @ApiProperty({ description: 'The public inputs for the proof (single value or array)' })
  @IsNotEmpty()
  publicInputs: string | number | string[] | number[]

  @ApiProperty({ 
    description: 'The circuit type', 
    enum: CircuitType,
    example: CircuitType.CARGO_VALIDATION 
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(Object.values(CircuitType))
  circuitType: CircuitType

  @ApiProperty({ description: 'Number of public inputs', default: 1 })
  @IsNumber()
  numberOfPublicInputs?: number = 1
}
