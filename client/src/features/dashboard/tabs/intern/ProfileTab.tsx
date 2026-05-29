import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { buildApiUrl } from '../../../../lib/apiClient'
import { DashboardButton } from '../../components/DashboardButton'
import { useInternProfile } from '../../hooks/intern/useInternProfile'
import { toErrorMessage } from '../../shared/utils/errorMessage'
import { buildCurrentYearOfStudy, getDefaultStudyYear, getDegreeLevelOptions, getStudyYearOptions, isStudyYearValid, parseCurrentYearOfStudy, type DegreeLevel, type StudyYear } from '../../components/intern/academicYear'
import type { InternProfileResponse, UpdateInternProfileRequest } from '../../types/intern.types'
import type { TranslateFn } from '../../types/internDashboard'
import { InternTabError, InternTabLoading } from './InternTabStates'

interface ProfileTabProps {
  t: TranslateFn
}

interface ProfileForm {
  universityId: string
  major: string
  workPreference: string
  phoneNumber: string
}

function createForm(profile: InternProfileResponse | null): ProfileForm {
  return {
    universityId: profile?.universityId ?? '',
    major: profile?.major ?? '',
    workPreference: profile?.workPreference ?? '',
    phoneNumber: profile?.phoneNumber ?? '',
  }
}

export function ProfileTab({ t }: ProfileTabProps) {
  const state = useInternProfile()
  const [form, setForm] = useState<ProfileForm>(() => createForm(null))
  const [formError, setFormError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [degreeLevel, setDegreeLevel] = useState<DegreeLevel>('licence')
  const [studyYear, setStudyYear] = useState<StudyYear>('1')

  useEffect(() => {
    setForm(createForm(state.profile))
    const parsed = parseCurrentYearOfStudy(state.profile?.currentYearOfStudy)
    if (parsed) {
      setDegreeLevel(parsed.degreeLevel)
      setStudyYear(parsed.studyYear ?? getDefaultStudyYear(parsed.degreeLevel))
    }
  }, [state.profile])

  const updateFormField = (field: keyof ProfileForm, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const handleDegreeLevelChange = (value: string) => {
    const next = value as DegreeLevel
    setDegreeLevel(next)
    setStudyYear((prev) =>
      isStudyYearValid(next, prev) ? prev : getDefaultStudyYear(next),
    )
  }

  const degreeLevelOptions = useMemo(() => getDegreeLevelOptions(t), [t])
  const studyYearOptions = useMemo(() => getStudyYearOptions(degreeLevel, t), [degreeLevel, t])

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const payload: UpdateInternProfileRequest = {
      universityId: form.universityId || null,
      major: form.major,
      currentYearOfStudy: buildCurrentYearOfStudy(degreeLevel, studyYear),
      workPreference: form.workPreference || null,
      phoneNumber: form.phoneNumber || null,
    }

    void state.updateProfile(payload)
      .catch((error) => setFormError(toErrorMessage(error, t('dashboard.intern.profile.saveFailed'))))
  }

  const handleCvUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadError(null)
      void state.uploadCv(file)
        .catch((error) => setUploadError(toErrorMessage(error, t('dashboard.intern.statusGate.incomplete.uploadError'))))
    }
    event.target.value = ''
  }

  if (state.isLoading) {
    return <InternTabLoading label={t('dashboard.intern.tabs.loading')} />
  }

  const loadError = state.profileQuery.error ?? state.schoolsQuery.error
  if (loadError) {
    return (
      <InternTabError
        title={t('dashboard.intern.tabs.errorTitle')}
        message={toErrorMessage(loadError, t('dashboard.intern.tabs.errorMessage'))}
        retryLabel={t('dashboard.intern.error.retry')}
        onRetry={state.refetch}
      />
    )
  }

  return (
    <div className="intern-tab-stack">
      <section className="intern-panel">
        <div className="intern-section-header">
          <div>
            <p className="intern-eyebrow">{t('dashboard.intern.tabs.profile')}</p>
            <h2>{t('dashboard.intern.profile.editProfile')}</h2>
          </div>
          <span className="intern-status-pill">{state.profile?.verificationStatus ?? '-'}</span>
        </div>

        <form className="intern-profile-form" onSubmit={handleSave}>
          <label className="intern-form-field">
            <span>{t('dashboard.intern.profile.university')}</span>
            <select value={form.universityId} onChange={(event) => updateFormField('universityId', event.target.value)}>
              <option value="">{t('dashboard.intern.profile.selectUniversity')}</option>
              {state.schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>

          <label className="intern-form-field">
            <span>{t('dashboard.intern.profile.major')}</span>
            <input type="text" value={form.major} onChange={(event) => updateFormField('major', event.target.value)} />
          </label>

          <label className="intern-form-field">
            <span>{t('dashboard.intern.application.degreeLevel')}</span>
            <select value={degreeLevel} onChange={(e) => handleDegreeLevelChange(e.target.value)}>
              {degreeLevelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="intern-form-field">
            <span>{t('dashboard.intern.application.studyYear')}</span>
            <select value={studyYear} onChange={(e) => setStudyYear(e.target.value as StudyYear)}>
              {studyYearOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="intern-form-field">
            <span>{t('dashboard.intern.profile.workPreference')}</span>
            <select value={form.workPreference} onChange={(event) => updateFormField('workPreference', event.target.value)}>
              <option value="">{t('dashboard.intern.profile.selectPreference')}</option>
              <option value="remote">{t('dashboard.intern.application.remote')}</option>
              <option value="hybrid">{t('dashboard.intern.application.hybrid')}</option>
              <option value="onsite">{t('dashboard.intern.application.onsite')}</option>
            </select>
          </label>

          <label className="intern-form-field">
            <span>{t('dashboard.intern.profile.phoneNumber')}</span>
            <input type="tel" value={form.phoneNumber} onChange={(event) => updateFormField('phoneNumber', event.target.value)} />
          </label>

          <div className="intern-profile-form-actions">
            {formError && <p className="intern-inline-error">{formError}</p>}
            <DashboardButton
              type="submit"
              variant="primary"
              size="sm"
              loading={state.updateProfileMutation.isPending || state.replaceSkillsMutation.isPending}
            >
              {t('dashboard.settings.saveChanges')}
            </DashboardButton>
          </div>
        </form>
      </section>

      <section className="intern-panel">
        <div className="intern-section-header">
          <div>
            <p className="intern-eyebrow">{t('dashboard.intern.profile.cv')}</p>
            <h2>{t('dashboard.intern.profile.cvUpload')}</h2>
          </div>
          {state.profile?.cvFileUrl && (
            <a className="intern-text-link" href={buildApiUrl('/api/intern/me/profile/cv')} target="_blank" rel="noreferrer noopener">
              {t('dashboard.intern.profile.viewCv')}
            </a>
          )}
        </div>

        <label className="intern-upload-box">
          <input type="file" accept="application/pdf,.pdf" onChange={handleCvUpload} />
          <span>{t('dashboard.intern.profile.chooseCv')}</span>
          <small>{t('dashboard.intern.statusGate.incomplete.pdfOnly')}</small>
        </label>
        {state.cvUploadProgress && (
          <div className="intern-upload-progress" role="status">
            <div className="intern-progress-track" aria-hidden="true">
              <div className="intern-progress-fill" style={{ width: `${state.cvUploadProgress.percent ?? 0}%` }} />
            </div>
            <span>{t('dashboard.intern.upload.progress', { percent: state.cvUploadProgress.percent ?? 0 })}</span>
          </div>
        )}
        {uploadError && <p className="intern-inline-error">{uploadError}</p>}
      </section>
    </div>
  )
}
