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
      { id: 'task-1', title: 'One', status: 'todo' },
      { id: 'task-2', title: 'Two', status: 'done' },
    ]

    expect(applyOptimisticTaskCompletion(tasks, 'task-1')).toEqual([
      { id: 'task-1', title: 'One', status: 'done' },
      { id: 'task-2', title: 'Two', status: 'done' },
    ])
  })

  it('toggles a done task back to todo for optimistic updates', () => {
    const tasks = [
      { id: 'task-1', title: 'One', status: 'done' },
    ]

    expect(applyOptimisticTaskCompletion(tasks, 'task-1')).toEqual([
      { id: 'task-1', title: 'One', status: 'todo' },
    ])
  })

  it('allows only configured submission file extensions', () => {
    expect(isAllowedSubmissionFile(new File(['x'], 'report.pdf'))).toBe(true)
    expect(isAllowedSubmissionFile(new File(['x'], 'source.zip'))).toBe(true)
    expect(isAllowedSubmissionFile(new File(['x'], 'image.png'))).toBe(false)
  })
})
