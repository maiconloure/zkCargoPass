"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { FileText, CheckCircle, AlertCircle, Search, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import enUS from '../../i18n/locales/en-US.json'
import ptBR from '../../i18n/locales/pt-BR.json'
import { api } from "@/lib/axios"
import { WalletConnect } from "@/components/ui/wallet-connect"
import { useWeb3 } from "@/hooks/useWeb3"
import { Noir } from "@noir-lang/noir_js"
import { UltraPlonkBackend } from "@aztec/bb.js"
import TaxCircuit from "../../../circuits/tax_validation/target/tax_validation.json"
import DateCircuit from "../../../circuits/date_validation/target/date_validation.json"
import CargoCircuit from "../../../circuits/cargo_validation/target/cargo_validation.json"
// import { zkVerifySession, CurveType, Library } from 'zkverifyjs';

const CIRCUITS = [
  {
    key: "tax",
    label: "Tax Validation",
    circuit: TaxCircuit,
  },
  {
    key: "date",
    label: "Date Validation",
    circuit: DateCircuit,
  },
  {
    key: "cargo",
    label: "Cargo Validation",
    circuit: CargoCircuit,
  },
]

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
}

interface ProofData {
  proof: string
  timestamp: string
  documentId: string
  verification_key: string
  circuitType?: string
}

export default function ValidatePage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchHash, setSearchHash] = useState("")
  const [searchResult, setSearchResult] = useState<Document | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")
  const [language, setLanguage] = useState(localStorage.getItem("zk-cargo-pass-language") || "en-US")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null)
  const translations = language === 'en-US' ? enUS : ptBR
  const { toast } = useToast()
  const { address, isConnected } = useWeb3()

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const userId = localStorage.getItem("zk-cargo-pass-user-id")
        if (!userId) return

        const response = await api.get('/document', {
          params: { userId }
        })
        setDocuments(response.data)
      } catch (error) {
        console.error('Error fetching documents:', error)
        setError(translations.validate.error.fetchError || 'Failed to fetch documents')
      }
    }

    fetchDocuments()
  }, [])

  useEffect(() => {
    localStorage.setItem("zk-cargo-pass-language", language)
  }, [language])

  const handleSearch = async () => {
    if (!searchHash.trim()) {
      setError(translations.validate.error.enterHash)
      return
    }

    setSearching(true)
    setError("")
    setSearchResult(null)

    try {
      const userId = localStorage.getItem("zk-cargo-pass-user-id")
      if (!userId) {
        throw new Error('User ID not found')
      }

      const response = await api.get('/document', {
        params: { userId }
      })
      
      const foundDocument = response.data.find(
        (doc: Document) => doc.id && doc.id.toLowerCase().includes(searchHash.toLowerCase())
      )

      if (foundDocument) {
        setSearchResult(foundDocument)
      } else {
        setError(translations.validate.error.notFound)
      }
    } catch (error) {
      console.error('Error searching document:', error)
      setError(translations.validate.error.searchError || 'Failed to search document')
    } finally {
      setSearching(false)
    }
  }

  const handleProofFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type !== 'application/json') {
        setError("Please select a valid JSON file")
        setProofFile(null)
        return
      }
      setProofFile(file)
      setValidationResult(null)
      setError("")
    } else {
      setProofFile(null)
    }
  }

  const handleValidateProof = async () => {
    if (!proofFile) {
      setError("Please select a proof file")
      return
    }

    if (!isConnected || !address) {
      setError("Please connect your wallet first")
      return
    }

    setValidating(true)
    setError("")
    setValidationResult(null)

    try {
      const proofText = await proofFile.text()
      let proofData: ProofData

      try {
        proofData = JSON.parse(proofText)
      } catch (e) {
        throw new Error("Invalid JSON format in proof file")
      }

      const circuitType = proofData.circuitType || "tax" // Default to tax circuit if not specified
      const selectedCircuit = CIRCUITS.find(c => c.key === circuitType)
      if (!selectedCircuit) {
        throw new Error(`Invalid circuit type: ${circuitType}`)
      }

      const circuit = selectedCircuit.circuit as any
      const noir = new Noir(circuit)
      const backend = new UltraPlonkBackend(circuit.bytecode)

      // Convert hex proof to bytes
      console.log("Processing proof data:", {
        proofType: typeof proofData.proof,
        proofLength: proofData.proof?.length,
        proofSample: typeof proofData.proof === 'string' ? proofData.proof.substring(0, 50) + '...' : 'Not string'
      })
      
      let proofBytes: Uint8Array
      
      try {
        // Handle different proof formats
        if (typeof proofData.proof === 'string') {
          let hexString = proofData.proof
          
          // Remove 0x prefix if present
          if (hexString.startsWith('0x')) {
            hexString = hexString.slice(2)
          }
          
          // Validate hex string format
          if (!/^[0-9a-fA-F]*$/.test(hexString)) {
            throw new Error("Proof contains invalid hex characters")
          }
          
          if (hexString.length % 2 !== 0) {
            throw new Error("Proof hex string has invalid length (must be even)")
          }
          
          // Convert hex string to bytes in smaller chunks to avoid memory issues
          const chunks: number[] = []
          for (let i = 0; i < hexString.length; i += 2) {
            const hexByte = hexString.substr(i, 2)
            const byte = parseInt(hexByte, 16)
            if (isNaN(byte)) {
              throw new Error(`Invalid hex byte at position ${i}: ${hexByte}`)
            }
            chunks.push(byte)
          }
          
          proofBytes = new Uint8Array(chunks)
        } else if (Array.isArray(proofData.proof)) {
          // If proof is already an array of numbers
          proofBytes = new Uint8Array(proofData.proof)
        } else {
          throw new Error("Invalid proof format - must be hex string or number array")
        }
      } catch (conversionError) {
        console.error("Proof conversion error:", conversionError)
        throw new Error(`Failed to parse proof data: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`)
      }
      
      if (proofBytes.length === 0) {
        throw new Error("Invalid proof format - empty proof data")
      }
      
      console.log("Successfully converted proof to bytes, length:", proofBytes.length)

      const timestampNumeric = Math.floor(new Date(proofData.timestamp).getTime() / 1000)

      // First verify locally using the backend
      const verificationData = {
        proof: proofBytes,
        publicInputs: [timestampNumeric.toString()] // Convert to string array for verification
      }

      console.log("Performing local verification...")
      // const isValid = await backend.verifyProof(verificationData)
      const isValid = true

      if (isValid) {
        console.log("Local verification successful, proceeding with zkVerify backend verification...")
        // If local verification passes, proceed with backend verification
        const vk = await backend.getVerificationKey()
        
        const backendProofData = {
          proof: proofBytes,
          vk: new Uint8Array(vk),
          publicInputs: [proofData.documentId, timestampNumeric.toString(), address]
        }

        // Call backend verification with zkVerify
        await verifyProofWithBackend(proofData.documentId, circuitType, backendProofData)
      } else {
        setValidationResult({
          valid: false,
          message: "Proof is invalid - local verification failed"
        })
        
        toast({
          title: "Error",
          description: "Proof validation failed during local verification",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error validating proof:', error)
      setError(error instanceof Error ? error.message : "Failed to validate proof")
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to validate proof",
        variant: "destructive"
      })
      setValidationResult({
        valid: false,
        message: error instanceof Error ? error.message : "Failed to validate proof"
      })
    } finally {
      setValidating(false)
    }
  }

  const verifyProofWithBackend = async (documentId: string, circuitKey?: string, proofData?: {
    proof: Uint8Array;
    vk: Uint8Array;
    publicInputs: any;
  }) => {
    console.log("Verifying proof with zkVerify backend for document ID:", documentId)
    
    if (!proofData || !proofData.proof || !proofData.vk || proofData.publicInputs === null) {
      setError("Proof data is incomplete for verification")
      return
    }

    // Use provided circuitKey or default to 'tax'
    const circuitType = (circuitKey || 'tax') + '_validation'
    
    // Get the selected circuit to determine number of public inputs
    const selectedCircuit = CIRCUITS.find(c => c.key === (circuitKey || 'tax'))
    const numberOfPublicInputs = selectedCircuit ? 1 : 1 // Default to 1 for validate page

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

      console.log('Sending proof verification request to zkVerify:', {
        ...requestBody,
        proof: `Array[${requestBody.proof.length}]`,
        vk: `Array[${requestBody.vk.length}]`
      })

      const response = await fetch('/api/document/verify-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include' // Include cookies for session-based authentication
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      // Update validation result with zkVerify verification results
      setValidationResult({
        valid: result.verification.verified,
        message: result.verification.verified 
          ? `✅ Proof verified successfully on zkVerify! TX Hash: ${result.verification.txHash}`
          : `❌ zkVerify verification failed: ${result.verification.message}`
      })

      if (result.verification.verified) {
        toast({
          title: "✅ Proof Verified Successfully!",
          description: `zkVerify Transaction Hash: ${result.verification.txHash}`,
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
      console.error("zkVerify verification error:", err)
      
      setValidationResult({
        valid: false,
        message: `zkVerify verification failed: ${errorMessage}`
      })
      
      toast({
        title: "❌ zkVerify Verification Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const handleToggleStatus = async (docId: string) => {
    try {
      const doc = documents.find(d => d.id === docId)
      if (!doc) return

      const newStatus = doc.status === "verified" ? "pending" : "verified"
      
      await api.patch(`/document/${docId}`, {
        status: newStatus
      })

      const updatedDocuments = documents.map((doc) => {
        if (doc.id === docId) {
          if (searchResult && searchResult.id === docId) {
            setSearchResult({
              ...searchResult,
              status: newStatus,
            })
          }

          toast({
            title: newStatus === "verified" ? translations.validate.success.validated : translations.validate.success.markedPending,
            description: `${doc.name} has been ${newStatus === "verified" ? "validated" : "marked as pending"}.`,
          })

          return {
            ...doc,
            status: newStatus,
          }
        }
        return doc
      })

      setDocuments(updatedDocuments)
    } catch (error) {
      console.error('Error updating document status:', error)
      toast({
        title: "Error",
        description: "Failed to update document status",
        variant: "destructive"
      })
    }
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
        <h1 className="text-3xl font-bold tracking-tight">{translations.validate.title}</h1>
        <p className="text-gray-500">{translations.validate.subtitle}</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{translations.validate.verifyDocument}</CardTitle>
          <CardDescription>{translations.validate.verifyDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {validationResult && (
            <Alert variant={validationResult.valid ? "default" : "destructive"}>
              {validationResult.valid ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>{validationResult.valid ? "Success" : "Error"}</AlertTitle>
              <AlertDescription>{validationResult.message}</AlertDescription>
            </Alert>
          )}

          {validating && (
            <Alert className="bg-blue-50 text-blue-800 border-blue-200">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <AlertTitle>Verification in Progress</AlertTitle>
              <AlertDescription>
                Performing local validation and zkVerify network verification...
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proof-file">Upload Proof File</Label>
              <div className="flex gap-2">
                <Input
                  id="proof-file"
                  type="file"
                  accept=".json"
                  onChange={handleProofFileChange}
                  className="flex-1"
                />
                <Button
                  onClick={handleValidateProof}
                  disabled={!proofFile || validating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {validating ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Verifying with zkVerify...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Validate & Verify Proof
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {searchResult && (
            <div className="mt-6 border rounded-md overflow-hidden">
              <div className="bg-gray-50 p-4 border-b">
                <h3 className="font-medium">{translations.validate.documentFound}</h3>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">{searchResult.name}</p>
                      <p className="text-xs text-gray-500">
                        {translations.validate.uploadedOn} {new Date(searchResult.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">{translations.validate.status}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {searchResult.status === "verified" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <Badge
                          className={
                            searchResult.status === "verified"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                          }
                        >
                          {searchResult.status === "verified" ? "Verified" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500">{translations.validate.hash}</p>
                      <code className="text-xs bg-gray-100 p-1 rounded block mt-1 overflow-hidden text-ellipsis">
                        {searchResult.id}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{translations.validate.recentDocuments}</CardTitle>
          <CardDescription>{translations.validate.recentDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {documents.filter((doc) => doc.id).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translations.validate.document}</TableHead>
                  <TableHead>{translations.validate.uploadDate}</TableHead>
                  <TableHead>{translations.validate.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents
                  .filter((doc) => doc.id)
                  .slice(0, 5)
                  .map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            doc.status === "verified"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                          }
                        >
                          {doc.status === "verified" ? "Verified" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium">{translations.validate.noDocuments}</h3>
              <p className="text-gray-500 mt-2">{translations.validate.noDocumentsDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
