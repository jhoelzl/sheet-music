import { PDF_STORAGE_BUCKET } from '../config'
import { supabase } from '../supabase'

const REQUEST_TIMEOUT_MS = 90_000
export type UploadStage = { phase: 'prepare' | 'upload' | 'save'; message: string }

export async function uploadStep<T>(operation: PromiseLike<T>, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${stage} timed out. Check your connection and retry. The previous request may still complete.`)), REQUEST_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export function uploadErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') return reason.message
  return 'An unexpected upload error occurred. Please retry.'
}

export class UploadCleanupError extends Error {}

export async function saveUploadRecord<T>(
  operation: PromiseLike<{ data: T; error: { message: string; code?: string } | null }>,
  path: string, id: string, uncertain: Set<string>, stage: string,
): Promise<T> {
  let result: { data: T; error: { message: string; code?: string } | null }
  try {
    result = await uploadStep(operation, stage)
  } catch (reason) {
    uncertain.add(id)
    throw reason
  }
  if (result.error) {
    if (!uncertain.has(id) && /^\d{5}$/.test(result.error.code ?? '')) {
      try {
        const cleanup = await uploadStep(supabase.storage.from(PDF_STORAGE_BUCKET).remove([path]), 'Removing the unsaved PDF')
        if (cleanup.error) throw cleanup.error
      } catch (reason) {
        throw new UploadCleanupError(`${result.error.message} Cleanup could not be confirmed: ${uploadErrorMessage(reason)} A new upload will be used for the retry.`)
      }
    } else {
      uncertain.add(id)
    }
    throw result.error
  }
  uncertain.add(id)
  return result.data
}

export async function uploadDocument(file: File, id: string, folder: '' | 'materials', onStage: (stage: UploadStage) => void): Promise<string> {
  onStage({ phase: 'prepare', message: 'Checking your account…' })
  const { data: { user }, error } = await uploadStep(supabase.auth.getUser(), 'Checking your account')
  if (error) throw error
  if (!user) throw new Error('Sign in before uploading a document.')
  const path = `${user.id}/${folder ? `${folder}/` : ''}${id}.pdf`
  onStage({ phase: 'upload', message: 'Uploading PDF…' })
  const uploaded = await uploadStep(
    supabase.storage.from(PDF_STORAGE_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true }),
    'Uploading the PDF',
  )
  if (uploaded.error) throw uploaded.error
  return path
}
