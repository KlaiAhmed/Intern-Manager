const githubSegmentPattern = /^[A-Za-z0-9._-]+$/

export function isValidGitHubRepositoryUrl(rawValue: string): boolean {
  const trimmedValue = rawValue.trim()
  if (!trimmedValue) {
    return false
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmedValue)
  } catch {
    return false
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return false
  }

  if (parsedUrl.hostname.toLowerCase() !== 'github.com') {
    return false
  }

  if (parsedUrl.search || parsedUrl.hash) {
    return false
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean)
  return segments.length === 2 && segments.every((segment) => githubSegmentPattern.test(segment))
}

export function applyOptimisticTaskCompletion<TTask extends { id: string; completed: boolean }>(
  tasks: TTask[],
  taskId: string,
): TTask[] {
  return tasks.map((task) => (
    task.id === taskId
      ? { ...task, completed: true }
      : task
  ))
}

export function isAllowedSubmissionFile(file: File): boolean {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.zip']
  const normalizedName = file.name.toLowerCase()
  return allowedExtensions.some((extension) => normalizedName.endsWith(extension))
}
