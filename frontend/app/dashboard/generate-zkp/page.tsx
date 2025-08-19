"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Upload, AlertCircle, CheckCircle, Download, Lock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { WalletConnect } from "@/components/ui/wallet-connect"
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import { Noir } from "@noir-lang/noir_js"
import { UltraPlonkBackend } from "@aztec/bb.js"
import TaxCircuit from "../../../circuits/tax_validation/target/tax_validation.json"
import DateCircuit from "../../../circuits/date_validation/target/date_validation.json"
import CargoCircuit from "../../../circuits/cargo_validation/target/cargo_validation.json"
import enUS from '../../i18n/locales/en-US.json'
import ptBR from '../../i18n/locales/pt-BR.json'

GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface Document {
  id: string
  name: string
  status: string
  type: string
  size: number
  data: any
  createdAt: string
  deletedAt: string | null
  userId: string
  hash?: string // Optional proof hash
  zkVerifyTxHash?: string // Optional zkVerify transaction hash
  verificationMessage?: string // Optional verification message
}

// Circuit metadata and input mapping
const CIRCUITS = [
  {
    key: "tax",
    label: "Tax Validation",
    circuit: TaxCircuit,
    numberOfPublicInputs: 1,
    getInputs: (doc: Document) => ({
      // Individual tax components (from example.json)
      ii: doc.data?.financial?.taxes?.ii || 0,
      ipi: doc.data?.financial?.taxes?.ipi || 0,
      pis: doc.data?.financial?.taxes?.pis || 0,
      cofins: doc.data?.financial?.taxes?.cofins || 0,
      icms: doc.data?.financial?.taxes?.icms || 0,
      // Total amount paid (public)
      total_amount_paid: doc.data?.financial?.amount_paid || 0,
    }),
  },
  {
    key: "date",
    label: "Date Validation", 
    circuit: DateCircuit,
    numberOfPublicInputs: 2,
    getInputs: (doc: Document) => ({
      // Registration date as days since epoch (private)
      issue_date: doc.data?.date?.registration_date || 0,
      // Current date as days since epoch (public)
      current_date: doc.data?.date?.current_date || 0,
      // Maximum allowed days difference (public)
      max_days_diff: doc.data?.date?.max_days_diff || 365,
    }),
  },
  {
    key: "cargo",
    label: "Cargo Validation",
    circuit: CargoCircuit,
    numberOfPublicInputs: 1,
    getInputs: (doc: Document) => ({
      // First NCM item (from example: 100 × $400 = $40,000)
      quantity1: doc.data?.ncm_codes?.[0]?.quantity || 0,
      unit_value1: doc.data?.ncm_codes?.[0]?.unit_value_usd || 0,
      // Second NCM item (from example: 200 × $20 = $4,000)
      quantity2: doc.data?.ncm_codes?.[1]?.quantity || 0,
      unit_value2: doc.data?.ncm_codes?.[1]?.unit_value_usd || 0,
      // Total declared value (public)
      total_declared_value: doc.data?.financial?.total_declared_value || 0,
    }),
  },
]

export default function GenerateZKPPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState("")
  const [language, setLanguage] = useState(localStorage.getItem("zk-cargo-pass-language") || "en-US")
  const [selectedCircuitKey, setSelectedCircuitKey] = useState<string>(CIRCUITS[0].key)
  const [generating, setGenerating] = useState(false)
  const [generatedProof, setGeneratedProof] = useState<string>("")
  const [documentId, setDocumentId] = useState<string>("") // Add state for documentId
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [proofData, setProofData] = useState<{
    proof: Uint8Array | null;
    vk: Uint8Array | null;
    publicInputs: any;
  }>({ proof: null, vk: null, publicInputs: null })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const translations = language === 'en-US' ? enUS : ptBR

  useEffect(() => {
    localStorage.setItem("zk-cargo-pass-language", language)
  }, [language])

  const verifyProofWithBackend = async (documentId: string, circuitKey?: string) => {
    console.log("Verifying proof with backend for document ID:", documentId)
    // Check if proof data is complete
    console.log("Proof data:", proofData)
    if (!proofData.proof || !proofData.vk || proofData.publicInputs === null) {
      setError("Proof data is incomplete for verification")
      return
    }

    // Use provided circuitKey or fall back to selectedCircuitKey
    const circuitType = (circuitKey || selectedCircuitKey) + '_validation'
    
    // Get the selected circuit to determine number of public inputs
    const selectedCircuit = CIRCUITS.find(c => c.key === (circuitKey || selectedCircuitKey))
    const numberOfPublicInputs = selectedCircuit?.numberOfPublicInputs || 1

    setVerifying(true)
    setError("")

    try {
      // Format data to match reference implementation
      const requestBody = {
        documentId,
        // Convert to array format like reference implementation
        proof: Array.from(proofData.proof),
        vk: Array.from(proofData.vk),
        // For reference compatibility, send first public input as single value if only one
        publicInputs: numberOfPublicInputs === 1 
          ? (Array.isArray(proofData.publicInputs) ? proofData.publicInputs[0] : proofData.publicInputs)
          : proofData.publicInputs,
        circuitType: circuitType,
        numberOfPublicInputs: numberOfPublicInputs
      }

      console.log('Sending proof verification request:', {
        ...requestBody,
        proof: `Array[${requestBody.proof.length}]`,
        vk: `Array[${requestBody.vk.length}]`
      })

      const response = await fetch('/api/document/verify-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication if needed
          // 'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
        credentials: 'include' // Include cookies for session-based authentication
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setVerificationResult(result)

      if (result.verification.verified) {
        toast({
          title: "✅ Proof Verified Successfully!",
          description: `Transaction Hash: ${result.verification.txHash}`,
        })

        // Update document status in localStorage
        const documents = JSON.parse(localStorage.getItem("zk-cargo-pass-documents") || "[]")
        const updatedDocuments = documents.map((doc: Document) => {
          if (doc.id === documentId) {
            return {
              ...doc,
              status: "zkverify_verified",
              zkVerifyTxHash: result.verification.txHash,
              verificationMessage: result.verification.message
            }
          }
          return doc
        })
        localStorage.setItem("zk-cargo-pass-documents", JSON.stringify(updatedDocuments))

        // Update stats
        const storedStats = localStorage.getItem("zk-cargo-pass-stats")
        const stats = storedStats ? JSON.parse(storedStats) : {
          documentsUploaded: 0,
          zkProofsGenerated: 0,
          validatedSubmissions: 0,
          pendingSubmissions: 0,
        }
        stats.validatedSubmissions += 1
        if (stats.pendingSubmissions > 0) {
          stats.pendingSubmissions -= 1
        }
        localStorage.setItem("zk-cargo-pass-stats", JSON.stringify(stats))
      } else {
        toast({
          title: "❌ Proof Verification Failed",
          description: result.verification.message,
          variant: "destructive"
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during verification"
      setError(`Verification failed: ${errorMessage}`)
      console.error("Verification error:", err)
    } finally {
      setVerifying(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]

    if (!selectedFile) {
      setFile(null)
      return
    }

    const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase()
    if (!["pdf"].includes(fileExtension || "")) {
      setError("Only .pdf files are supported")
      setFile(null)
      return
    }

    setFile(selectedFile)
    setError("")
    // Reset proof and verification states
    setGeneratedProof("")
    setVerificationResult(null)
    setProofData({ proof: null, vk: null, publicInputs: null })
  }

  const handleClearForm = () => {
    setFile(null)
    setUploadSuccess(false)
    setError("")
    setGeneratedProof("")
    setDocumentId("") // Reset documentId
    setVerificationResult(null)
    setProofData({ proof: null, vk: null, publicInputs: null })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUploadAndGenerate = async () => {
    if (!file) {
      setError("Please select a file to upload")
      return
    }

    setUploading(true)
    setError("")

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfData = new Uint8Array(arrayBuffer)
      const loadingTask = getDocument({ data: pdfData })
      const pdf = await loadingTask.promise
      
      let extractedText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        extractedText += pageText + '\n\n'
      }

      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        status: 'pending',
        data: extractedText.trim(),
        userId: localStorage.getItem("zk-cargo-pass-user-id") || ""
      }

      const response = await fetch('/api/analyze-document', {
        method: 'POST',
        body: JSON.stringify(fileData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload document')
      }

      const analysisData = await response.json()

      console.log(analysisData)
      // Use the document ID returned from the backend instead of generating one locally
      const documentId = analysisData.documentId || Date.now().toString() // Fallback to timestamp if not provided
      console.log("Document ID from backend:", documentId)
      setDocumentId(documentId) // Store documentId in state for use in download function
      
      const documents = JSON.parse(localStorage.getItem("zk-cargo-pass-documents") || "[]")
      const newDocument = {
        id: documentId, // Use the backend-provided document ID
        name: file.name,
        status: "pending",
        type: file.type,
        size: file.size,
        data: analysisData.data,
        createdAt: new Date().toISOString(),
        deletedAt: null,
        userId: localStorage.getItem("zk-cargo-pass-user-id") || "",
      }
      documents.push(newDocument)
      localStorage.setItem("zk-cargo-pass-documents", JSON.stringify(documents))

      // Update stats
      const storedStats = localStorage.getItem("zk-cargo-pass-stats")
      const stats = storedStats
        ? JSON.parse(storedStats)
        : {
            documentsUploaded: 0,
            zkProofsGenerated: 0,
            validatedSubmissions: 0,
            pendingSubmissions: 0,
          }
      stats.documentsUploaded += 1
      stats.pendingSubmissions += 1
      localStorage.setItem("zk-cargo-pass-stats", JSON.stringify(stats))

      setUploadSuccess(true)
      toast({
        title: translations.documentUpload.success,
        description: translations.documentUpload.success,
      })

      // Generate ZKP
      setGenerating(true)
      try {
        const selectedCircuit = CIRCUITS.find(c => c.key === selectedCircuitKey)
        if (!selectedCircuit) {
          throw new Error("Circuit not found")
        }
        const circuit = selectedCircuit.circuit as any
        const noir = new Noir(circuit)
        const backend = new UltraPlonkBackend(circuit.bytecode)
        
        const inputs = selectedCircuit.getInputs(newDocument)
        const { witness } = await noir.execute(inputs)
        const { proof, publicInputs } = await backend.generateProof(witness)
        const vk = await backend.getVerificationKey()

        // Store proof data for verification
        const publicInputsToStore = selectedCircuit.numberOfPublicInputs === 1 
          ? publicInputs[0] 
          : publicInputs.slice(0, selectedCircuit.numberOfPublicInputs)
          
        setProofData({
          proof: new Uint8Array(proof),
          vk: new Uint8Array(vk),
          publicInputs: publicInputsToStore
        })

        const proofHex = Array.from(new Uint8Array(proof))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
        
        setGeneratedProof(proofHex)

        const updatedDocuments = documents.map((doc: Document) => {
          if (doc.id === documentId) {
            return {
              ...doc,
              hash: proofHex,
              status: "proof_generated",
            }
          }
          return doc
        })
        localStorage.setItem("zk-cargo-pass-documents", JSON.stringify(updatedDocuments))
        
        // Update stats
        stats.zkProofsGenerated += 1
        localStorage.setItem("zk-cargo-pass-stats", JSON.stringify(stats))
        
        toast({
          title: translations.generateZKP.success,
          description: `Proof: ${proofHex.substring(0, 10)}...${proofHex.substring(proofHex.length - 6)}`,
        })

        // Auto-verify the proof with zkVerify
        // setTimeout(() => {
        //   verifyProofWithBackend(documentId, selectedCircuitKey)
        // }, 1000)

      } catch (err) {
        console.error(err)
        setError(translations.generateZKP.error)
        setGeneratedProof("")
        setProofData({ proof: null, vk: null, publicInputs: null })
      } finally {
        setGenerating(false)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while processing the file")
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadProof = () => {
    if (!generatedProof) return
    
    const proofData = {
      documentId: generatedProof,
      documentName: file?.name || "unknown",
      proof: generatedProof,
      verification: verificationResult ? {
        verified: verificationResult.verification.verified,
        txHash: verificationResult.verification.txHash,
        message: verificationResult.verification.message,
        zkVerifyNetwork: "Volta" // Based on the zkVerify service configuration
      } : null,
      timestamp: new Date().toISOString(),
      circuit: selectedCircuitKey,
    }

    const blob = new Blob([JSON.stringify(proofData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zk-proof-${file?.name}-${documentId || new Date().getTime()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end p-4">
        <button onClick={() => setLanguage('en-US')} className={`px-4 py-2 ${language === 'en-US' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>EN</button>
        <button onClick={() => setLanguage('pt-BR')} className={`px-4 py-2 ${language === 'pt-BR' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>PT</button>
        <div className="flex justify-end p-4"></div>
        <WalletConnect />
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{translations.generateZKP.title}</h1>
        <p className="text-gray-500">{translations.generateZKP.subtitle}</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{translations.generateZKP.cardTitle}</CardTitle>
          <CardDescription>{translations.generateZKP.cardDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {uploadSuccess && !verificationResult && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Document Processed Successfully</AlertTitle>
              <AlertDescription>
                {generatedProof 
                  ? "Proof generated successfully. Verification is in progress..." 
                  : "Document uploaded and analyzed. Generating proof..."
                }
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">{translations.documentUpload.selectFile}</Label>
              <Input
                id="file"
                type="file"
                className="cursor-pointer"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                disabled={uploading || generating || verifying}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="circuit">Select Circuit</Label>
              <Select
                value={selectedCircuitKey}
                onValueChange={setSelectedCircuitKey}
                disabled={uploading || generating || verifying}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a circuit" />
                </SelectTrigger>
                <SelectContent>
                  {CIRCUITS.map((circuit) => (
                    <SelectItem key={circuit.key} value={circuit.key}>
                      {circuit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {file && (
              <div className={`p-4 rounded-md border-2 ${
                uploadSuccess 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-2">
                  <FileText className={`h-5 w-5 ${
                    uploadSuccess ? 'text-green-600' : 'text-gray-500'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB • {file.type || "Unknown type"}
                    </p>
                  </div>
                  {uploadSuccess && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </div>
            )}

            {generatedProof && (
              <div className="space-y-4">
                <Label>Generated Proof</Label>
                <Textarea
                  value={generatedProof}
                  readOnly
                  className="font-mono text-sm"
                  rows={4}
                />
                
                {/* Verification Status */}
                {verifying && (
                  <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                    <Lock className="h-4 w-4 animate-spin text-blue-600" />
                    <AlertTitle>Verifying with zkVerify</AlertTitle>
                    <AlertDescription>
                      Submitting proof to zkVerify network for verification...
                    </AlertDescription>
                  </Alert>
                )}

                {verificationResult && (
                  <Alert className={verificationResult.verification.verified 
                    ? "bg-green-50 text-green-800 border-green-200" 
                    : "bg-red-50 text-red-800 border-red-200"
                  }>
                    <CheckCircle className={`h-4 w-4 ${verificationResult.verification.verified 
                      ? 'text-green-600' 
                      : 'text-red-600'
                    }`} />
                    <AlertTitle>
                      {verificationResult.verification.verified 
                        ? '✅ zkVerify Verification Successful' 
                        : '❌ zkVerify Verification Failed'
                      }
                    </AlertTitle>
                    <AlertDescription>
                      <div className="space-y-1">
                        <p>{verificationResult.verification.message}</p>
                        {verificationResult.verification.txHash && (
                          <p className="font-mono text-xs">
                            TX Hash: {verificationResult.verification.txHash}
                          </p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleDownloadProof}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Proof {verificationResult?.verification.verified && '& Verification'}
                  </Button>
                  
                  {!verificationResult && !verifying && proofData.proof && (
                    <Button
                      onClick={() => {
                        const documents = JSON.parse(localStorage.getItem("zk-cargo-pass-documents") || "[]")
                        const currentDoc = documents.find((doc: Document) => doc.hash === generatedProof)
                        if (currentDoc) {
                          verifyProofWithBackend(currentDoc.id, selectedCircuitKey)
                        }
                      }}
                      variant="default"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Verify with zkVerify
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={handleUploadAndGenerate}
            disabled={!file || uploading || generating || verifying}
            className="bg-green-600 hover:bg-green-700 flex-1"
          >
            {uploading ? (
              <>
                <Lock className="mr-2 h-4 w-4 animate-spin" />
                {translations.documentUpload.uploading}
              </>
            ) : generating ? (
              <>
                <Lock className="mr-2 h-4 w-4 animate-spin" />
                {translations.generateZKP.generating}
              </>
            ) : verifying ? (
              <>
                <Lock className="mr-2 h-4 w-4 animate-spin" />
                Verifying with zkVerify...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {uploadSuccess ? "Generate Another Proof" : "Upload & Generate Proof"}
              </>
            )}
          </Button>
          
          {(file || uploadSuccess || generatedProof) && (
            <Button
              onClick={handleClearForm}
              variant="outline"
              disabled={uploading || generating || verifying}
              className="px-6"
            >
              Clear
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{translations.documentUpload.guidelines.title}</CardTitle>
          <CardDescription>{translations.documentUpload.guidelines.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>{translations.documentUpload.guidelines.format}</li>
            <li>{translations.documentUpload.guidelines.size}</li>
            <li>{translations.documentUpload.guidelines.info}</li>
            <li>{translations.documentUpload.guidelines.security}</li>
            <li>{translations.documentUpload.guidelines.nextStep}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
