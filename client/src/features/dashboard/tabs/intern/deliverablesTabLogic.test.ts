import { applyOptimisticTaskCompletion, isAllowedSubmissionFile, isValidGitHubRepositoryUrl } from './deliverablesTabLogic'

describe('deliverablesTabLogic', () => {
  it('accepts repository-level GitHub URLs only', () => {
    expect(isValidGitHubRepositoryUrl('https://github.com/owner/repo')).toBe(true)
    expect(isValidGitHubRepositoryUrl('https://github.com/owner/repo/')).toBe(true)
    expect(isValidGitHubRepositoryUrl('https://github.com/owner/repo/issues')).toBe(false)
    expect(isValidGitHubRepositoryUrl('https://example.com/owner/repo')).toBe(false)
    expect(isValidGitHubRepositoryUrl('not a url')).toBe(false)
  })

  it('marks only the selected task complete for optimistic updates', () => {
    const tasks = [
      { id: 'task-1', title: 'One', completed: false },
      { id: 'task-2', title: 'Two', completed: false },
    ]

    expect(applyOptimisticTaskCompletion(tasks, 'task-1')).toEqual([
      { id: 'task-1', title: 'One', completed: true },
      { id: 'task-2', title: 'Two', completed: false },
    ])
  })

  it('allows only configured submission file extensions', () => {
    expect(isAllowedSubmissionFile(new File(['x'], 'report.pdf'))).toBe(true)
    expect(isAllowedSubmissionFile(new File(['x'], 'source.zip'))).toBe(true)
    expect(isAllowedSubmissionFile(new File(['x'], 'image.png'))).toBe(false)
  })
})
