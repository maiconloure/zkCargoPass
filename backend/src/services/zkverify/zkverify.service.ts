import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { convertProof, convertVerificationKey } from 'olivmath-ultraplonk-zk-verify'
import { zkVerifySession } from 'zkverifyjs'
import { UltraHonkBackend } from '@aztec/bb.js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { CircuitType } from '../../dtos/document-verify-proof.dto'

@Injectable()
export class ZkVerifyService {
  private readonly logger = new Logger(ZkVerifyService.name)
  private session: any
  private accountInfo: any

  constructor(private readonly configService: ConfigService) {
    this.initializeZkVerify()
  }

  private async initializeZkVerify() {
    try {
      const seed = this.configService.get<string>('zkverify.seed') || process.env.ZK_VERIFY_SEED
      
      if (!seed) {
        this.logger.warn('ZK_VERIFY_SEED not found in config or environment. zkVerify functionality will be disabled.')
        return
      }

      this.session = await zkVerifySession.start().Volta().withAccount(seed)
      this.accountInfo = await this.session.getAccountInfo()

      this.logger.log('✅ zkVerify session initialized successfully:')
      this.logger.log(`  Address: ${this.accountInfo[0].address}`)
      this.logger.log(`  Nonce: ${this.accountInfo[0].nonce}`)
      this.logger.log(`  Free Balance: ${this.accountInfo[0].freeBalance} ACME`)
    } catch (error) {
      this.logger.error('❌ Failed to initialize zkVerify session:', error)
      // Don't exit process, just disable zkVerify functionality
    }
  }

  async verifyProof(
    proof: number[] | Record<string, number>,
    vk: number[] | Record<string, number>,
    publicInputs: string | number | string[] | number[],
    circuitType: CircuitType,
    numberOfPublicInputs: number = 1
  ): Promise<{ verified: boolean; txHash?: string; message: string }> {
    try {
      if (!this.session) {
        throw new Error('zkVerify session not initialized')
      }

      this.logger.log('1. Starting proof verification process')

      // Convert data to Uint8Array - handle both array and object formats
      this.logger.log('2. Converting data to Uint8Array')
      this.logger.log(`Input proof type: ${typeof proof}, is array: ${Array.isArray(proof)}`)
      this.logger.log(`Input vk type: ${typeof vk}, is array: ${Array.isArray(vk)}`)
      this.logger.log(`Input publicInputs: ${JSON.stringify(publicInputs)}`)
      
      // Convert to Uint8Array based on input format
      const proofUint8Array = Array.isArray(proof) 
        ? new Uint8Array(proof)
        : new Uint8Array(Object.values(proof))
      const vkUint8Array = Array.isArray(vk)
        ? new Uint8Array(vk) 
        : new Uint8Array(Object.values(vk))
      
      this.logger.log(`Converted proof length: ${proofUint8Array.length}`)
      this.logger.log(`Converted vk length: ${vkUint8Array.length}`)
      
      // Log first 32 bytes of both for debugging
      this.logger.log(`Raw proof first 32 bytes: ${Array.from(proofUint8Array.slice(0, 32)).join(', ')}`)
      this.logger.log(`Raw vk first 32 bytes: ${Array.from(vkUint8Array.slice(0, 32)).join(', ')}`)

      // Load circuit based on type
      this.logger.log(`3. Loading circuit for type: ${circuitType}`)
      const circuitPath = join(process.cwd(), 'circuits', circuitType, 'target', `${circuitType}.json`)
      
      let circuit: any
      try {
        circuit = JSON.parse(readFileSync(circuitPath, 'utf-8'))
        this.logger.log(`✅ Circuit loaded successfully from: ${circuitPath}`)
        this.logger.log(`Circuit has bytecode: ${!!circuit.bytecode}`)
      } catch (error) {
        this.logger.warn(`Circuit file not found at ${circuitPath}. Skipping local verification.`)
        this.logger.warn(`Error details: ${error.message}`)
        // Continue without local verification
      }

      // Local verification (optional - for debugging purposes only)
      if (circuit && circuit.bytecode) {
        try {
          this.logger.log('4. Performing optional local verification')
          this.logger.log(`Proof length: ${proofUint8Array.length}`)
          this.logger.log(`VK length: ${vkUint8Array.length}`)
          this.logger.log(`Public inputs: ${publicInputs}`)
          this.logger.log(`Public inputs type: ${typeof publicInputs}`)
          
          const backend = new UltraHonkBackend(circuit.bytecode)
          
          // Format public inputs for local verification - must be array of strings
          let publicInputsArray: string[]
          if (Array.isArray(publicInputs)) {
            publicInputsArray = publicInputs.map(String)
          } else {
            publicInputsArray = [String(publicInputs)]
          }
          
          this.logger.log(`Formatted public inputs array: ${JSON.stringify(publicInputsArray)}`)
          
          const localResult = await backend.verifyProof({
            proof: proofUint8Array,
            publicInputs: publicInputsArray,
          })

          this.logger.log(`Local verification result: ${localResult}`)

          if (localResult) {
            this.logger.log('✅ Local verification passed')
          } else {
            this.logger.warn('⚠️ Local verification failed - but continuing with zkVerify verification')
          }
        } catch (localVerificationError) {
          this.logger.warn('⚠️ Local verification threw an error - but continuing with zkVerify verification')
          this.logger.warn(`Local verification error: ${localVerificationError.message}`)
        }
      } else {
        this.logger.log('4. Skipping local verification (no circuit or bytecode available)')
      }

      // Convert proof and vk to hex for zkVerify
      this.logger.log('5. Converting proof and vk to hex')
      this.logger.log(`Proof Uint8Array length: ${proofUint8Array.length}`)
      this.logger.log(`VK Uint8Array length: ${vkUint8Array.length}`)
      this.logger.log(`Number of public inputs: ${numberOfPublicInputs}`)
      
      // Log first few bytes of proof and VK for debugging
      this.logger.log(`Proof first 32 bytes: ${Array.from(proofUint8Array.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join('')}`)
      this.logger.log(`VK first 32 bytes: ${Array.from(vkUint8Array.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join('')}`)
      
      try {
        // Convert proof and VK for zkVerify - numberOfPublicInputs parameter may be required for newer versions
        this.logger.log(`Converting with numberOfPublicInputs: ${numberOfPublicInputs}`)
        const proofHex = convertProof(proofUint8Array, numberOfPublicInputs)
        const vkHex = convertVerificationKey(vkUint8Array)
        
        this.logger.log(`Converted proof hex length: ${proofHex.length}`)
        this.logger.log(`Converted VK hex length: ${vkHex.length}`)
        this.logger.log(`Proof hex first 64 chars: ${proofHex.substring(0, 64)}`)
        this.logger.log(`VK hex first 64 chars: ${vkHex.substring(0, 64)}`)

        // Submit to zkVerify - using the format from reference implementation
        this.logger.log('6. Submitting to zkVerify')
        const { events } = await this.session
          .verify()
          .ultraplonk({ numberOfPublicInputs })
          .execute({
            proofData: {
              vk: vkHex,
              proof: proofHex,
              publicSignals: publicInputs
            },
          })

        // Wait for zkVerify response
        this.logger.log('7. Waiting for zkVerify response')
        return new Promise((resolve, reject) => {
          events.once('includedInBlock', (info: any) => {
            this.logger.log('Transaction included in block:', info)
          })

          events.once('error', (err: any) => {
            this.logger.error('Error in zkVerify transaction:', err)
            reject({
              verified: false,
              message: 'zkVerify transaction failed',
              error: err.message
            })
          })

          events.once('finalized', (data: any) => {
            this.logger.log('8. Proof finalized on zkVerify')
            resolve({
              verified: true,
              txHash: data.txHash,
              message: 'Proof verified successfully on zkVerify!'
            })
          })
        })
      } catch (conversionError) {
        this.logger.error('Error during proof/VK conversion:', conversionError)
        return {
          verified: false,
          message: `Proof/VK conversion failed: ${conversionError.message}`
        }
      }
    } catch (error) {
      this.logger.error('Error in proof verification:', error)
      return {
        verified: false,
        message: `Proof verification failed: ${error.message}`
      }
    }
  }
}
