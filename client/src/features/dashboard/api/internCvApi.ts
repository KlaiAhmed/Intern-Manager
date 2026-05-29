import type { CvUploadResponse } from '../types/internDashboard'
import { internDashboardApi } from './internDashboardApi'

type ProgressCallback = (value: number) => void

export function uploadInternCvWithProgress(file: File, onProgress: ProgressCallback): Promise<CvUploadResponse>
export function uploadInternCvWithProgress(_internId: string, file: File, onProgress: ProgressCallback): Promise<CvUploadResponse>
export function uploadInternCvWithProgress(
  fileOrInternId: File | string,
  fileOrProgress: File | ProgressCallback,
  maybeProgress?: ProgressCallback,
): Promise<CvUploadResponse> {
  const file = fileOrInternId instanceof File ? fileOrInternId : fileOrProgress
  const onProgress = fileOrInternId instanceof File ? fileOrProgress : maybeProgress

  if (!(file instanceof File) || typeof onProgress !== 'function') {
    return Promise.reject(new Error('A CV file and upload progress callback are required.'))
  }

  return internDashboardApi.uploadCv(file, {
    onProgress: (progress) => {
      if (progress.percent !== null) {
        onProgress(progress.percent)
      }
    },
  })
}
