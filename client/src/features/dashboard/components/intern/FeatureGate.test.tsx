import { render, screen } from '@testing-library/react'
import { FeatureGate } from './FeatureGate'
import { defaultMissionCardConfig } from '../../types/missionFeatureFlags'

describe('FeatureGate', () => {
  it('hides children when the card is not visible', () => {
    const flags = defaultMissionCardConfig()
    flags.tasks = {
      ...flags.tasks,
      isVisible: false,
    }

    render(
      <FeatureGate card="tasks" flags={flags}>
        <div>Tasks content</div>
      </FeatureGate>,
    )

    expect(screen.queryByText('Tasks content')).not.toBeInTheDocument()
  })

  it('renders a read-only badge when the card is visible but non-interactive', () => {
    const flags = defaultMissionCardConfig()
    flags.deliverables = {
      ...flags.deliverables,
      isVisible: true,
      isInteractive: false,
    }

    render(
      <FeatureGate card="deliverables" flags={flags}>
        <div>Deliverables content</div>
      </FeatureGate>,
    )

    expect(screen.getByText('Deliverables content')).toBeInTheDocument()
    expect(screen.getByText('Read-only mode')).toBeInTheDocument()
  })
})
