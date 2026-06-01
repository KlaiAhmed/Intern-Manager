import type { PropsWithChildren } from 'react'
import { Header } from '../Header'
import { Footer } from '../Footer'
import styles from './index.module.css'


export function AppShell({ children }: PropsWithChildren) {

  return (
    <div className={styles.appShell}>
      <Header />
      <div className={styles.appShellContent}>
        {children}
      </div>
      <Footer />
    </div>
  )
}




